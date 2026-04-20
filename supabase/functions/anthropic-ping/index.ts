// Minimal isolated test of ANTHROPIC_API_KEY. Calls cheapest model with smallest possible request.
// Returns the raw Anthropic response so we can see exactly what's happening.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Lock to platform admins only — this endpoint calls 4 paid Claude models.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: "unauthorized" }, 401);
  const { data: isAdmin } = await userClient.rpc("is_platform_admin", { _user_id: userData.user.id });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
  }

  const fingerprint = {
    length: apiKey.length,
    prefix: apiKey.slice(0, 12),
    suffix: apiKey.slice(-4),
  };

  const models = [
    "claude-haiku-4-5",
    "claude-3-5-haiku-20241022",
    "claude-3-5-sonnet-20241022",
    "claude-sonnet-4-5-20250929",
  ];

  const results: Array<Record<string, unknown>> = [];

  for (const model of models) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 5,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      const requestId = res.headers.get("request-id") ?? res.headers.get("x-request-id") ?? "n/a";
      const text = await res.text();
      let parsed: unknown = null;
      try { parsed = JSON.parse(text); } catch { /* keep raw */ }
      results.push({
        model,
        status: res.status,
        request_id: requestId,
        ok: res.ok,
        body_preview: text.slice(0, 400),
        error: (parsed as { error?: { type?: string; message?: string } })?.error ?? null,
      });
    } catch (e) {
      results.push({
        model,
        error: e instanceof Error ? e.message : "fetch failed",
      });
    }
  }

  return json({ fingerprint, results });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
