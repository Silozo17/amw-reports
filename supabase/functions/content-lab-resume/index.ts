// content-lab-resume: re-runs analyse + ideate on an existing run that already has
// scraped posts, OR (when rescrape=true) wipes posts and starts fresh from scrape.
// Hands off to content-lab-step-runner using mode="resume" or mode="rescrape" so the
// state machine handles the actual stepwise execution.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-resume", method: req.method }));

  try {
    const { run_id, rescrape } = await req.json().catch(() => ({}));
    if (!run_id) return json({ error: "run_id is required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: run } = await admin
      .from("content_lab_runs").select("id, org_id, status, niche_id").eq("id", run_id).single();
    if (!run) return json({ error: "Run not found" }, 404);

    // Org-membership check: caller must belong to the run's org.
    const { data: membership } = await admin
      .from("org_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("org_id", (run as { org_id: string }).org_id)
      .maybeSingle();
    if (!membership) return json({ error: "Forbidden" }, 403);

    const { data: niche } = await admin
      .from("content_lab_niches").select("platforms_to_scrape").eq("id", run.niche_id).single();
    const targetPlatforms: string[] = (niche?.platforms_to_scrape ?? ["instagram"]) as string[];

    const { data: postRows } = await admin
      .from("content_lab_posts").select("platform").eq("run_id", run_id);
    const hasPosts = !!(postRows && postRows.length > 0);

    if (!rescrape && !hasPosts) {
      return json({ error: "Run has no posts to resume from — start a fresh run instead." }, 400);
    }

    if (!rescrape && hasPosts) {
      const availablePlatforms = new Set(postRows!.map((p) => p.platform));
      const missing = targetPlatforms.filter((p) => !availablePlatforms.has(p));
      if (missing.length > 0) {
        return json({
          error: `Cannot resume: niche targets [${targetPlatforms.join(", ")}] but run only has posts for [${[...availablePlatforms].join(", ")}]. Missing: ${missing.join(", ")}. Edit the niche or start a fresh run.`,
        }, 400);
      }
    }

    // Reset to a clean active state and hand off.
    const startStatus = rescrape ? "pending" : "analysing";
    await admin.from("content_lab_runs").update({
      status: startStatus,
      error_message: null,
      completed_at: null,
      summary: {},
      updated_at: new Date().toISOString(),
    }).eq("id", run_id);

    await admin.from("content_lab_ideas").delete().eq("run_id", run_id);

    await fetch(`${SUPABASE_URL}/functions/v1/content-lab-step-runner`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ run_id, mode: rescrape ? "rescrape" : "resume" }),
    }).catch((e) => console.error("step-runner kick failed:", e));

    return json({
      ok: true, run_id, post_count: postRows?.length ?? 0,
      rescrape: rescrape === true,
    }, 202);
  } catch (e) {
    console.error("content-lab-resume error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
