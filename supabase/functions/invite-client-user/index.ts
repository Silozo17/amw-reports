import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify calling user is an org member
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, email } = await req.json();
    if (!client_id || !email) {
      return new Response(
        JSON.stringify({ error: "client_id and email are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch the client to get org_id and verify user belongs to org
    const { data: client, error: clientErr } = await supabaseAdmin
      .from("clients")
      .select("org_id, company_name")
      .eq("id", client_id)
      .single();

    if (clientErr || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check the calling user belongs to this org
    const { data: membership } = await supabaseAdmin
      .from("org_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("org_id", client.org_id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this email already has a client_user for this client
    const { data: existing } = await supabaseAdmin
      .from("client_users")
      .select("id")
      .eq("client_id", client_id)
      .eq("invited_email", email.toLowerCase())
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "This email has already been invited" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate magic link for the email
    const redirectTo = `${req.headers.get("origin") || supabaseUrl}/client-portal`;
    const { data: linkData, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: email.toLowerCase(),
        options: { redirectTo },
      });

    if (linkErr) {
      console.error("Generate link error:", linkErr);
      return new Response(
        JSON.stringify({ error: "Failed to generate magic link" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get or create the user_id from the link response
    const invitedUserId = linkData.user?.id;
    const magicLink = linkData.properties?.action_link;

    if (!invitedUserId) {
      return new Response(
        JSON.stringify({ error: "Failed to resolve user" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert client_users record
    const { error: insertErr } = await supabaseAdmin
      .from("client_users")
      .insert({
        user_id: invitedUserId,
        client_id,
        org_id: client.org_id,
        invited_by: user.id,
        invited_email: email.toLowerCase(),
      });

    if (insertErr) {
      console.error("Insert client_user error:", insertErr);
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send the invite email via the branded email system
    try {
      await supabaseAdmin.functions.invoke("send-branded-email", {
        body: {
          template_name: "client_invite",
          recipient_email: email.toLowerCase(),
          org_id: client.org_id,
          data: {
            magic_link: magicLink,
            client_name: client.company_name,
            redirect_url: redirectTo,
          },
        },
      });
    } catch (emailErr) {
      console.error("Failed to send invite email:", emailErr);
      // Don't fail the whole invite — the client_user record was created
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation sent to ${email}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
