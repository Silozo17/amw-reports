import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { token, month, year, type, startDate, endDate } = await req.json();

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
    const periodType = type ?? "monthly";

    // Build current period query
    let currentQuery = supabase
      .from("monthly_snapshots")
      .select("platform, metrics_data, top_content, report_month, report_year")
      .eq("client_id", client_id);

    let prevMonth = m === 1 ? 12 : m - 1;
    let prevYear = m === 1 ? y - 1 : y;
    let showComparison = periodType === "weekly" || periodType === "monthly" || periodType === "quarterly";

    if (periodType === "quarterly") {
      const qStart = Math.floor((m - 1) / 3) * 3 + 1;
      currentQuery = currentQuery.in("report_month", [qStart, qStart + 1, qStart + 2]).eq("report_year", y);
      // Previous quarter
      const pqDate = new Date(y, m - 1);
      pqDate.setMonth(pqDate.getMonth() - 3);
      prevMonth = pqDate.getMonth() + 1;
      prevYear = pqDate.getFullYear();
    } else if (periodType === "ytd") {
      const currentMonth = now.getMonth() + 1;
      currentQuery = currentQuery.in("report_month", Array.from({ length: currentMonth }, (_, i) => i + 1)).eq("report_year", y);
      showComparison = false;
    } else if (periodType === "last_year") {
      currentQuery = currentQuery.eq("report_year", y);
      showComparison = false;
    } else if (periodType === "maximum") {
      // No filters — get all
      showComparison = false;
    } else if (periodType === "custom" && startDate && endDate) {
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      const sMonth = sDate.getMonth() + 1;
      const sYear = sDate.getFullYear();
      const eMonth = eDate.getMonth() + 1;
      const eYear = eDate.getFullYear();
      if (sYear === eYear) {
        currentQuery = currentQuery.in("report_month", Array.from({ length: eMonth - sMonth + 1 }, (_, i) => sMonth + i)).eq("report_year", sYear);
      } else {
        currentQuery = currentQuery.or(`and(report_year.eq.${sYear},report_month.gte.${sMonth}),and(report_year.gt.${sYear},report_year.lt.${eYear}),and(report_year.eq.${eYear},report_month.lte.${eMonth})`);
      }
      showComparison = false;
    } else {
      // monthly (default)
      currentQuery = currentQuery.eq("report_month", m).eq("report_year", y);
    }

    // 6-month trend window
    const sixMonthsAgo = new Date(y, m - 1);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startTrendMonth = sixMonthsAgo.getMonth() + 1;
    const startTrendYear = sixMonthsAgo.getFullYear();

    // Fetch all data in parallel
    const [clientRes, orgRes, currentRes, prevRes, trendRes, configsRes, connectionsRes] = await Promise.all([
      supabase.from("clients").select("id, company_name, full_name, logo_url, preferred_currency, org_id").eq("id", client_id).single(),
      supabase.from("organisations").select("id, name, logo_url, primary_color, secondary_color, accent_color, heading_font, body_font").eq("id", org_id).single(),
      currentQuery,
      showComparison
        ? supabase.from("monthly_snapshots").select("platform, metrics_data, report_month, report_year").eq("client_id", client_id).eq("report_month", prevMonth).eq("report_year", prevYear)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("monthly_snapshots")
        .select("platform, metrics_data, top_content, report_month, report_year")
        .eq("client_id", client_id)
        .or(`report_year.gt.${startTrendYear},and(report_year.eq.${startTrendYear},report_month.gte.${startTrendMonth})`)
        .order("report_year", { ascending: true })
        .order("report_month", { ascending: true }),
      supabase.from("client_platform_config").select("platform, is_enabled, enabled_metrics").eq("client_id", client_id).eq("is_enabled", true),
      supabase.from("platform_connections").select("platform, last_sync_at, last_sync_status, last_error").eq("client_id", client_id).eq("is_connected", true),
    ]);

    return new Response(JSON.stringify({
      client: clientRes.data,
      org: orgRes.data,
      snapshots: currentRes.data ?? [],
      prevSnapshots: prevRes.data ?? [],
      trendData: trendRes.data ?? [],
      configs: configsRes.data ?? [],
      connections: connectionsRes.data ?? [],
      period: { month: m, year: y, type: periodType },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Portal data error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
