import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cron-only function — sends monthly digest to active Content Lab orgs
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    fn: "content-lab-monthly-digest",
    method: req.method,
    connection_id: null,
  }));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const MONTH_NAMES = [
      "", "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const now = new Date();
    const monthName = MONTH_NAMES[now.getMonth() === 0 ? 12 : now.getMonth()];

    // Find active Content Lab niches (org has subscription with content_lab_tier)
    const { data: niches } = await supabase
      .from("content_lab_niches")
      .select("id, label, org_id, organisations!inner(id,name)")
      .order("created_at", { ascending: false });

    if (!niches || niches.length === 0) {
      return new Response(JSON.stringify({ message: "No niches", sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // De-dupe by org — pick most recent niche per org
    const seenOrgs = new Set<string>();
    const targets: Array<{ niche_id: string; niche_label: string; org_id: string }> = [];
    for (const n of niches) {
      if (seenOrgs.has(n.org_id)) continue;
      seenOrgs.add(n.org_id);
      targets.push({ niche_id: n.id, niche_label: n.label, org_id: n.org_id });
    }

    const results: Array<{ org_id: string; success: boolean; error?: string }> = [];
    const lapsedSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    for (const t of targets) {
      try {
        // Confirm org has active CL subscription
        const { data: sub } = await supabase
          .from("org_subscriptions")
          .select("content_lab_tier, status")
          .eq("org_id", t.org_id)
          .eq("status", "active")
          .maybeSingle();
        if (!sub?.content_lab_tier || sub.content_lab_tier === "none") continue;

        // Latest completed run for this niche
        const { data: latestRun } = await supabase
          .from("content_lab_runs")
          .select("id, completed_at, created_at")
          .eq("niche_id", t.niche_id)
          .in("status", ["completed", "completed_empty"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const isLapsed = !latestRun || latestRun.created_at < lapsedSince;

        // Top 5 benchmark posts from this run (or fallback empty)
        let topPosts: Array<{ author_handle: string; views: number; engagement_rate: number; post_url: string | null }> = [];
        if (latestRun) {
          const { data: posts } = await supabase
            .from("content_lab_posts")
            .select("author_handle, views, engagement_rate, post_url")
            .eq("run_id", latestRun.id)
            .eq("bucket", "benchmark")
            .order("engagement_rate", { ascending: false })
            .limit(5);
          topPosts = posts ?? [];
        }

        // Resolve org owner email
        const { data: owner } = await supabase
          .from("org_members")
          .select("user_id")
          .eq("org_id", t.org_id)
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

        await supabase.functions.invoke("send-branded-email", {
          body: {
            template_name: "content_lab_monthly_digest",
            recipient_email: profile.email,
            recipient_name: profile.full_name,
            org_id: t.org_id,
            data: {
              month_name: monthName,
              niche_label: t.niche_label,
              top_posts: topPosts,
              is_lapsed: isLapsed,
              run_id: latestRun?.id ?? null,
            },
          },
        });

        results.push({ org_id: t.org_id, success: true });
      } catch (e) {
        results.push({ org_id: t.org_id, success: false, error: String(e) });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Digest sent to ${results.filter((r) => r.success).length}/${results.length} orgs`,
        results,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("content-lab-monthly-digest error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
