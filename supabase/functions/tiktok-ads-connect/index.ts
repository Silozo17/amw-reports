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

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "tiktok-ads-connect", method: req.method, connection_id: null }));

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

    const clientKey = Deno.env.get("TIKTOK_APP_ID");
    const clientSecret = Deno.env.get("TIKTOK_APP_SECRET");

    if (!clientKey || !clientSecret) {
      console.error("Missing TikTok credentials. TIKTOK_APP_ID set:", !!clientKey, "TIKTOK_APP_SECRET set:", !!clientSecret);
      return new Response(
        JSON.stringify({
          error: "TikTok Login Kit credentials are not configured. Ensure TIKTOK_APP_ID (client_key) and TIKTOK_APP_SECRET are set as secrets. These must be the Login Kit credentials from the TikTok Developer Portal, not the Business/Advertiser API credentials.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const redirectUri = `https://reports.amwmedia.co.uk/auth/callback`;

    const state = btoa(
      JSON.stringify({
        connection_id,
        platform: "tiktok_ads",
        redirect_url: redirect_url || "https://amw-reports.lovable.app",
      })
    );

    const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
    authUrl.searchParams.set("client_key", clientKey);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "user.info.basic,user.info.profile,user.info.stats,video.list");
    authUrl.searchParams.set("state", state);

    console.log("TikTok OAuth URL generated. client_key length:", clientKey.length, "redirect_uri:", redirectUri);

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
