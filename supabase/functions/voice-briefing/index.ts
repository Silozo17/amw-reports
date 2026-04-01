import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth verification ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Extract user from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const { client_id, month, year } = await req.json();

    if (!client_id || !month || !year) {
      return new Response(JSON.stringify({ error: "Missing client_id, month, or year" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller has access: org_members OR client_users OR platform_admins
    const { data: clientOwner } = await supabase.from("clients").select("org_id").eq("id", client_id).single();
    if (!clientOwner) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [membershipRes, clientUserRes, platformAdminRes] = await Promise.all([
      supabase.from("org_members").select("id").eq("user_id", callerId).eq("org_id", clientOwner.org_id).limit(1).maybeSingle(),
      supabase.from("client_users").select("id").eq("user_id", callerId).eq("client_id", client_id).limit(1).maybeSingle(),
      supabase.from("platform_admins").select("id").eq("user_id", callerId).limit(1).maybeSingle(),
    ]);

    const hasAccess = membershipRes.data || clientUserRes.data || platformAdminRes.data;
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "Voice feature not configured. Please add an ElevenLabs API key." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch data
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
      return new Response(JSON.stringify({ error: "No data available for this period" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataContext = JSON.stringify({
      current: snapshots.map((s: any) => ({ platform: s.platform, metrics: s.metrics_data })),
      previous: prevSnapshots.map((s: any) => ({ platform: s.platform, metrics: s.metrics_data })),
    });

    // Step 1: Generate script via AI
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
      return new Response(JSON.stringify({ error: "Failed to generate briefing script" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scriptResult = await scriptResponse.json();
    const script = scriptResult.choices?.[0]?.message?.content || "";

    if (!script) {
      return new Response(JSON.stringify({ error: "Empty script generated" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Convert to speech via ElevenLabs
    const voiceId = "JBFqnCBsd6RMkjVDRZzb"; // George — professional male voice
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
      return new Response(JSON.stringify({ error: "Voice generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await ttsResponse.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (e) {
    console.error("voice-briefing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
