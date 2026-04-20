import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PACKS = {
  small: { priceId: "price_1TOC9HHCGP7kst5Z0kdI5FQk", credits: 5 },
  medium: { priceId: "price_1TOC9JHCGP7kst5ZV0Ao89Q2", credits: 25 },
  large: { priceId: "price_1TOC9KHCGP7kst5ZNruaMo3O", credits: 100 },
} as const;

const BodySchema = z.object({ pack: z.enum(["small", "medium", "large"]) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    fn: "create-content-lab-credit-checkout",
    method: req.method,
  }));

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Missing STRIPE_SECRET_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const pack = PACKS[parsed.data.pack];

    // Resolve org_id (service role to bypass RLS, user already authenticated)
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: membership } = await adminSupabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", userData.user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.org_id) {
      return new Response(JSON.stringify({ error: "No organisation found for user" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Reuse existing customer if present
    const customers = await stripe.customers.list({ email: userData.user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const origin = req.headers.get("origin") ?? "https://amwreports.com";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userData.user.email,
      mode: "payment",
      line_items: [{ price: pack.priceId, quantity: 1 }],
      success_url: `${origin}/content-lab?credits=success`,
      cancel_url: `${origin}/content-lab?credits=cancelled`,
      metadata: {
        type: "content_lab_credits",
        org_id: membership.org_id,
        credits: String(pack.credits),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-content-lab-credit-checkout error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
