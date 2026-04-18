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

  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "verify-domain", method: req.method }));

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { domain_id } = await req.json();
    if (!domain_id) {
      return new Response(JSON.stringify({ error: "domain_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: domainRecord, error: fetchErr } = await supabase
      .from("custom_domains")
      .select("*")
      .eq("id", domain_id)
      .single();

    if (fetchErr || !domainRecord) {
      return new Response(JSON.stringify({ error: "Domain not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const domain = domainRecord.domain;
    const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN")!;
    const cfZoneId = Deno.env.get("CLOUDFLARE_ZONE_ID")!;

    if (!cfToken || !cfZoneId) {
      return new Response(JSON.stringify({ error: "Cloudflare not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if custom hostname already exists in Cloudflare
    const listRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/custom_hostnames?hostname=${domain}`,
      { headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" } }
    );
    const listData = await listRes.json();
    let cfHostname = listData.result?.[0];

    // Create if it doesn't exist
    if (!cfHostname) {
      const createRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/custom_hostnames`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            hostname: domain,
            ssl: {
              method: "http",
              type: "dv",
              settings: { min_tls_version: "1.2" }
            },
          }),
        }
      );
      const createData = await createRes.json();
      if (!createRes.ok || !createData.success) {
        return new Response(
          JSON.stringify({ 
            error: createData.errors?.[0]?.message || 
            "Failed to register domain with Cloudflare" 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      cfHostname = createData.result;
    }

    const status = cfHostname.status;
    const sslStatus = cfHostname.ssl?.status;
    const verified = status === "active" && sslStatus === "active";

    if (verified) {
      await supabase
        .from("custom_domains")
        .update({ verified_at: new Date().toISOString(), is_active: true })
        .eq("id", domain_id);

      return new Response(
        JSON.stringify({ success: true, status: "verified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        status: "pending",
        cf_status: status,
        ssl_status: sslStatus,
        message: `Domain registered with Cloudflare. Status: ${status}, SSL: ${sslStatus}. Keep the CNAME pointed to clients.amwreports.com and click Verify again in 2-5 minutes.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
