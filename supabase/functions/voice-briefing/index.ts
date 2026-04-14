import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const RATE_LIMIT_HOURS = 24;
const SYNC_COOLDOWN_HOURS = 1;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authenticateUser(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

async function verifyAccess(supabase: ReturnType<typeof createClient>, callerId: string, clientId: string) {
  const { data: clientOwner } = await supabase.from("clients").select("org_id").eq("id", clientId).single();
  if (!clientOwner) return null;

  const [membershipRes, clientUserRes, platformAdminRes] = await Promise.all([
    supabase.from("org_members").select("id").eq("user_id", callerId).eq("org_id", clientOwner.org_id).limit(1).maybeSingle(),
    supabase.from("client_users").select("id").eq("user_id", callerId).eq("client_id", clientId).limit(1).maybeSingle(),
    supabase.from("platform_admins").select("id").eq("user_id", callerId).limit(1).maybeSingle(),
  ]);

  const hasAccess = membershipRes.data || clientUserRes.data || platformAdminRes.data;
  return hasAccess ? clientOwner.org_id : null;
}

function canRegenerate(generatedAt: string, lastSyncAt: string | null): { allowed: boolean; retryAfter?: string } {
  const genTime = new Date(generatedAt).getTime();
  const now = Date.now();

  // If older than 24h, always allow
  if (now - genTime > RATE_LIMIT_HOURS * 3600 * 1000) return { allowed: true };

  // If a sync happened after generation, allow 1h after the sync
  if (lastSyncAt) {
    const syncTime = new Date(lastSyncAt).getTime();
    if (syncTime > genTime) {
      const cooldownEnd = syncTime + SYNC_COOLDOWN_HOURS * 3600 * 1000;
      if (now >= cooldownEnd) return { allowed: true };
      return { allowed: false, retryAfter: new Date(cooldownEnd).toISOString() };
    }
  }

  // Otherwise, wait until 24h after generation
  const retryAfter = new Date(genTime + RATE_LIMIT_HOURS * 3600 * 1000).toISOString();
  return { allowed: false, retryAfter };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const callerId = await authenticateUser(req, supabase);
    if (!callerId) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { client_id, month, year, check_existing } = body;

    if (!client_id || !month || !year) {
      return jsonResponse({ error: "Missing client_id, month, or year" }, 400);
    }

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "voice-briefing", method: req.method, connection_id: null }));

    const orgId = await verifyAccess(supabase, callerId, client_id);
    if (!orgId) return jsonResponse({ error: "Forbidden" }, 403);

    // ── Check for existing recording ──
    const { data: existing } = await supabase
      .from("voice_briefings")
      .select("id, storage_path, generated_at")
      .eq("client_id", client_id)
      .eq("report_month", month)
      .eq("report_year", year)
      .maybeSingle();

    // If just checking existence, return metadata
    if (check_existing) {
      if (!existing) return jsonResponse({ exists: false }, 200);

      // Generate a signed URL for playback
      const { data: signedUrl } = await supabase.storage
        .from("reports")
        .createSignedUrl(existing.storage_path, 3600);

      return jsonResponse({
        exists: true,
        generated_at: existing.generated_at,
        signed_url: signedUrl?.signedUrl || null,
      }, 200);
    }

    // ── Rate limiting ──
    if (existing) {
      // Get last sync time for this client
      const { data: lastSync } = await supabase
        .from("sync_logs")
        .select("completed_at")
        .eq("client_id", client_id)
        .eq("status", "success")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const rateCheck = canRegenerate(existing.generated_at, lastSync?.completed_at || null);
      if (!rateCheck.allowed) {
        return jsonResponse({
          error: "Voice briefing already generated recently. Try again later.",
          retry_after: rateCheck.retryAfter,
        }, 429);
      }
    }

    // ── Validate config ──
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI not configured" }, 500);
    if (!ELEVENLABS_API_KEY) return jsonResponse({ error: "Voice feature not configured. Please add an ElevenLabs API key." }, 500);

    // ── Fetch data ──
    const [clientRes, snapshotsRes, prevSnapshotsRes] = await Promise.all([
      supabase.from("clients").select("company_name, preferred_currency, industry, target_audience, service_area_type, service_areas, business_goals").eq("id", client_id).single(),
      supabase.from("monthly_snapshots").select("platform, metrics_data").eq("client_id", client_id).eq("report_month", month).eq("report_year", year),
      supabase.from("monthly_snapshots").select("platform, metrics_data")
        .eq("client_id", client_id)
        .eq("report_month", month === 1 ? 12 : month - 1)
        .eq("report_year", month === 1 ? year - 1 : year),
    ]);

    const clientName = clientRes.data?.company_name || "your business";
    const preferredCurrency = clientRes.data?.preferred_currency || "GBP";
    const snapshots = snapshotsRes.data ?? [];
    const prevSnapshots = prevSnapshotsRes.data ?? [];

    if (snapshots.length === 0) {
      return jsonResponse({ error: "No data available for this period" }, 400);
    }

    const dataContext = JSON.stringify({
      current: snapshots.map((s: Record<string, unknown>) => ({ platform: s.platform, metrics: s.metrics_data })),
      previous: prevSnapshots.map((s: Record<string, unknown>) => ({ platform: s.platform, metrics: s.metrics_data })),
    });

    // ── Step 1: Generate script via AI ──
    const scriptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{
          role: "user",
          content: `Write a 200-word conversational voice briefing script for ${clientName}'s marketing performance in ${MONTH_NAMES[month]} ${year}.

The client's currency is ${preferredCurrency}. Always use ${preferredCurrency} when mentioning any monetary values. Never use USD or dollars unless ${preferredCurrency} is USD.
${clientRes.data?.industry ? `\nIndustry: ${clientRes.data.industry}` : ''}${clientRes.data?.target_audience ? `\nTarget Audience: ${clientRes.data.target_audience}` : ''}${clientRes.data?.service_area_type ? `\nService Area: ${clientRes.data.service_area_type}${clientRes.data?.service_areas ? ` (${clientRes.data.service_areas})` : ''}` : ''}${clientRes.data?.business_goals ? `\nBusiness Goals: ${clientRes.data.business_goals}` : ''}

Tone: Professional but warm, like a trusted marketing advisor giving a quick morning update.

Structure:
- Start with "Here's your marketing update for ${MONTH_NAMES[month]}."
- Cover the 2-3 most important things happening across their platforms
- Mention specific numbers and month-over-month changes
- End with one clear recommendation or thing to watch, tailored to their industry and goals if available

Rules:
- Write for speech, not reading — use short sentences and natural pauses
- No bullet points or formatting — just flowing speech
- Use "your" not "the client's"
- Round numbers naturally (say "about twelve hundred" not "1,247")
- Never use marketing jargon without explaining it
- If business context is available, reference their industry and goals naturally

Data: ${dataContext}`
        }],
        max_tokens: 500,
      }),
    });

    if (!scriptResponse.ok) {
      console.error("Script generation failed:", scriptResponse.status);
      return jsonResponse({ error: "Failed to generate briefing script" }, 500);
    }

    const scriptResult = await scriptResponse.json();
    const script = scriptResult.choices?.[0]?.message?.content || "";

    if (!script) return jsonResponse({ error: "Empty script generated" }, 500);

    // ── Step 2: Convert to speech via ElevenLabs ──
    const voiceId = "JBFqnCBsd6RMkjVDRZzb";
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.75,
            style: 0.3,
            speed: 1.0,
          },
        }),
      },
    );

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      console.error("ElevenLabs TTS error:", ttsResponse.status, errText);
      return jsonResponse({ error: "Voice generation failed" }, 500);
    }

    const audioArrayBuffer = await ttsResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioArrayBuffer);

    // ── Step 3: Store in reports bucket ──
    const timestamp = Date.now();
    const storagePath = `voice-briefings/${client_id}/${year}-${month}/${timestamp}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(storagePath, audioBytes, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      // Still return audio even if storage fails
    } else {
      // ── Step 4: Upsert voice_briefings record ──
      const { error: upsertError } = await supabase
        .from("voice_briefings")
        .upsert(
          {
            client_id: client_id,
            org_id: orgId,
            report_month: month,
            report_year: year,
            storage_path: storagePath,
            generated_by: callerId,
            generated_at: new Date().toISOString(),
          },
          { onConflict: "client_id,report_month,report_year" }
        );

      if (upsertError) {
        console.error("Upsert error:", upsertError);
      }
    }

    // Return the audio binary
    return new Response(audioArrayBuffer, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  } catch (e) {
    console.error("voice-briefing error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
