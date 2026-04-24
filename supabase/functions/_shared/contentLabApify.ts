// Shared Apify helper with a 5-slot semaphore so we never hit
// the 402 actor-memory-limit-exceeded error from running too many actors at once.

const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN") ?? "";
const APIFY_BASE = "https://api.apify.com/v2";
const MAX_CONCURRENT = 5;

let active = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active += 1;
}

function release(): void {
  active -= 1;
  const next = waiters.shift();
  if (next) next();
}

export interface ApifyRunOptions {
  actor: string; // e.g. "apify~instagram-scraper"
  input: Record<string, unknown>;
  timeoutSec?: number; // default 90
  maxItems?: number; // default 50
}

export interface ApifyRunResult<T> {
  ok: boolean;
  items: T[];
  error?: string;
  status?: number;
}

export async function runApifyActor<T = Record<string, unknown>>(
  opts: ApifyRunOptions,
): Promise<ApifyRunResult<T>> {
  if (!APIFY_TOKEN) {
    return { ok: false, items: [], error: "APIFY_TOKEN missing" };
  }
  await acquire();
  try {
    const actor = opts.actor.replace("/", "~");
    const url = `${APIFY_BASE}/acts/${actor}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=${opts.timeoutSec ?? 90}&memory=512`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts.input),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, items: [], error: text.slice(0, 500), status: res.status };
    }
    let parsed: unknown = [];
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, items: [], error: "Invalid JSON from Apify" };
    }
    const arr = Array.isArray(parsed) ? parsed : [];
    const limited = opts.maxItems ? arr.slice(0, opts.maxItems) : arr;
    return { ok: true, items: limited as T[] };
  } catch (e) {
    return { ok: false, items: [], error: e instanceof Error ? e.message : String(e) };
  } finally {
    release();
  }
}

// Pre-filter handles by platform regex. Returns valid handles only.
export function preFilterHandle(platform: string, handle: string): boolean {
  const h = handle.replace(/^@/, "").trim();
  if (!h) return false;
  if (/\s|&|\bltd\b|\blimited\b/i.test(h)) return false;
  if (platform === "instagram") return /^[A-Za-z0-9._]{1,30}$/.test(h);
  if (platform === "tiktok") return /^[A-Za-z0-9._]{2,24}$/.test(h);
  if (platform === "facebook") return /^[A-Za-z0-9.\-]{5,50}$/.test(h);
  return /^[A-Za-z0-9._\-]{2,50}$/.test(h);
}
