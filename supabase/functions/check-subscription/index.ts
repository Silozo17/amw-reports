import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${d}`);
};

// Plan mapping
const PLAN_MAP: Record<string, string> = {
  prod_UDjL6VWZaFj7Ta: "agency",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(
        JSON.stringify({ subscribed: false, plan: "starter" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      logStep("No active subscription");
      return new Response(
        JSON.stringify({ subscribed: false, plan: "starter" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const sub = subscriptions.data[0];
    const productId = sub.items.data[0].price.product as string;
    const plan = PLAN_MAP[productId] || "agency";
    const subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();

    logStep("Active subscription found", { subscriptionId: sub.id, plan, productId });

    // Sync subscription status to org_subscriptions
    // Find org via profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (profile?.org_id) {
      // Find the Agency plan in subscription_plans
      const { data: agencyPlan } = await supabase
        .from("subscription_plans")
        .select("id")
        .eq("slug", plan)
        .single();

      if (agencyPlan) {
        const { data: existingSub } = await supabase
          .from("org_subscriptions")
          .select("id")
          .eq("org_id", profile.org_id)
          .maybeSingle();

        const subPayload = {
          org_id: profile.org_id,
          plan_id: agencyPlan.id,
          status: "active",
          current_period_end: subscriptionEnd,
        };

        if (existingSub) {
          await supabase.from("org_subscriptions").update(subPayload).eq("id", existingSub.id);
        } else {
          await supabase.from("org_subscriptions").insert(subPayload);
        }
        logStep("Synced org subscription", { orgId: profile.org_id });
      }
    }

    return new Response(
      JSON.stringify({
        subscribed: true,
        plan,
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
