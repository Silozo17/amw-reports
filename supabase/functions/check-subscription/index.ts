import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const GRACE_PERIOD_DAYS = 7;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

const rateLimitMap = new Map<string, number[]>();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${d}`);
};

const PLAN_MAP: Record<string, string> = {
  prod_UDjL6VWZaFj7Ta: "agency",
};

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(userId, recent);
    return false;
  }
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return true;
}

async function verifyOrgMembership(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  orgId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("org_members")
    .select("id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();
  return !!data;
}

async function syncOrgSubscription(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  planSlug: string,
  dbStatus: string,
  subscriptionEnd: string | null,
  graceEnd: string | null
) {
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("slug", planSlug)
    .single();
  if (!plan) return;

  const { data: existing } = await supabase
    .from("org_subscriptions")
    .select("id, status, current_period_end, grace_period_end, plan_id")
    .eq("org_id", orgId)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    org_id: orgId,
    plan_id: plan.id,
    status: dbStatus,
    current_period_end: subscriptionEnd,
  };

  if (dbStatus === "active") {
    payload.grace_period_end = null;
  } else if (dbStatus === "past_due" && !existing?.grace_period_end) {
    const ge = new Date();
    ge.setDate(ge.getDate() + GRACE_PERIOD_DAYS);
    payload.grace_period_end = ge.toISOString();
  } else if (dbStatus === "cancelled") {
    if (!existing?.grace_period_end) {
      const ge = new Date();
      ge.setDate(ge.getDate() + GRACE_PERIOD_DAYS);
      payload.grace_period_end = ge.toISOString();
    } else {
      payload.grace_period_end = existing.grace_period_end;
    }
  }

  if (existing) {
    // Idempotency: skip write if nothing changed
    if (
      existing.status === dbStatus &&
      existing.current_period_end === subscriptionEnd &&
      existing.plan_id === plan.id
    ) {
      logStep("DB already up-to-date, skipping write", { orgId });
      return;
    }
    await supabase.from("org_subscriptions").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("org_subscriptions").insert(payload);
  }
  logStep("Synced org subscription", { orgId, status: dbStatus });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");

    // Use anon key client for proper JWT validation
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      anonKey,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );
    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Rate limit check
    if (!checkRateLimit(user.id)) {
      logStep("Rate limit exceeded", { userId: user.id });
      return new Response(
        JSON.stringify({ error: "Too many requests. Try again in a minute." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    // Resolve org_id and verify membership
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    const orgId = profile?.org_id;

    if (orgId) {
      const isMember = await verifyOrgMembership(supabase, user.id, orgId);
      if (!isMember) {
        logStep("User not a member of org", { userId: user.id, orgId });
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");

      // Sync cancelled status if org has a paid plan marked active
      if (orgId) {
        const { data: existingSub } = await supabase
          .from("org_subscriptions")
          .select("id, status, grace_period_end, plan_id, current_period_end, subscription_plans(slug)")
          .eq("org_id", orgId)
          .maybeSingle();

        if (existingSub && existingSub.status === "active") {
          const planSlug = (existingSub as any)?.subscription_plans?.slug;
          if (planSlug && planSlug !== "creator") {
            await syncOrgSubscription(supabase, orgId, planSlug, "cancelled", null, null);
          }
        }
      }

      return new Response(
        JSON.stringify({ subscribed: false, plan: "creator" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    const activeSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const pastDueSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "past_due",
      limit: 1,
    });

    const sub = activeSubscriptions.data[0] || pastDueSubscriptions.data[0] || null;

    if (!sub) {
      logStep("No active or past_due subscription");

      if (orgId) {
        const { data: existingSub } = await supabase
          .from("org_subscriptions")
          .select("id, status, grace_period_end, plan_id, current_period_end, subscription_plans(slug)")
          .eq("org_id", orgId)
          .maybeSingle();

        if (existingSub && existingSub.status === "active") {
          const planSlug = (existingSub as any)?.subscription_plans?.slug;
          if (planSlug && planSlug !== "creator") {
            await syncOrgSubscription(supabase, orgId, planSlug, "cancelled", null, null);
          }
        }
      }

      return new Response(
        JSON.stringify({ subscribed: false, plan: "creator" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const productId = sub.items.data[0].price.product as string;
    const plan = PLAN_MAP[productId] || "agency";
    const subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
    const stripeStatus = sub.status;

    logStep("Subscription found", { subscriptionId: sub.id, plan, productId, status: stripeStatus });

    if (orgId) {
      const dbStatus = stripeStatus === "past_due" ? "past_due" : "active";
      await syncOrgSubscription(supabase, orgId, plan, dbStatus, subscriptionEnd, null);
    }

    return new Response(
      JSON.stringify({
        subscribed: true,
        plan,
        status: stripeStatus,
        product_id: productId,
        subscription_end: subscriptionEnd,
        customer_id: customerId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
