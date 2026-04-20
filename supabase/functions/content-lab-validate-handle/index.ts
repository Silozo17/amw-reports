// Content Lab — live handle validation proxy (used by onboarding step 4)
// Returns { exists, follower_count, display_name } via Apify cheap profile call.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface ValidateBody {
  handle: string;
  platform: "instagram" | "tiktok" | "facebook";
}

const log = (level: string, msg: string, extra?: Record<string, unknown>) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-validate-handle", level, msg, ...extra }));

function cleanHandle(h: string): string {
  return h.trim().replace(/^@/, "").replace(/^https?:\/\/[^/]+\//, "").replace(/\/.*$/, "");
}

async function runApify(actorId: string, input: Record<string, unknown>): Promise<unknown> {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=25`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`apify ${res.status}`);
  return await res.json();
}

async function validateInstagram(handle: string) {
  const items = (await runApify("apify/instagram-profile-scraper", {
    usernames: [handle],
  })) as Array<{ username?: string; fullName?: string; followersCount?: number }>;
  const p = items?.[0];
  if (!p?.username) return { exists: false, follower_count: null, display_name: null };
  return {
    exists: true,
    follower_count: p.followersCount ?? null,
    display_name: p.fullName ?? p.username,
  };
}

async function validateTikTok(handle: string) {
  const items = (await runApify("clockworks/tiktok-profile-scraper", {
    profiles: [handle],
    resultsPerPage: 1,
  })) as Array<{ authorMeta?: { name?: string; nickName?: string; fans?: number } }>;
  const a = items?.[0]?.authorMeta;
  if (!a?.name) return { exists: false, follower_count: null, display_name: null };
  return { exists: true, follower_count: a.fans ?? null, display_name: a.nickName ?? a.name };
}

async function validateFacebook(handle: string) {
  // Facebook profile metadata is unreliable via Apify free actors — return permissive amber.
  return { exists: true, follower_count: null, display_name: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  log("info", "request", { method: req.method });

  try {
    // Auth
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing auth" }, 401);
    const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userRes } = await supa.auth.getUser(auth.replace("Bearer ", ""));
    if (!userRes?.user) return json({ error: "Unauthenticated" }, 401);

    const body = (await req.json()) as Partial<ValidateBody>;
    const handle = body.handle ? cleanHandle(body.handle) : "";
    const platform = body.platform;
    if (!handle || !["instagram", "tiktok", "facebook"].includes(platform ?? "")) {
      return json({ error: "Invalid body" }, 400);
    }

    let result;
    if (platform === "instagram") result = await validateInstagram(handle);
    else if (platform === "tiktok") result = await validateTikTok(handle);
    else result = await validateFacebook(handle);

    return json(result, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", "validate_failed", { msg });
    // Soft-fail: amber state on the client, never hard-block onboarding
    return json({ exists: true, follower_count: null, display_name: null, soft_error: msg }, 200);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
