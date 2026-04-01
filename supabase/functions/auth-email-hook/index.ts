import { createClient } from "@supabase/supabase-js";

/* ═══════════════════════════════════════════════════════════
   AUTH-EMAIL-HOOK — intercepts Supabase Auth events and
   routes them through the send-branded-email function
   for consistent white-labelled auth emails via Resend.
   ═══════════════════════════════════════════════════════════ */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AUTH_EVENT_TO_TEMPLATE: Record<string, string> = {
  signup: "auth_welcome",
  magiclink: "auth_magic_link",
  recovery: "auth_recovery",
  email_change: "auth_email_change",
  reauthentication: "auth_magic_link",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload = await req.json();

    // Supabase Auth hook payload structure
    const eventType = payload.type ?? payload.event_type ?? "";
    const user = payload.user ?? {};
    const email = user.email ?? payload.email ?? "";
    const confirmationUrl = payload.confirmation_url ?? payload.action_link ?? "";
    const otpToken = payload.token ?? payload.email_data?.token ?? "";
    const newEmail = payload.new_email ?? "";

    const templateName = AUTH_EVENT_TO_TEMPLATE[eventType];
    if (!templateName) {
      console.log(`Unhandled auth event type: ${eventType}`);
      return new Response(
        JSON.stringify({ success: true, message: `Event type '${eventType}' not handled` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine org_id from user profile
    let orgId: string | null = null;
    const userId = user.id ?? null;

    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id, full_name")
        .eq("user_id", userId)
        .single();

      orgId = profile?.org_id ?? null;
    }

    // For new signups, profile might not exist yet — try org_members
    if (!orgId && userId) {
      const { data: member } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", userId)
        .limit(1)
        .single();

      orgId = member?.org_id ?? null;
    }

    // If still no org, check by invited email
    if (!orgId && email) {
      const { data: invitedMember } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("invited_email", email)
        .limit(1)
        .single();

      orgId = invitedMember?.org_id ?? null;
    }

    // Fallback — send with default branding if no org found
    if (!orgId) {
      console.log(`No org found for user ${userId ?? email}, using default branding`);
    }

    // Build data payload for the template
    const templateData: Record<string, unknown> = {
      confirmation_url: confirmationUrl,
      recipient_name: user.user_metadata?.full_name ?? user.email ?? "",
      device_info: req.headers.get("user-agent") ?? "Unknown device",
      profile_url: `${supabaseUrl.replace(".supabase.co", ".lovable.app")}/settings`,
      support_email: "support@amwmedia.co.uk",
    };

    if (eventType === "email_change") {
      templateData.old_email = email;
      templateData.new_email = newEmail;
      templateData.is_old_email = false; // sent to new email for confirmation
    }

    // Invoke send-branded-email
    const { data: result, error } = await supabase.functions.invoke("send-branded-email", {
      body: {
        template_name: templateName,
        recipient_email: eventType === "email_change" ? (newEmail || email) : email,
        recipient_name: user.user_metadata?.full_name ?? "",
        org_id: orgId ?? "00000000-0000-0000-0000-000000000000",
        data: templateData,
      },
    });

    if (error) {
      console.error("Failed to send branded auth email:", error);
      return new Response(
        JSON.stringify({ error: `Failed to send: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Auth email sent for event: ${eventType}`, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auth-email-hook error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
