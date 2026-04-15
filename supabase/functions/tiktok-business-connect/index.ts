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

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "tiktok-business-connect", method: req.method, connection_id: null }));

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

    const appId = Deno.env.get("TIKTOK_BUSINESS_APP_ID");
    const appSecret = Deno.env.get("TIKTOK_BUSINESS_APP_SECRET");

    if (!appId || !appSecret) {
      console.error("Missing TikTok Business API credentials. TIKTOK_BUSINESS_APP_ID set:", !!appId, "TIKTOK_BUSINESS_APP_SECRET set:", !!appSecret);
      return new Response(
        JSON.stringify({
          error: "TikTok Business API credentials are not configured. Ensure TIKTOK_BUSINESS_APP_ID and TIKTOK_BUSINESS_APP_SECRET are set as secrets.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const redirectUri = `https://reports.amwmedia.co.uk/auth/callback`;

    const state = btoa(
      JSON.stringify({
        connection_id,
        platform: "tiktok_ads",
        redirect_url: redirect_url || "https://reports.amwmedia.co.uk",
      })
    );

    // TikTok Business API authorization URL
    const authUrl = new URL("https://business-api.tiktok.com/portal/auth");
    authUrl.searchParams.set("app_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    console.log("TikTok Business OAuth URL generated. app_id length:", appId.length, "redirect_uri:", redirectUri);

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
