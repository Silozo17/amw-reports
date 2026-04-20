// content-lab-notify-complete: sends a branded completion email when a Content Lab
// run finishes. Resolves recipient via run.triggered_by → profiles.email. No-op if
// email_on_complete is false on the run.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_BASE_URL = Deno.env.get("PUBLIC_APP_URL") ?? "https://amwreports.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-notify-complete", method: req.method }));

  try {
    const { run_id } = await req.json();
    if (!run_id) return json({ error: "run_id is required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: run, error } = await admin
      .from("content_lab_runs")
      .select("id, status, org_id, client_id, niche_id, triggered_by, email_on_complete")
      .eq("id", run_id).single();
    if (error || !run) return json({ error: "Run not found" }, 404);
    if (!(run as { email_on_complete?: boolean }).email_on_complete) {
      return json({ ok: true, skipped: "email_on_complete=false" });
    }
    if ((run as { status: string }).status !== "completed") {
      return json({ ok: true, skipped: `status=${(run as { status: string }).status}` });
    }

    const triggeredBy = (run as { triggered_by?: string | null }).triggered_by;
    if (!triggeredBy) return json({ ok: true, skipped: "no triggered_by user" });

    const { data: profile } = await admin
      .from("profiles").select("email, full_name").eq("user_id", triggeredBy).maybeSingle();
    const email = (profile as { email?: string | null } | null)?.email;
    if (!email) return json({ ok: true, skipped: "no email on profile" });

    const { data: niche } = await admin
      .from("content_lab_niches").select("label").eq("id", (run as { niche_id: string }).niche_id).maybeSingle();

    const { count: ideaCount } = await admin
      .from("content_lab_ideas")
      .select("id", { count: "exact", head: true })
      .eq("run_id", run_id);

    // De-dupe: only send once per run.
    const { data: existingNote } = await admin
      .from("notification_tracking")
      .select("id")
      .eq("notification_type", "content_lab_run_complete")
      .eq("reference_id", run_id)
      .maybeSingle();
    if (existingNote) return json({ ok: true, skipped: "already sent" });

    const reportUrl = `${APP_BASE_URL}/content-lab/run/${run_id}`;

    const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-branded-email`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_name: "content_lab_run_complete",
        recipient_email: email,
        recipient_name: (profile as { full_name?: string } | null)?.full_name ?? null,
        org_id: (run as { org_id: string }).org_id,
        client_id: (run as { client_id: string }).client_id ?? null,
        data: {
          niche_label: (niche as { label?: string } | null)?.label ?? "your niche",
          idea_count: ideaCount ?? 0,
          report_url: reportUrl,
        },
      }),
    });

    const sendBody = await sendRes.text().catch(() => "");
    if (!sendRes.ok) {
      console.error("notify-complete send failed:", sendRes.status, sendBody);
      return json({ ok: false, error: `send failed: ${sendRes.status}` }, 200);
    }

    await admin.from("notification_tracking").insert({
      notification_type: "content_lab_run_complete",
      reference_id: run_id,
    });

    return json({ ok: true, sent_to: email });
  } catch (e) {
    console.error("content-lab-notify-complete error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
