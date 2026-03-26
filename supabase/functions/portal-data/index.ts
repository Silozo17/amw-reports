import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { token, month, year } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token
    const { data: tokenData, error: tokenErr } = await supabase
      .from("client_share_tokens")
      .select("client_id, org_id, is_active, expires_at")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (tokenErr || !tokenData) {
      return new Response(JSON.stringify({ error: "Invalid or expired link" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This link has expired" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, org_id } = tokenData;

    // Determine period
    const now = new Date();
    const m = month ?? (now.getMonth() === 0 ? 12 : now.getMonth());
    const y = year ?? (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());

    // Fetch all data in parallel
    const [clientRes, orgRes, snapshotsRes, prevSnapshotsRes, configsRes, connectionsRes] = await Promise.all([
      supabase.from("clients").select("id, company_name, full_name, logo_url, preferred_currency, org_id").eq("id", client_id).single(),
      supabase.from("organisations").select("id, name, logo_url, primary_color, secondary_color, accent_color, heading_font, body_font").eq("id", org_id).single(),
      supabase.from("monthly_snapshots").select("platform, metrics_data, top_content, report_month, report_year").eq("client_id", client_id).eq("report_month", m).eq("report_year", y),
      supabase.from("monthly_snapshots").select("platform, metrics_data, top_content, report_month, report_year").eq("client_id", client_id)
        .eq("report_month", m === 1 ? 12 : m - 1).eq("report_year", m === 1 ? y - 1 : y),
      supabase.from("client_platform_config").select("platform, is_enabled, enabled_metrics").eq("client_id", client_id).eq("is_enabled", true),
      supabase.from("platform_connections").select("platform, last_sync_at, last_sync_status, last_error").eq("client_id", client_id).eq("is_connected", true),
    ]);

    // Also fetch 6 months trend data
    const trendMonths = [];
    let tm = m, ty = y;
    for (let i = 0; i < 6; i++) {
      trendMonths.push({ m: tm, y: ty });
      tm--;
      if (tm === 0) { tm = 12; ty--; }
    }

    const { data: trendData } = await supabase
      .from("monthly_snapshots")
      .select("platform, metrics_data, report_month, report_year")
      .eq("client_id", client_id)
      .gte("report_year", trendMonths[trendMonths.length - 1].y)
      .lte("report_year", y);

    return new Response(JSON.stringify({
      client: clientRes.data,
      org: orgRes.data,
      snapshots: snapshotsRes.data ?? [],
      prevSnapshots: prevSnapshotsRes.data ?? [],
      trendData: trendData ?? [],
      configs: configsRes.data ?? [],
      connections: connectionsRes.data ?? [],
      period: { month: m, year: y },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Portal data error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
