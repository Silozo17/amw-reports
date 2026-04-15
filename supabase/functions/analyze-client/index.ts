import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

// In-memory rate limit: 60s cooldown per actor
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

const PLATFORM_CATEGORIES: Record<string, string[]> = {
  "Paid Advertising": ["google_ads", "meta_ads", "tiktok_ads", "linkedin_ads"],
  "Organic Social": ["facebook", "instagram", "tiktok", "linkedin", "youtube", "pinterest"],
  "SEO & Web Analytics": ["google_search_console", "google_analytics", "google_business_profile"]
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Resolve caller identity ──
    let callerId: string | null = null;
    let portalClientId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    const portalToken = req.headers.get("x-portal-token");

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "analyze-client", method: req.method, connection_id: null }));

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (!userError && userData?.user?.id) {
        callerId = userData.user.id;
      }
    }

    if (!callerId && portalToken) {
      const { data: tokenData } = await supabase.rpc("validate_share_token", { _token: portalToken });
      if (tokenData && tokenData.length > 0) {
        portalClientId = tokenData[0].client_id;
        callerId = `portal:${portalToken.slice(0, 16)}`;
        await supabase.from("client_share_tokens").update({ last_accessed_at: new Date().toISOString() }).eq("token", portalToken);
      }
    }

    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, month, year } = await req.json();

    if (!client_id || !month || !year) {
      return new Response(JSON.stringify({ error: "Missing client_id, month, or year" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Access check ──
    const { data: clientOwner } = await supabase.from("clients").select("org_id").eq("id", client_id).single();
    if (!clientOwner) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let hasAccess = false;

    if (portalClientId) {
      hasAccess = portalClientId === client_id;
    } else {
      const [memberRes, clientUserRes, adminRes] = await Promise.all([
        supabase.from("org_members").select("id").eq("user_id", callerId).eq("org_id", clientOwner.org_id).limit(1).single(),
        supabase.from("client_users").select("id").eq("user_id", callerId).eq("client_id", client_id).limit(1).single(),
        supabase.from("platform_admins").select("id").eq("user_id", callerId).limit(1).single(),
      ]);
      hasAccess = !!(memberRes.data || clientUserRes.data || adminRes.data);
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Rate limit (per actor) ──
    const lastCall = rateLimitMap.get(callerId);
    const now = Date.now();
    if (lastCall && now - lastCall < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (now - lastCall)) / 1000);
      return new Response(JSON.stringify({ error: `Rate limited. Please wait ${waitSec}s.` }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      business_context: {
        industry: client.industry || null,
        target_audience: client.target_audience || null,
        service_area: client.service_area_type || "local",
        service_areas: client.service_areas || null,
        business_goals: client.business_goals || null,
        competitors: client.competitors || null,
        unique_selling_points: client.unique_selling_points || null,
        brand_voice: client.brand_voice || null,
      },
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
- Only include category sections for categories that have data: ${activeCategories.join(", ")}
- If business context is provided (industry, target audience, goals, service area), tailor your recommendations to be relevant to their specific industry, audience, and goals
- Reference their competitors or USPs when making strategic suggestions
- Consider their service area scope (local/national/international/worldwide) when recommending strategies`,
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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    
    // Extract tool call arguments
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    let analysis: string;
    
    if (toolCall?.function?.arguments) {
      analysis = toolCall.function.arguments;
    } else {
      analysis = aiResult.choices?.[0]?.message?.content ?? "Unable to generate analysis.";
    }

    // Record successful call for rate limiting
    rateLimitMap.set(callerId, Date.now());

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-client error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
