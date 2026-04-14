import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// Cron-only function — no CORS needed

const GRACE_PERIOD_DAYS = 7;

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${d}`);
};

const PLAN_MAP: Record<string, string> = {
  prod_UDjL6VWZaFj7Ta: "agency",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
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

    // Use anon key client for proper JWT validation (service role bypasses token checks)
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

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(
        JSON.stringify({ subscribed: false, plan: "creator" }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      );
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    // Query active subscriptions first
    const activeSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    // Also query past_due subscriptions
    const pastDueSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "past_due",
      limit: 1,
    });

    const sub = activeSubscriptions.data[0] || pastDueSubscriptions.data[0] || null;

    if (!sub) {
      logStep("No active or past_due subscription");

      // Sync cancelled status to org_subscriptions
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("user_id", user.id)
        .single();

      if (profile?.org_id) {
        const { data: existingSub } = await supabase
          .from("org_subscriptions")
          .select("id, status, grace_period_end")
          .eq("org_id", profile.org_id)
          .maybeSingle();

        if (existingSub && existingSub.status !== "active" && existingSub.status !== "cancelled") {
          // Only update if not already properly set
        } else if (existingSub && existingSub.status === "active") {
          // Stripe says no sub, but DB says active — check if plan is starter (free)
          const { data: planData } = await supabase
            .from("org_subscriptions")
            .select("subscription_plans(slug)")
            .eq("id", existingSub.id)
            .single();

          const planSlug = (planData as unknown as { subscription_plans: { slug: string } })?.subscription_plans?.slug;
          if (planSlug && planSlug !== "creator") {
            const graceEnd = new Date();
            graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
            await supabase
              .from("org_subscriptions")
              .update({
                status: "cancelled",
                grace_period_end: existingSub.grace_period_end || graceEnd.toISOString(),
              })
              .eq("id", existingSub.id);
            logStep("Synced cancelled status", { orgId: profile.org_id });
          }
        }
      }

      return new Response(
        JSON.stringify({ subscribed: false, plan: "creator" }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      );
    }

    const productId = sub.items.data[0].price.product as string;
    const plan = PLAN_MAP[productId] || "agency";
    const subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
    const stripeStatus = sub.status; // "active" or "past_due"

    logStep("Subscription found", { subscriptionId: sub.id, plan, productId, status: stripeStatus });

    // Sync subscription status to org_subscriptions
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (profile?.org_id) {
      const { data: agencyPlan } = await supabase
        .from("subscription_plans")
        .select("id")
        .eq("slug", plan)
        .single();

      if (agencyPlan) {
        const { data: existingSub } = await supabase
          .from("org_subscriptions")
          .select("id, grace_period_end")
          .eq("org_id", profile.org_id)
          .maybeSingle();

        const dbStatus = stripeStatus === "past_due" ? "past_due" : "active";

        const subPayload: Record<string, unknown> = {
          org_id: profile.org_id,
          plan_id: agencyPlan.id,
          status: dbStatus,
          current_period_end: subscriptionEnd,
        };

        if (dbStatus === "active") {
          subPayload.grace_period_end = null;
        } else if (dbStatus === "past_due" && !existingSub?.grace_period_end) {
          const graceEnd = new Date();
          graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
          subPayload.grace_period_end = graceEnd.toISOString();
        }

        if (existingSub) {
          await supabase.from("org_subscriptions").update(subPayload).eq("id", existingSub.id);
        } else {
          await supabase.from("org_subscriptions").insert(subPayload);
        }
        logStep("Synced org subscription", { orgId: profile.org_id, status: dbStatus });
      }
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
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
