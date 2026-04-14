import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cron-only function — no CORS needed

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "monthly-digest", method: req.method, connection_id: null }));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-12
    const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const MONTH_NAMES = [
      "", "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];

    // Fetch all orgs with active subs and digest enabled
    const { data: orgs } = await supabase
      .from("organisations")
      .select("id, name, digest_enabled")
      .eq("digest_enabled", true);

    if (!orgs || orgs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No orgs with digest enabled", sent: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ org_id: string; success: boolean; error?: string }> = [];

    for (const org of orgs) {
      try {
        // Get org owner email
        const { data: owner } = await supabase
          .from("org_members")
          .select("user_id")
          .eq("org_id", org.id)
          .eq("role", "owner")
          .limit(1)
          .maybeSingle();

        if (!owner?.user_id) continue;

        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", owner.user_id)
          .maybeSingle();

        if (!profile?.email) continue;

        // Gather stats for last month
        const [reportsRes, syncsRes, failedConnsRes, clientsRes] = await Promise.all([
          supabase
            .from("reports")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org.id)
            .eq("report_month", lastMonth)
            .eq("report_year", lastMonthYear)
            .eq("status", "success"),
          supabase
            .from("sync_logs")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org.id)
            .eq("report_month", lastMonth)
            .eq("report_year", lastMonthYear),
          supabase
            .from("platform_connections")
            .select("id, platform, clients!inner(org_id)")
            .eq("clients.org_id", org.id)
            .eq("is_connected", true)
            .eq("last_sync_status", "failed"),
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org.id)
            .eq("is_active", true),
        ]);

        const reportCount = reportsRes.count ?? 0;
        const syncCount = syncsRes.count ?? 0;
        const failedConnections = failedConnsRes.data?.length ?? 0;
        const activeClients = clientsRes.count ?? 0;

        // Count emails sent last month
        const monthStart = new Date(lastMonthYear, lastMonth - 1, 1).toISOString();
        const monthEnd = new Date(lastMonthYear, lastMonth, 1).toISOString();
        const { count: emailsSent } = await supabase
          .from("email_logs")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org.id)
          .eq("status", "sent")
          .gte("sent_at", monthStart)
          .lt("sent_at", monthEnd);

        await supabase.functions.invoke("send-branded-email", {
          body: {
            template_name: "monthly_digest",
            recipient_email: profile.email,
            recipient_name: profile.full_name,
            org_id: org.id,
            data: {
              month_name: MONTH_NAMES[lastMonth],
              year: lastMonthYear,
              reports_generated: reportCount,
              syncs_completed: syncCount,
              failed_connections: failedConnections,
              active_clients: activeClients,
              emails_sent: emailsSent ?? 0,
            },
          },
        });

        results.push({ org_id: org.id, success: true });
      } catch (e) {
        results.push({ org_id: org.id, success: false, error: String(e) });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Digest sent to ${results.filter(r => r.success).length}/${results.length} orgs`,
        results,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("monthly-digest error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
