import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "pinterest-connect", method: req.method, connection_id: null }));

  try {
    const { connection_id, redirect_url } = await req.json();

    if (!connection_id) {
      return new Response(
        JSON.stringify({ error: "connection_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: conn, error: connError } = await supabase
      .from("platform_connections")
      .select("id, platform, client_id")
      .eq("id", connection_id)
      .single();

    if (connError || !conn) {
      return new Response(
        JSON.stringify({ error: "Connection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appId = Deno.env.get("PINTEREST_APP_ID")!;
    const redirectUri = `https://reports.amwmedia.co.uk/auth/callback`;

    const state = btoa(
      JSON.stringify({
        connection_id,
        platform: "pinterest",
        redirect_url: redirect_url || "https://reports.amwmedia.co.uk",
      })
    );

    const authUrl = new URL("https://www.pinterest.com/oauth/");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "pins:read,boards:read,user_accounts:read");
    authUrl.searchParams.set("state", state);

    return new Response(
      JSON.stringify({ auth_url: authUrl.toString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
