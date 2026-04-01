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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub;

    const { client_id, month, year, messages } = await req.json();

    if (!client_id || !month || !year || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing client_id, month, year, or messages" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller belongs to the org that owns this client
    const { data: clientOwner } = await supabase.from("clients").select("org_id").eq("id", client_id).single();
    if (!clientOwner) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: membership } = await supabase.from("org_members").select("id").eq("user_id", callerId).eq("org_id", clientOwner.org_id).limit(1).single();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client data
    const [clientRes, snapshotsRes, prevSnapshotsRes] = await Promise.all([
      supabase.from("clients").select("company_name, industry, target_audience, service_area_type, service_areas, business_goals, competitors, unique_selling_points, brand_voice").eq("id", client_id).single(),
      supabase.from("monthly_snapshots").select("platform, metrics_data").eq("client_id", client_id).eq("report_month", month).eq("report_year", year),
      supabase.from("monthly_snapshots").select("platform, metrics_data")
        .eq("client_id", client_id)
        .eq("report_month", month === 1 ? 12 : month - 1)
        .eq("report_year", month === 1 ? year - 1 : year),
    ]);

    const client = clientRes.data;
    const snapshots = snapshotsRes.data ?? [];
    const prevSnapshots = prevSnapshotsRes.data ?? [];

    const businessContext = [
      client?.industry && `Industry: ${client.industry}`,
      client?.target_audience && `Target Audience: ${client.target_audience}`,
      client?.service_area_type && `Service Area: ${client.service_area_type}${client?.service_areas ? ` (${client.service_areas})` : ''}`,
      client?.business_goals && `Business Goals: ${client.business_goals}`,
      client?.competitors && `Competitors: ${client.competitors}`,
      client?.unique_selling_points && `USPs: ${client.unique_selling_points}`,
      client?.brand_voice && `Brand Voice: ${client.brand_voice}`,
    ].filter(Boolean).join('\n');

    const dataContext = JSON.stringify({
      client_name: client?.company_name || "this client",
      period: `${MONTH_NAMES[month]} ${year}`,
      current_data: snapshots.map((s: any) => ({ platform: s.platform, metrics: s.metrics_data })),
      previous_month_data: prevSnapshots.map((s: any) => ({ platform: s.platform, metrics: s.metrics_data })),
    });

    // Only keep last 10 messages for context window
    const recentMessages = messages.slice(-10).map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    const systemPrompt = `You are a friendly, expert marketing analyst for ${client?.company_name || "this client"}. You have access to their marketing performance data for ${MONTH_NAMES[month]} ${year}.

Here is their complete data:
${dataContext}
${businessContext ? `\nBusiness Context:\n${businessContext}` : ''}

Rules:
- Answer in plain, jargon-free English that any business owner can understand
- Be specific with numbers, percentages, and comparisons to last month
- Keep answers concise (2-4 short paragraphs max)
- If asked about something not in the data, say so honestly
- Use bullet points for lists
- Format currency values appropriately
- Be encouraging but honest about areas needing improvement
- Never make up data — only reference what's in the metrics above
- If business context is available, tailor your answers to their industry, audience, goals, and service area
- Consider their competitors and USPs when making suggestions`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...recentMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI chat failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-with-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
