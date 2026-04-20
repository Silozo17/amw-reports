import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

// Webhook-only function — no CORS needed (called by Stripe, not browser)

const GRACE_PERIOD_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "stripe-webhook", method: req.method, connection_id: null }));

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

    let templateName: string | null = null;
    let emailData: Record<string, unknown> = {};
    let customerEmail: string | null = null;

    // --- Subscription status sync helper ---
    async function syncOrgSubscriptionStatus(
      email: string,
      status: string,
      setGracePeriod: boolean,
      clearGracePeriod: boolean
    ) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

      if (!profile?.user_id) return;

      const { data: membership } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", profile.user_id)
        .limit(1)
        .maybeSingle();

      if (!membership?.org_id) return;

      const updatePayload: Record<string, unknown> = { status };

      if (setGracePeriod) {
        const graceEnd = new Date();
        graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
        updatePayload.grace_period_end = graceEnd.toISOString();
      }

      if (clearGracePeriod) {
        updatePayload.grace_period_end = null;
      }

      await supabase
        .from("org_subscriptions")
        .update(updatePayload)
        .eq("org_id", membership.org_id);

      console.log(`[STRIPE-WEBHOOK] Synced org ${membership.org_id} status=${status}`);
    }

    // --- Handle events ---
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const prev = (event.data as Record<string, unknown>).previous_attributes as { items?: { data?: Array<{ price?: { id?: string; unit_amount?: number } }> } } | undefined;
      customerEmail = await getCustomerEmail(stripe, sub.customer as string);

      // Sync status changes
      if (customerEmail) {
        if (sub.status === "past_due") {
          await syncOrgSubscriptionStatus(customerEmail, "past_due", true, false);
        } else if (sub.status === "canceled" || sub.status === "unpaid") {
          await syncOrgSubscriptionStatus(customerEmail, "cancelled", true, false);
        } else if (sub.status === "active") {
          await syncOrgSubscriptionStatus(customerEmail, "active", false, true);
        }
      }

      if (prev?.items) {
        const oldPrice = prev.items?.data?.[0]?.price?.id;
        const newPrice = sub.items.data[0]?.price?.id;
        if (oldPrice && newPrice && oldPrice !== newPrice) {
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

      if (customerEmail) {
        await syncOrgSubscriptionStatus(customerEmail, "cancelled", true, false);
      }
    } else if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      customerEmail = session.customer_email ?? await getCustomerEmail(stripe, session.customer as string);

      // Branch: Content Lab credit top-up
      if (session.metadata?.type === "content_lab_credits") {
        const orgId = session.metadata.org_id;
        const credits = parseInt(session.metadata.credits ?? "0", 10);
        const paymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? session.id;

        if (orgId && credits > 0) {
          // Idempotency check
          const { data: existing } = await supabase
            .from("content_lab_credit_ledger")
            .select("id")
            .eq("stripe_payment_id", paymentIntentId)
            .maybeSingle();

          if (existing) {
            console.log(`[STRIPE-WEBHOOK] Credit top-up ${paymentIntentId} already processed, skipping`);
          } else {
            const { error: rpcErr } = await supabase.rpc("add_content_lab_credits", {
              _org_id: orgId,
              _amount: credits,
              _stripe_payment_id: paymentIntentId,
            });
            if (rpcErr) {
              console.error("[STRIPE-WEBHOOK] add_content_lab_credits failed:", rpcErr);
            } else {
              console.log(`[STRIPE-WEBHOOK] Added ${credits} credits to org ${orgId}`);
            }
          }
        }
        // No email template for credit purchases — Stripe sends its own receipt
      } else {
        // Subscription checkout — original behaviour
        templateName = "subscription_activated";
        emailData = { session_id: session.id };

        // Restore to active and clear grace period
        if (customerEmail) {
          await syncOrgSubscriptionStatus(customerEmail, "active", false, true);
        }
      }
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

      // Set past_due with grace period
      if (customerEmail) {
        await syncOrgSubscriptionStatus(customerEmail, "past_due", true, false);
      }
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
