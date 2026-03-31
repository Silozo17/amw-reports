import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory rate limit: 60s cooldown per client_id
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

const PLATFORM_CATEGORIES: Record<string, string[]> = {
  "Paid Advertising": ["google_ads", "meta_ads", "tiktok_ads"],
  "Organic Social": ["facebook", "instagram", "tiktok", "linkedin", "youtube", "pinterest"],
  "SEO & Web Analytics": ["google_search_console", "google_analytics", "google_business_profile"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id, month, year } = await req.json();

    if (!client_id || !month || !year) {
      return new Response(JSON.stringify({ error: "Missing client_id, month, or year" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side rate limit check
    const lastCall = rateLimitMap.get(client_id);
    const now = Date.now();
    if (lastCall && now - lastCall < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (now - lastCall)) / 1000);
      return new Response(JSON.stringify({ error: `Rate limited. Please wait ${waitSec}s.` }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client + snapshots
    const [clientRes, snapshotsRes, prevSnapshotsRes, connectionsRes] = await Promise.all([
      supabase.from("clients").select("company_name, services_subscribed, preferred_currency, industry, target_audience, service_area_type, service_areas, business_goals, competitors, unique_selling_points, brand_voice").eq("id", client_id).single(),
      supabase.from("monthly_snapshots").select("platform, metrics_data, top_content").eq("client_id", client_id).eq("report_month", month).eq("report_year", year),
      supabase.from("monthly_snapshots").select("platform, metrics_data")
        .eq("client_id", client_id)
        .eq("report_month", month === 1 ? 12 : month - 1)
        .eq("report_year", month === 1 ? year - 1 : year),
      supabase.from("platform_connections").select("platform, account_name, is_connected, account_id").eq("client_id", client_id),
    ]);

    const client = clientRes.data;
    const snapshots = snapshotsRes.data ?? [];
    const prevSnapshots = prevSnapshotsRes.data ?? [];
    const connections = connectionsRes.data ?? [];

    if (!client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (snapshots.length === 0) {
      return new Response(JSON.stringify({ 
        analysis: JSON.stringify({
          key_takeaway: "No performance data available yet for this period. Sync platform data to generate an AI analysis.",
          sections: [],
        }),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Build category-aware data context
    const categoryData: Record<string, { current: any[]; previous: any[] }> = {};
    for (const [cat, platforms] of Object.entries(PLATFORM_CATEGORIES)) {
      const catCurrent = snapshots.filter((s: any) => platforms.includes(s.platform));
      const catPrev = prevSnapshots.filter((s: any) => platforms.includes(s.platform));
      if (catCurrent.length > 0) {
        categoryData[cat] = {
          current: catCurrent.map((s: any) => ({ platform: s.platform, metrics: s.metrics_data })),
          previous: catPrev.map((s: any) => ({ platform: s.platform, metrics: s.metrics_data })),
        };
      }
    }

    const currency = client.preferred_currency || "GBP";
    const currencySymbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";

    const dataContext = JSON.stringify({
      client_name: client.company_name,
      month: MONTH_NAMES[month],
      year,
      currency,
      platforms_connected: connections.filter((c: any) => c.is_connected && c.account_id).map((c: any) => c.platform),
      categories: categoryData,
    });

    const activeCategories = Object.keys(categoryData);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: `You are an expert digital marketing analyst. Analyse the following marketing performance data for ${client.company_name} for ${MONTH_NAMES[month]} ${year}.

Return your analysis by calling the "deliver_analysis" function. Do NOT return plain text.

Data: ${dataContext}

Rules:
- Use plain English that a non-technical business owner would understand
- Be specific with numbers and percentages where available
- Always use ${currencySymbol} for any monetary values. Never use $ or USD unless that is the client's selected currency.
- Compare to previous month data where available
- Each highlight should be one clear, specific sentence
- Recommendations should be actionable and specific
- Only include category sections for categories that have data: ${activeCategories.join(", ")}`,
        }],
        tools: [{
          type: "function",
          function: {
            name: "deliver_analysis",
            description: "Deliver the structured marketing analysis",
            parameters: {
              type: "object",
              properties: {
                key_takeaway: {
                  type: "string",
                  description: "One sentence summarising the most important finding this month (max 30 words)",
                },
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      heading: {
                        type: "string",
                        description: "Section heading: 'Overall Summary', 'Paid Advertising', 'Organic Social', or 'SEO & Web Analytics'",
                      },
                      highlights: {
                        type: "array",
                        items: { type: "string" },
                        description: "3-4 bullet-point highlights, each one specific sentence with numbers",
                      },
                      recommendation: {
                        type: "string",
                        description: "One actionable recommendation for this category",
                      },
                    },
                    required: ["heading", "highlights", "recommendation"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["key_takeaway", "sections"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "deliver_analysis" } },
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    
    // Extract tool call arguments
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    let analysis: string;
    
    if (toolCall?.function?.arguments) {
      // Structured output via tool calling
      analysis = toolCall.function.arguments;
    } else {
      // Fallback to content
      analysis = aiResult.choices?.[0]?.message?.content ?? "Unable to generate analysis.";
    }

    // Record successful call for rate limiting
    rateLimitMap.set(client_id, Date.now());

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-client error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
