import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user from JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { domain_id } = await req.json();
    if (!domain_id) {
      return new Response(JSON.stringify({ error: "domain_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the domain record
    const { data: domainRecord, error: fetchErr } = await supabase
      .from("custom_domains")
      .select("*")
      .eq("id", domain_id)
      .single();

    if (fetchErr || !domainRecord) {
      return new Response(JSON.stringify({ error: "Domain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const domain = domainRecord.domain;
    const expectedToken = domainRecord.verification_token;

    // Perform DNS TXT lookup using Google DNS-over-HTTPS
    const dnsUrl = `https://dns.google/resolve?name=_amw-verify.${domain}&type=TXT`;
    const dnsRes = await fetch(dnsUrl);
    const dnsData = await dnsRes.json();

    let verified = false;

    if (dnsData.Answer) {
      for (const answer of dnsData.Answer) {
        // TXT records come wrapped in quotes
        const value = (answer.data || "").replace(/"/g, "").trim();
        if (value === `amw-verify=${expectedToken}`) {
          verified = true;
          break;
        }
      }
    }

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
        status: "not_found",
        message: `TXT record _amw-verify.${domain} with value "amw-verify=${expectedToken}" not found. DNS propagation can take up to 48 hours.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
