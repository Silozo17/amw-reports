import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

// Webhook-only function — no CORS needed (called by Stripe, not browser)

const EVENT_TEMPLATE_MAP: Record<string, string> = {
  "checkout.session.completed": "subscription_activated",
  "invoice.payment_failed": "payment_failed",
  "customer.subscription.trial_will_end": "trial_ending",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey || !webhookSecret) {
      return new Response(JSON.stringify({ error: "Missing Stripe config" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Handle subscription updates (upgraded/downgraded/cancelled)
    let templateName: string | null = null;
    let emailData: Record<string, unknown> = {};
    let customerEmail: string | null = null;

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const prev = (event.data as Record<string, unknown>).previous_attributes as { items?: { data?: Array<{ price?: { id?: string; unit_amount?: number } }> } } | undefined;
      customerEmail = await getCustomerEmail(stripe, sub.customer as string);

      if (prev?.items) {
        const oldPrice = prev.items?.data?.[0]?.price?.id;
        const newPrice = sub.items.data[0]?.price?.id;
        if (oldPrice && newPrice && oldPrice !== newPrice) {
          // Determine direction by comparing amounts
          const oldAmount = prev.items?.data?.[0]?.price?.unit_amount ?? 0;
          const newAmount = sub.items.data[0]?.price?.unit_amount ?? 0;
          templateName = newAmount > oldAmount ? "subscription_upgraded" : "subscription_downgraded";
          emailData = {
            new_plan: sub.items.data[0]?.price?.nickname ?? "Updated Plan",
            amount: (newAmount / 100).toFixed(2),
            currency: sub.currency?.toUpperCase() ?? "USD",
          };
        }
      }

      if (!templateName && sub.status === "canceled") {
        templateName = "trial_expired";
        emailData = { reason: "Subscription cancelled" };
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      customerEmail = await getCustomerEmail(stripe, sub.customer as string);
      templateName = "trial_expired";
      emailData = { reason: "Subscription ended" };
    } else if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      customerEmail = session.customer_email ?? await getCustomerEmail(stripe, session.customer as string);
      templateName = "subscription_activated";
      emailData = { session_id: session.id };
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      customerEmail = invoice.customer_email ?? await getCustomerEmail(stripe, invoice.customer as string);
      templateName = "payment_failed";
      emailData = {
        amount: ((invoice.amount_due ?? 0) / 100).toFixed(2),
        currency: invoice.currency?.toUpperCase() ?? "USD",
        next_attempt: invoice.next_payment_attempt
          ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString()
          : null,
      };
    } else if (event.type === "customer.subscription.trial_will_end") {
      const sub = event.data.object as Stripe.Subscription;
      customerEmail = await getCustomerEmail(stripe, sub.customer as string);
      templateName = "trial_ending";
      emailData = {
        trial_end: sub.trial_end
          ? new Date(sub.trial_end * 1000).toLocaleDateString()
          : null,
      };
    }

    if (templateName && customerEmail) {
      // Look up org via profile email
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", customerEmail)
        .maybeSingle();

      let orgId: string | null = null;
      if (profile?.user_id) {
        const { data: membership } = await supabase
          .from("org_members")
          .select("org_id")
          .eq("user_id", profile.user_id)
          .limit(1)
          .maybeSingle();
        orgId = membership?.org_id ?? null;
      }

      if (orgId) {
        await supabase.functions.invoke("send-branded-email", {
          body: {
            template_name: templateName,
            recipient_email: customerEmail,
            org_id: orgId,
            data: emailData,
          },
        });
      }
    }

    return new Response(JSON.stringify({ received: true, event_type: event.type, template: templateName }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-webhook error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function getCustomerEmail(stripe: Stripe, customerId: string): Promise<string | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) return null;
    return (customer as Stripe.Customer).email ?? null;
  } catch {
    return null;
  }
}
