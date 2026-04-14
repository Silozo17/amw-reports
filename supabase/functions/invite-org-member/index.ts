import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/* ═══════════════════════════════════════════════════════════
   INVITE-ORG-MEMBER — centralised org invitation handler
   Creates the org_members row AND sends the branded email
   atomically from the server side, so the invite_url is
   always generated in one trusted place.
   ═══════════════════════════════════════════════════════════ */

interface InviteRequest {
  org_id: string;
  email: string;
  role: string;
  inviter_name?: string;
  origin: string; // e.g. "https://amw-reports.lovable.app"
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "invite-org-member", method: req.method, connection_id: null }));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as InviteRequest;
    const { org_id, role, inviter_name, origin } = body;
    const email = (body.email ?? "").trim().toLowerCase();

    if (!org_id || !email || !origin) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: org_id, email, origin" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller belongs to the org
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "You are not a member of this organisation" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already exists in profiles
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      // Link existing user directly
      const { error: insertError } = await supabase.from("org_members").insert({
        org_id,
        user_id: existingProfile.user_id,
        role: role || "manager",
        accepted_at: new Date().toISOString(),
      });

      if (insertError) {
        const msg = insertError.message.includes("unique")
          ? "This user is already a member of this organisation"
          : insertError.message;
        return new Response(JSON.stringify({ error: msg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update their profile org_id
      await supabase.from("profiles").update({ org_id }).eq("user_id", existingProfile.user_id);

      return new Response(
        JSON.stringify({ success: true, status: "linked", message: "Existing user linked to organisation" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // New user — create pending invite row
    const { error: insertError } = await supabase.from("org_members").insert({
      org_id,
      invited_email: email,
      role: role || "manager",
      invited_at: new Date().toISOString(),
    });

    if (insertError) {
      const msg = insertError.message.includes("unique")
        ? "This email has already been invited"
        : insertError.message;
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the invite URL on the server — single source of truth
    const inviteUrl = `${origin}/login?view=signup&invited_email=${encodeURIComponent(email)}`;

    // Send the branded email
    const { data: emailResult, error: emailError } = await supabase.functions.invoke(
      "send-branded-email",
      {
        body: {
          template_name: "team_invitation",
          recipient_email: email,
          org_id,
          data: {
            invited_email: email,
            role: role || "manager",
            inviter_name: inviter_name || "A team member",
            invite_url: inviteUrl,
          },
        },
      }
    );

    if (emailError) {
      console.error("Failed to send invite email:", emailError);
      // Row was created but email failed — inform caller
      return new Response(
        JSON.stringify({
          success: true,
          status: "invited_email_failed",
          message: "Invite created but email failed to send. You can resend later.",
          emailError: String(emailError),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, status: "invited", message: `Invite sent to ${email}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("invite-org-member error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
