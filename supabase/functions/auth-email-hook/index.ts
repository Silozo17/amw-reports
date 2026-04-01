import { createClient } from "@supabase/supabase-js";

/* ═══════════════════════════════════════════════════════════
   AUTH-EMAIL-HOOK — intercepts Supabase Auth email events and
   routes them through the send-branded-email function for
   consistent white-labelled auth emails via Resend.

   Supports: signup, magiclink, recovery, email_change,
   reauthentication, invite.
   ═══════════════════════════════════════════════════════════ */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ACTION_TO_TEMPLATE: Record<string, string> = {
  signup: "auth_welcome",
  magiclink: "auth_magic_link",
  recovery: "auth_recovery",
  email_change: "auth_email_change",
  reauthentication: "auth_magic_link",
  invite: "team_invitation",
};

/** Build a verification / action URL from token_hash when confirmation_url is absent */
function buildActionUrl(
  supabaseUrl: string,
  tokenHash: string,
  action: string,
  redirectTo: string,
): string {
  const base = `${supabaseUrl}/auth/v1/verify?token=${tokenHash}&type=${action}`;
  return redirectTo
    ? `${base}&redirect_to=${encodeURIComponent(redirectTo)}`
    : base;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload = await req.json();
    const emailData = payload.email_data ?? {};
    const user = payload.user ?? emailData.user ?? {};

    // ── 1. Determine action type ──────────────────────────
    const action: string =
      payload.email_action_type ??
      emailData.email_action_type ??
      payload.type ??
      payload.event_type ??
      "";

    // ── 2. Extract fields from every known payload location
    const email: string =
      payload.email ?? emailData.email ?? user.email ?? "";
    const token: string =
      payload.token ?? emailData.token ?? "";
    const tokenHash: string =
      payload.token_hash ?? emailData.token_hash ?? "";
    const redirectTo: string =
      payload.redirect_to ?? emailData.redirect_to ?? "";
    const newEmail: string =
      payload.new_email ?? emailData.new_email ?? "";

    // Build confirmation URL — prefer what Supabase already supplies,
    // otherwise construct from token_hash
    const confirmationUrl: string =
      payload.confirmation_url ??
      payload.action_link ??
      emailData.confirmation_url ??
      emailData.action_link ??
      (tokenHash
        ? buildActionUrl(supabaseUrl, tokenHash, action, redirectTo)
        : "");

    // ── 3. Map action to template ─────────────────────────
    const templateName = ACTION_TO_TEMPLATE[action];
    if (!templateName) {
      console.error(`Unsupported auth event type: ${action}. Full payload keys: ${Object.keys(payload).join(", ")}`);
      return new Response(
        JSON.stringify({ error: `Unsupported auth event type: '${action}'` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 4. Validate required fields per action ────────────
    if (!email) {
      console.error(`Missing recipient email for auth action '${action}'`);
      return new Response(
        JSON.stringify({ error: "Missing recipient email in auth payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // OTP-first actions require a token
    if ((action === "signup" || action === "reauthentication") && !token) {
      console.error(`Missing OTP token for action '${action}'`);
      return new Response(
        JSON.stringify({ error: `Missing OTP token for '${action}'` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Link-first actions require a confirmation URL
    if (
      ["magiclink", "recovery", "invite", "email_change"].includes(action) &&
      !confirmationUrl
    ) {
      console.error(`Missing confirmation URL for action '${action}'`);
      return new Response(
        JSON.stringify({ error: `Missing confirmation URL for '${action}'` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 5. Resolve org for branding ───────────────────────
    let orgId: string | null = null;
    const userId = user.id ?? null;

    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("user_id", userId)
        .single();
      orgId = profile?.org_id ?? null;
    }

    if (!orgId && userId) {
      const { data: member } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", userId)
        .limit(1)
        .single();
      orgId = member?.org_id ?? null;
    }

    if (!orgId && email) {
      const { data: invitedMember } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("invited_email", email)
        .limit(1)
        .single();
      orgId = invitedMember?.org_id ?? null;
    }

    if (!orgId) {
      console.log(`No org found for user ${userId ?? email}, using default branding`);
    }

    // ── 6. Build template data ────────────────────────────
    const recipientName =
      user.user_metadata?.full_name ?? user.email ?? email;

    const templateData: Record<string, unknown> = {
      confirmation_url: confirmationUrl,
      otp_token: token,
      token_hash: tokenHash,
      recipient_name: recipientName,
      device_info: req.headers.get("user-agent") ?? "Unknown device",
      support_email: "support@amwmedia.co.uk",
    };

    if (action === "email_change") {
      templateData.old_email = email;
      templateData.new_email = newEmail;
      templateData.is_old_email = false;
    }

    if (action === "invite") {
      templateData.invite_url = confirmationUrl;
      templateData.inviter_name = user.user_metadata?.full_name ?? "A team member";
      templateData.role = "team member";
    }

    // ── 7. Call send-branded-email ─────────────────────────
    const recipientEmail =
      action === "email_change" ? (newEmail || email) : email;

    const { data: result, error } = await supabase.functions.invoke(
      "send-branded-email",
      {
        body: {
          template_name: templateName,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          org_id: orgId ?? "00000000-0000-0000-0000-000000000000",
          data: templateData,
        },
      },
    );

    if (error) {
      console.error("Failed to send branded auth email:", error);
      return new Response(
        JSON.stringify({ error: `Failed to send: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Auth email sent: action=${action}, to=${recipientEmail}, template=${templateName}`);

    return new Response(
      JSON.stringify({ success: true, message: `Auth email sent for event: ${action}`, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("auth-email-hook error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
