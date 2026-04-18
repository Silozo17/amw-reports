import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { domain } = await req.json();
    if (!domain) {
      return new Response(JSON.stringify({ error: "domain is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN")!;
    const cfZoneId = Deno.env.get("CLOUDFLARE_ZONE_ID")!;

    // Find the custom hostname ID in Cloudflare
    const listRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/custom_hostnames?hostname=${domain}`,
      { headers: { Authorization: `Bearer ${cfToken}` } }
    );
    const listData = await listRes.json();
    const cfHostname = listData.result?.[0];

    if (cfHostname?.id) {
      await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/custom_hostnames/${cfHostname.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${cfToken}` }
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
