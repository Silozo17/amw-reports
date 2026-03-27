import "jspdf";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  client_id: string;
  report_month: number;
  report_year: number;
}

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: "Google Ads", meta_ads: "Meta Ads", facebook: "Facebook",
  instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn",
  google_search_console: "Google Search Console", google_analytics: "Google Analytics",
  google_business_profile: "Google Business Profile", youtube: "YouTube", pinterest: "Pinterest",
};

const PLATFORM_DESCRIPTIONS: Record<string, string> = {
  google_ads: "your paid advertising on Google, showing how many people saw your ads, how much it cost, and what actions they took.",
  meta_ads: "your paid advertising on Meta (Facebook & Instagram), covering ad reach, spend, and the results they generated.",
  facebook: "your organic Facebook presence — how many people see your posts, engage with your content, and follow your page.",
  instagram: "your organic Instagram activity — follower growth, post engagement, and how people interact with your profile.",
  tiktok: "your TikTok presence — video views, follower growth, and how your short-form content performs.",
  linkedin: "your LinkedIn company page — professional audience growth, post engagement, and business networking reach.",
  google_search_console: "how your website appears in Google search results — what people search to find you and how often they click.",
  google_analytics: "your website traffic — how many people visit, where they come from, and what they do on your site.",
  google_business_profile: "your Google Business listing — how people find your business on Google Maps and Search, and the actions they take.",
  youtube: "your YouTube channel — video views, subscriber growth, and how long people watch your content.",
  pinterest: "your Pinterest presence — how your pins perform, how many people save them, and the traffic they drive.",
};

const METRIC_PLAIN_ENGLISH: Record<string, string> = {
  spend: "total amount spent on advertising",
  impressions: "number of times your content was displayed",
  paid_impressions: "number of times your paid ads were displayed",
  clicks: "number of times people clicked on your content",
  link_clicks: "clicks on links in your ads",
  organic_clicks: "clicks from unpaid search results",
  ctr: "Click-Through Rate — percentage of people who saw your content and clicked",
  conversions: "actions people took after seeing your ad (purchases, sign-ups, etc.)",
  conversions_value: "monetary value of all conversions",
  conversion_rate: "percentage of clicks that turned into conversions",
  cpc: "Cost Per Click — average price you paid for each click",
  cpm: "Cost Per 1,000 Impressions — price to show your ad a thousand times",
  cost_per_conversion: "average cost for each conversion",
  cost_per_lead: "average cost for each new lead",
  roas: "Return On Ad Spend — revenue earned per pound spent",
  reach: "number of unique people who saw your content",
  frequency: "average number of times each person saw your ad",
  search_impression_share: "percentage of available search ad slots you appeared in",
  leads: "number of new potential customers captured",
  total_followers: "total number of followers",
  follower_growth: "net new followers gained this month",
  follower_removes: "people who unfollowed",
  audience_growth_rate: "percentage your audience grew",
  page_likes: "total page likes",
  page_views: "people who viewed your page",
  profile_visits: "people who visited your profile",
  engagement: "total interactions (likes, comments, shares combined)",
  engagement_rate: "percentage of people who interacted with your content",
  likes: "number of likes received",
  comments: "number of comments received",
  shares: "number of times your content was shared",
  saves: "number of times people saved your content",
  reactions: "total reactions on your posts",
  video_views: "number of times your videos were watched",
  posts_published: "number of posts you published",
  search_clicks: "clicks from Google search results to your website",
  search_impressions: "times your site appeared in search results",
  search_ctr: "Search Click-Through Rate — percentage of search appearances that got clicks",
  search_position: "average position in search results (lower is better)",
  sessions: "number of visits to your website",
  active_users: "people who actively used your website",
  new_users: "first-time visitors to your website",
  ga_page_views: "total pages viewed on your website",
  bounce_rate: "percentage of visitors who left after one page",
  avg_session_duration: "average time each visitor spent on your site",
  pages_per_session: "average pages each visitor looked at",
  gbp_views: "people who viewed your Google Business profile",
  gbp_searches: "times your business appeared in Google Search or Maps",
  gbp_calls: "phone calls made from your listing",
  gbp_direction_requests: "people who asked for directions to your business",
  gbp_website_clicks: "clicks to your website from your Google listing",
  gbp_reviews_count: "total number of reviews",
  gbp_average_rating: "your average star rating",
  subscribers: "net new YouTube subscribers",
  views: "total video views",
  watch_time: "total minutes people watched your videos",
  videos_published: "videos uploaded this month",
  avg_view_duration: "average seconds each viewer watched",
  pin_clicks: "clicks on your pins",
  outbound_clicks: "clicks from your pins to your website",
  total_pins: "total number of pins",
  total_boards: "total number of boards",
};

/** Metrics where a decrease is positive */
const LOWER_IS_BETTER = new Set(["spend", "cpc", "cpm", "cost_per_conversion", "cost_per_lead", "bounce_rate", "search_position"]);

const METRIC_LABELS: Record<string, string> = {
  spend: "Spend", impressions: "Impressions", clicks: "Clicks",
  ctr: "CTR", conversions: "Conversions", cpc: "CPC", cpm: "CPM",
  reach: "Reach", total_followers: "Followers", follower_growth: "Growth",
  engagement: "Engagement", engagement_rate: "Eng. Rate",
  likes: "Likes", comments: "Comments", shares: "Shares",
  video_views: "Video Views", posts_published: "Posts",
  cost_per_conversion: "Cost/Conv", conversion_rate: "Conv. Rate",
  leads: "Leads", saves: "Saves", profile_visits: "Profile Visits",
  page_likes: "Page Likes", page_views: "Page Views", link_clicks: "Link Clicks",
  audience_growth_rate: "Audience Growth", search_clicks: "Search Clicks",
  search_impressions: "Search Impressions", search_ctr: "Search CTR",
  search_position: "Avg. Position", sessions: "Sessions",
  active_users: "Active Users", new_users: "New Users",
  ga_page_views: "Page Views", bounce_rate: "Bounce Rate",
  avg_session_duration: "Avg. Session Duration", pages_per_session: "Pages/Session",
  gbp_views: "Profile Views", gbp_searches: "Search Appearances",
  gbp_calls: "Phone Calls", gbp_direction_requests: "Direction Requests",
  gbp_website_clicks: "Website Clicks", gbp_reviews_count: "Reviews",
  gbp_average_rating: "Avg. Rating", subscribers: "Subscribers",
  views: "Views", watch_time: "Watch Time (min)", videos_published: "Videos Published",
  avg_view_duration: "Avg. View Duration", reactions: "Reactions",
  frequency: "Frequency", paid_impressions: "Paid Impressions",
  organic_clicks: "Organic Clicks", conversions_value: "Conv. Value",
  cost_per_lead: "Cost/Lead", search_impression_share: "Search Imp. Share",
  follower_removes: "Unfollows", pin_clicks: "Pin Clicks",
  outbound_clicks: "Outbound Clicks", total_pins: "Total Pins",
  total_boards: "Total Boards",
};

/** Convert hex (#RRGGBB) to [r, g, b] tuple */
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
};

/** Convert HSL string "210 40% 98%" to hex */
const hslToHex = (hsl: string): string => {
  const parts = hsl.trim().split(/[\s,]+/);
  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/** Parse a color value (hex or HSL) to RGB tuple */
const parseColorToRgb = (color: string | null, fallback: [number, number, number]): [number, number, number] => {
  if (!color) return fallback;
  if (color.startsWith("#")) return hexToRgb(color);
  try { return hexToRgb(hslToHex(color)); } catch { return fallback; }
};

const DEFAULTS = {
  offWhite: [248, 248, 248] as [number, number, number],
  black: [36, 36, 40] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  grey: [120, 120, 120] as [number, number, number],
  lightGrey: [220, 220, 220] as [number, number, number],
  green: [34, 160, 80] as [number, number, number],
  amber: [210, 150, 30] as [number, number, number],
  red: [200, 50, 50] as [number, number, number],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { client_id, report_month, report_year } = (await req.json()) as ReportRequest;

    if (!client_id || !report_month || !report_year) {
      return new Response(JSON.stringify({ error: "Missing client_id, report_month, or report_year" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all data
    const [clientRes, snapshotsRes, configRes, prevSnapshotsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", client_id).single(),
      supabase.from("monthly_snapshots").select("*").eq("client_id", client_id).eq("report_month", report_month).eq("report_year", report_year),
      supabase.from("client_platform_config").select("*").eq("client_id", client_id).eq("is_enabled", true),
      supabase.from("monthly_snapshots").select("*").eq("client_id", client_id)
        .eq("report_month", report_month === 1 ? 12 : report_month - 1)
        .eq("report_year", report_month === 1 ? report_year - 1 : report_year),
    ]);

    const client = clientRes.data;
    if (!client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify requesting user belongs to the client's org
    const authHeader = req.headers.get("Authorization");
    if (authHeader && client.org_id) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await supabase.auth.getUser(token);
      if (caller) {
        const { data: membership } = await supabase.from("org_members").select("id").eq("user_id", caller.id).eq("org_id", client.org_id).limit(1).single();
        if (!membership) {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // Fetch organisation branding
    const { data: org } = await supabase.from("organisations").select("*").eq("id", client.org_id).single();
    const orgName = org?.name ?? "Your Agency";
    const reportSettings = (org?.report_settings ?? {}) as Record<string, unknown>;
    const showLogo = reportSettings.show_logo !== false;
    const reportAccentColor = (reportSettings.report_accent_color as string) || null;
    const reportLanguage = (reportSettings.report_language as string) || "English";
    const isNonEnglish = reportLanguage !== "English";
    const langInstruction = isNonEnglish ? `\nIMPORTANT: Write the ENTIRE response in ${reportLanguage}.\n` : "";

    const primaryColor = parseColorToRgb(reportAccentColor || org?.primary_color, [60, 60, 140]);
    const secondaryColor = parseColorToRgb(org?.secondary_color, [80, 120, 180]);

    const C = {
      offWhite: DEFAULTS.offWhite,
      black: DEFAULTS.black,
      primary: primaryColor,
      secondary: secondaryColor,
      green: DEFAULTS.green,
      amber: DEFAULTS.amber,
      red: DEFAULTS.red,
      white: DEFAULTS.white,
      grey: DEFAULTS.grey,
      lightGrey: DEFAULTS.lightGrey,
    };

    const snapshots = snapshotsRes.data ?? [];
    const prevSnapshots = prevSnapshotsRes.data ?? [];
    const configs = configRes.data ?? [];

    const CURRENCY_SYMBOLS: Record<string, string> = {
      GBP: "£", EUR: "€", USD: "$", PLN: "zł", CAD: "C$", AUD: "A$", NZD: "NZ$",
      AED: "د.إ", BRL: "R$", CHF: "CHF", CZK: "Kč", DKK: "kr", HKD: "HK$",
      HUF: "Ft", IDR: "Rp", ILS: "₪", INR: "₹", JPY: "¥", KRW: "₩", MXN: "MX$",
      MYR: "RM", NOK: "kr", PHP: "₱", RON: "lei", SEK: "kr", SGD: "S$",
      THB: "฿", TRY: "₺", TWD: "NT$", ZAR: "R",
    };
    const currSymbol = CURRENCY_SYMBOLS[client.preferred_currency ?? "GBP"] ?? "£";

    if (snapshots.length === 0) {
      return new Response(JSON.stringify({
        error: "No data snapshots found for this period. Please sync platform data before generating a report."
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch upsell for this month
    const { data: upsellData } = await supabase.from("report_upsells")
      .select("*")
      .eq("client_id", client_id)
      .eq("report_month", report_month)
      .eq("report_year", report_year)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    // Build platform data structures
    interface PlatformData {
      platform: string;
      label: string;
      description: string;
      metrics: Record<string, number>;
      prevMetrics: Record<string, number>;
      enabledMetrics: string[];
      topContent: unknown[];
    }

    const platformSections: PlatformData[] = [];
    for (const snapshot of snapshots) {
      const config = configs.find((c: Record<string, unknown>) => c.platform === snapshot.platform);
      const metrics = snapshot.metrics_data as Record<string, number>;
      const enabledMetrics: string[] = config?.enabled_metrics?.length > 0
        ? (config.enabled_metrics as string[])
        : Object.keys(metrics).filter(k => typeof metrics[k] === "number" && !k.startsWith("top_") && k !== "traffic_sources");
      const prevSnapshot = prevSnapshots.find((s: Record<string, unknown>) => s.platform === snapshot.platform);
      const prevMetrics = (prevSnapshot?.metrics_data ?? {}) as Record<string, number>;
      const topContent = Array.isArray(snapshot.top_content) ? snapshot.top_content : [];

      platformSections.push({
        platform: snapshot.platform as string,
        label: PLATFORM_LABELS[snapshot.platform as string] ?? (snapshot.platform as string),
        description: PLATFORM_DESCRIPTIONS[snapshot.platform as string] ?? "performance data for this platform.",
        metrics,
        prevMetrics,
        enabledMetrics,
        topContent,
      });
    }

    // ── AI GENERATION ──
    let aiSummary = "";
    let aiPlatformInsights: Record<string, string> = {};

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableApiKey && snapshots.length > 0) {
      try {
        const dataContext = JSON.stringify({
          client_name: client.company_name,
          month: MONTH_NAMES[report_month],
          year: report_year,
          current: platformSections.map(p => ({ platform: p.label, metrics: p.metrics })),
          previous: platformSections.map(p => ({ platform: p.label, metrics: p.prevMetrics })),
        });

        const aiCall = async (prompt: string, maxTokens: number): Promise<string> => {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableApiKey}` },
            body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }], max_tokens: maxTokens }),
          });
          if (!res.ok) { console.error("AI call failed:", res.status); return ""; }
          const json = await res.json();
          return json.choices?.[0]?.message?.content ?? "";
        };

        // Executive summary
        aiSummary = await aiCall(
          `Write a 4-5 sentence monthly marketing performance summary for ${client.company_name} for ${MONTH_NAMES[report_month]} ${report_year}.
Rules:
- Write as if speaking to a non-technical business owner face to face
- Lead with the single best result
- Mention any significant declines honestly but constructively
- Never use jargon or acronyms without explaining them
- End with a forward-looking sentence
- Do NOT use markdown formatting, headers, or bullet points — just flowing prose${langInstruction}
Data: ${dataContext}`,
          600
        );

        // Per-platform insights
        for (const section of platformSections) {
          const platformContext = JSON.stringify({
            platform: section.label,
            current: section.metrics,
            previous: section.prevMetrics,
          });
          const insight = await aiCall(
            `Write a 3-5 sentence plain-English summary for ${client.company_name}'s ${section.label} performance in ${MONTH_NAMES[report_month]} ${report_year}.
Rules:
- Start with the overall picture in one sentence
- Highlight the single best metric
- If anything dropped, explain it simply and say whether it needs attention
- Include one honest, actionable observation (not a sales pitch)
- Do NOT use markdown, headers, or bullet points — flowing prose only
- Never use acronyms without explaining them first (e.g. CTR = Click-Through Rate)${langInstruction}
Data: ${platformContext}`,
            400
          );
          aiPlatformInsights[section.platform] = insight;
        }
      } catch (aiError) {
        console.error("AI generation error:", aiError);
        aiSummary = `This report covers ${client.company_name}'s marketing performance for ${MONTH_NAMES[report_month]} ${report_year}.`;
      }
    } else {
      aiSummary = `This report covers ${client.company_name}'s marketing performance for ${MONTH_NAMES[report_month]} ${report_year}.`;
    }

    // Static label translations for non-English reports
    const defaultLabels = {
      performanceReport: "Performance Report",
      preparedFor: "Prepared for",
      preparedBy: "Prepared by",
      date: "Date",
      tableOfContents: "Table of Contents",
      thisMonth: "This Month",
      lastMonth: "Last Month",
      change: "Change",
      monthlySummary: "Monthly Summary",
      keyWins: "Key wins this month",
      watchList: "Worth keeping an eye on",
      thankYou: "Thank you",
      noComparisonNote: "No previous month data available for comparison — this is your first month tracked.",
      whatThisMeans: "What this means for you",
      topPosts: "Top Posts",
      aNoteFrom: "A Note from",
      interestedCTA: "Interested? Reply to this email or call us.",
    };
    let labels = { ...defaultLabels };

    if (isNonEnglish && lovableApiKey) {
      try {
        const aiCall = async (prompt: string, maxTokens: number): Promise<string> => {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableApiKey}` },
            body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }], max_tokens: maxTokens }),
          });
          if (!res.ok) return "";
          const json = await res.json();
          return json.choices?.[0]?.message?.content ?? "";
        };
        const translationResult = await aiCall(
          `Translate these UI labels to ${reportLanguage}. Return ONLY a valid JSON object with the same keys. No markdown, no explanation.
${JSON.stringify(defaultLabels)}`,
          500
        );
        const cleaned = translationResult.replace(/```json\s*/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        labels = { ...defaultLabels, ...parsed };
      } catch (e) {
        console.error("Label translation failed, using English:", e);
      }
    }

    // ───────── GENERATE PDF — LANDSCAPE A4 ─────────
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297, H = 210, M = 16;
    const CW = W - M * 2;

    const setC = (c: number[]) => doc.setTextColor(c[0], c[1], c[2]);
    const setF = (c: number[]) => doc.setFillColor(c[0], c[1], c[2]);
    const setD = (c: number[]) => doc.setDrawColor(c[0], c[1], c[2]);

    const stripMarkdown = (text: string): string =>
      text.replace(/#{1,6}\s+/g, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1").replace(/^[-*]\s+/gm, "- ");

    let pageCount = 0;
    const pageToc: { title: string; page: number }[] = [];

    const formatMetricValue = (key: string, val: number): string => {
      if (key === "spend" || key === "cpc" || key === "cost_per_conversion" || key === "cost_per_lead" || key === "conversions_value") return `${currSymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (key === "ctr" || key === "engagement_rate" || key === "conversion_rate" || key === "audience_growth_rate" || key === "search_ctr" || key === "bounce_rate" || key === "search_impression_share" || key === "completion_rate") return `${val.toFixed(2)}%`;
      if (key === "search_position" || key === "gbp_average_rating") return val.toFixed(1);
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
      return val % 1 !== 0 ? val.toFixed(2) : val.toLocaleString();
    };

    const calcChange = (curr: number, prev: number): { pct: number; abs: number; dir: string } => {
      if (prev === 0) return { pct: 0, abs: curr, dir: "new" };
      const pct = ((curr - prev) / prev) * 100;
      return { pct, abs: curr - prev, dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
    };

    const getChangeColor = (key: string, dir: string): number[] => {
      if (dir === "flat" || dir === "new") return C.grey;
      const lowerBetter = LOWER_IS_BETTER.has(key);
      if (dir === "up") return lowerBetter ? C.red : C.green;
      return lowerBetter ? C.green : C.red;
    };

    const getTrafficLight = (key: string, pct: number): { color: number[]; label: string } => {
      const lowerBetter = LOWER_IS_BETTER.has(key);
      const adjustedPct = lowerBetter ? -pct : pct;
      if (adjustedPct >= 5) return { color: C.green, label: "Good" };
      if (adjustedPct >= -5) return { color: C.amber, label: "Steady" };
      return { color: C.red, label: "Needs attention" };
    };

    const addPageFooter = () => {
      doc.setFontSize(7); setC(C.grey);
      doc.text(`${orgName} | Confidential`, M, H - 6);
      doc.text(`${client.company_name} — ${MONTH_NAMES[report_month]} ${report_year}`, W / 2, H - 6, { align: "center" });
      doc.text(`Page ${pageCount}`, W - M, H - 6, { align: "right" });
    };

    const startNewPage = (): number => {
      if (pageCount > 0) doc.addPage();
      pageCount++;
      setF(C.white); doc.rect(0, 0, W, H, "F");
      // Top accent bar
      setF(C.primary); doc.rect(0, 0, W, 3, "F");
      addPageFooter();
      return M + 6;
    };

    const wrapText = (text: string, x: number, y: number, maxW: number, lh: number): number => {
      const clean = stripMarkdown(text);
      const lines = doc.splitTextToSize(clean, maxW);
      for (const line of lines) {
        if (y > H - 20) { y = startNewPage(); }
        doc.text(line, x, y);
        y += lh;
      }
      return y;
    };

    // ═══════ PAGE 1: COVER ═══════
    pageCount++;
    setF(C.white); doc.rect(0, 0, W, H, "F");
    // Large accent block on left
    setF(C.primary); doc.rect(0, 0, 90, H, "F");

    // Org logo on left panel
    if (showLogo && org?.logo_url) {
      try {
        const logoRes = await fetch(org.logo_url);
        if (logoRes.ok) {
          const logoBlob = await logoRes.arrayBuffer();
          const logoBase64 = btoa(String.fromCharCode(...new Uint8Array(logoBlob)));
          const ext = org.logo_url.toLowerCase().includes(".png") ? "PNG" : "JPEG";
          doc.addImage(`data:image/${ext.toLowerCase()};base64,${logoBase64}`, ext, 20, 25, 50, 50);
        }
      } catch { /* skip logo */ }
    }

    // Left panel text
    setC(C.white);
    doc.setFontSize(11);
    doc.text(labels.preparedBy, 20, 100);
    doc.setFontSize(16);
    doc.text(orgName, 20, 112);

    doc.setFontSize(11);
    doc.text(`${MONTH_NAMES[report_month]} ${report_year}`, 20, 135);

    // Right panel - report title
    doc.setFontSize(14); setC(C.grey);
    doc.text(labels.performanceReport, 110, 50);

    doc.setFontSize(36); setC(C.black);
    const companyLines = doc.splitTextToSize(client.company_name, 170);
    let coverY = 65;
    for (const line of companyLines) {
      doc.text(line, 110, coverY);
      coverY += 14;
    }

    coverY += 5;
    doc.setFontSize(13); setC(C.grey);
    doc.text(`${labels.preparedFor}: ${client.full_name}`, 110, coverY);

    // 3 headline KPIs at bottom right
    const allMetrics: Record<string, number> = {};
    const allPrevMetrics: Record<string, number> = {};
    for (const s of platformSections) {
      for (const [k, v] of Object.entries(s.metrics)) {
        if (typeof v === "number") allMetrics[k] = (allMetrics[k] ?? 0) + v;
      }
      for (const [k, v] of Object.entries(s.prevMetrics)) {
        if (typeof v === "number") allPrevMetrics[k] = (allPrevMetrics[k] ?? 0) + v;
      }
    }

    // Pick 3 most impressive metrics
    const heroMetricCandidates = [
      { key: "reach", label: "People Reached" },
      { key: "impressions", label: "Total Impressions" },
      { key: "engagement", label: "Engagements" },
      { key: "clicks", label: "Total Clicks" },
      { key: "search_clicks", label: "Search Clicks" },
      { key: "views", label: "Video Views" },
      { key: "sessions", label: "Website Sessions" },
      { key: "total_followers", label: "Total Followers" },
      { key: "conversions", label: "Conversions" },
      { key: "leads", label: "Leads" },
    ];
    const heroMetrics = heroMetricCandidates
      .filter(h => (allMetrics[h.key] ?? 0) > 0)
      .sort((a, b) => (allMetrics[b.key] ?? 0) - (allMetrics[a.key] ?? 0))
      .slice(0, 3);

    const kpiStartX = 110;
    const kpiWidth = 55;
    const kpiY = H - 55;
    heroMetrics.forEach((hero, i) => {
      const x = kpiStartX + i * (kpiWidth + 5);
      setF(C.offWhite); doc.roundedRect(x, kpiY, kpiWidth, 35, 3, 3, "F");
      setF(C.primary); doc.rect(x, kpiY, kpiWidth, 2.5, "F");
      doc.setFontSize(20); setC(C.black);
      doc.text(formatMetricValue(hero.key, allMetrics[hero.key]), x + 5, kpiY + 18);
      doc.setFontSize(8); setC(C.grey);
      doc.text(hero.label, x + 5, kpiY + 27);
    });

    // Cover footer
    doc.setFontSize(7); setC(C.grey);
    doc.text(`${orgName} | Confidential`, W / 2, H - 6, { align: "center" });

    // ═══════ PAGE 2: TABLE OF CONTENTS ═══════
    let y = startNewPage();
    const tocPageNum = pageCount;
    doc.setFontSize(22); setC(C.black);
    doc.text(labels.tableOfContents, M, y); y += 14;

    setF(C.primary); doc.rect(M, y - 5, 50, 1.5, "F"); y += 8;

    // Determine start pages for each section
    const prevMonth = report_month === 1 ? 12 : report_month - 1;
    const prevYear = report_month === 1 ? report_year - 1 : report_year;
    const prevMonthName = MONTH_NAMES[prevMonth];
    const daysInMonth = new Date(report_year, report_month, 0).getDate();

    doc.setFontSize(10); setC(C.grey);
    y = wrapText(
      `This report covers performance from 1 ${MONTH_NAMES[report_month]} ${report_year} to ${daysInMonth} ${MONTH_NAMES[report_month]} ${report_year}. All figures compared to 1 ${prevMonthName} ${prevYear} to ${new Date(prevYear, prevMonth, 0).getDate()} ${prevMonthName} ${prevYear} unless stated.`,
      M, y, CW, 5
    );
    y += 10;

    // We'll fill TOC page numbers later — for now record positions
    const tocEntries: { label: string; desc: string; yPos: number }[] = [];
    let estimatedPage = pageCount + 1; // Next page after TOC

    for (const section of platformSections) {
      tocEntries.push({
        label: section.label,
        desc: `Performance metrics, month-on-month comparison, and analysis`,
        yPos: y,
      });
      doc.setFontSize(12); setC(C.black);
      doc.text(section.label, M + 4, y);
      doc.setFontSize(8); setC(C.grey);
      doc.text(`Performance metrics, comparison, and analysis`, M + 4, y + 5);
      y += 14;
    }

    // Monthly summary entry
    doc.setFontSize(12); setC(C.black);
    doc.text(labels.monthlySummary, M + 4, y);
    doc.setFontSize(8); setC(C.grey);
    doc.text("Overall performance across all platforms with traffic light status", M + 4, y + 5);
    y += 14;

    if (upsellData) {
      doc.setFontSize(12); setC(C.black);
      doc.text(`${labels.aNoteFrom} ${orgName}`, M + 4, y);
      doc.setFontSize(8); setC(C.grey);
      doc.text("A service recommendation based on your results", M + 4, y + 5);
      y += 14;
    }

    // ═══════ PLATFORM PAGES ═══════
    for (const section of platformSections) {
      y = startNewPage();
      pageToc.push({ title: section.label, page: pageCount });

      // Section header
      doc.setFontSize(22); setC(C.primary);
      doc.text(section.label, M, y);
      y += 6;
      doc.setFontSize(9); setC(C.grey);
      const descLines = doc.splitTextToSize(`${section.label} — ${section.description}`, CW);
      doc.text(descLines, M, y);
      y += descLines.length * 4.5 + 4;
      setF(C.primary); doc.rect(M, y, 50, 1.2, "F"); y += 8;

      const hasPrev = Object.keys(section.prevMetrics).length > 0;

      // ── METRICS GRID ──
      const gridMetrics = section.enabledMetrics.filter(k => typeof section.metrics[k] === "number");
      const colCount = 4;
      const cardW = (CW - (colCount - 1) * 4) / colCount;
      const cardH = hasPrev ? 32 : 24;
      let cardX = M;
      let cardsInRow = 0;

      for (const key of gridMetrics) {
        if (y + cardH > H - 20) {
          y = startNewPage();
          cardX = M; cardsInRow = 0;
        }

        const val = section.metrics[key];
        const prevVal = section.prevMetrics[key];

        // Card background
        setF(C.offWhite); doc.roundedRect(cardX, y, cardW, cardH, 2, 2, "F");

        // Metric label
        doc.setFontSize(7); setC(C.grey);
        doc.text((METRIC_LABELS[key] ?? key).toUpperCase(), cardX + 4, y + 7);

        // Value
        doc.setFontSize(14); setC(C.black);
        doc.text(formatMetricValue(key, val), cardX + 4, y + 16);

        // Plain English label
        const plainDesc = METRIC_PLAIN_ENGLISH[key];
        if (plainDesc) {
          doc.setFontSize(5.5); setC(C.grey);
          const truncated = plainDesc.length > 50 ? plainDesc.substring(0, 48) + "..." : plainDesc;
          doc.text(truncated, cardX + 4, y + 21);
        }

        // MoM comparison
        if (hasPrev && prevVal !== undefined && prevVal !== 0) {
          const change = calcChange(val, prevVal);
          const color = getChangeColor(key, change.dir);
          doc.setFontSize(6.5); setC(color);
          const arrow = change.dir === "up" ? "▲" : change.dir === "down" ? "▼" : "—";
          doc.text(`${arrow} ${Math.abs(change.pct).toFixed(1)}% vs last month`, cardX + 4, y + 28);
        } else if (hasPrev) {
          doc.setFontSize(6.5); setC(C.grey);
          doc.text("New this month", cardX + 4, y + 28);
        }

        cardX += cardW + 4;
        cardsInRow++;
        if (cardsInRow >= colCount) {
          cardX = M; y += cardH + 4; cardsInRow = 0;
        }
      }
      if (cardsInRow > 0) y += cardH + 4;

      // ── PLAIN ENGLISH SUMMARY BOX ──
      const platformInsight = aiPlatformInsights[section.platform];
      if (platformInsight) {
        y += 2;
        if (y + 30 > H - 20) y = startNewPage();

        // Highlighted box
        setF([primaryColor[0], primaryColor[1], primaryColor[2]]); doc.rect(M, y, 3, 0.01, "F"); // Will size after
        const boxTop = y;
        setF(C.offWhite); doc.roundedRect(M, y, CW, 4, 2, 2, "F"); // Placeholder, will size

        doc.setFontSize(10); setC(C.primary);
        doc.text("What This Means", M + 6, y + 6);
        y += 10;
        doc.setFontSize(9); setC(C.black);
        const insightY = wrapText(platformInsight, M + 6, y, CW - 12, 4.5);

        // Draw the actual box now that we know height
        const boxH = insightY - boxTop + 4;
        setF(C.offWhite); doc.roundedRect(M, boxTop, CW, boxH, 2, 2, "F");
        setF(C.primary); doc.rect(M, boxTop, 3, boxH, "F");
        // Re-render text inside the box
        doc.setFontSize(10); setC(C.primary);
        doc.text("What This Means", M + 6, boxTop + 6);
        doc.setFontSize(9); setC(C.black);
        wrapText(platformInsight, M + 6, boxTop + 10, CW - 12, 4.5);

        y = insightY + 6;
      }

      // ── MONTH-ON-MONTH COMPARISON TABLE ──
      if (hasPrev && gridMetrics.length > 0) {
        if (y + 20 > H - 20) y = startNewPage();
        doc.setFontSize(11); setC(C.black);
        doc.text("Month-on-Month Comparison", M, y); y += 7;

        // Table header
        const colWidths = [CW * 0.30, CW * 0.22, CW * 0.22, CW * 0.26];
        const tableHeaders = ["Metric", "This Month", "Last Month", "Change"];
        setF(C.primary);
        doc.rect(M, y - 3, CW, 7, "F");
        doc.setFontSize(7.5); setC(C.white);
        let hx = M;
        for (let i = 0; i < tableHeaders.length; i++) {
          doc.text(tableHeaders[i], hx + 3, y + 1);
          hx += colWidths[i];
        }
        y += 7;

        // Table rows
        let rowIdx = 0;
        for (const key of gridMetrics) {
          if (y + 7 > H - 20) {
            y = startNewPage();
            // Re-render header
            setF(C.primary); doc.rect(M, y - 3, CW, 7, "F");
            doc.setFontSize(7.5); setC(C.white);
            hx = M;
            for (let i = 0; i < tableHeaders.length; i++) {
              doc.text(tableHeaders[i], hx + 3, y + 1);
              hx += colWidths[i];
            }
            y += 7; rowIdx = 0;
          }

          const val = section.metrics[key];
          const prevVal = section.prevMetrics[key];

          if (rowIdx % 2 === 0) {
            setF(C.offWhite); doc.rect(M, y - 3, CW, 7, "F");
          }

          doc.setFontSize(7.5);
          let rx = M;
          // Metric name
          setC(C.black); doc.text(METRIC_LABELS[key] ?? key, rx + 3, y + 1);
          rx += colWidths[0];
          // This month
          doc.text(formatMetricValue(key, val), rx + 3, y + 1);
          rx += colWidths[1];
          // Last month
          if (prevVal !== undefined) {
            doc.text(formatMetricValue(key, prevVal), rx + 3, y + 1);
          } else {
            setC(C.grey); doc.text("—", rx + 3, y + 1);
          }
          rx += colWidths[2];
          // Change
          if (prevVal !== undefined && prevVal !== 0) {
            const change = calcChange(val, prevVal);
            const color = getChangeColor(key, change.dir);
            setC(color);
            const arrow = change.dir === "up" ? "▲" : change.dir === "down" ? "▼" : "—";
            doc.text(`${arrow} ${Math.abs(change.pct).toFixed(1)}%`, rx + 3, y + 1);
          } else {
            setC(C.grey); doc.text("New", rx + 3, y + 1);
          }

          y += 7; rowIdx++;
        }
        y += 4;
      } else if (!hasPrev) {
        if (y + 10 > H - 20) y = startNewPage();
        doc.setFontSize(9); setC(C.grey);
        doc.text("No previous month data available for comparison — this is your first month tracked.", M, y);
        y += 8;
      }

      // ── TOP CONTENT TABLE (social platforms) ──
      if (section.topContent.length > 0) {
        if (y + 20 > H - 20) y = startNewPage();
        doc.setFontSize(11); setC(C.black);
        doc.text("Top Performing Content", M, y); y += 7;

        const topItems = section.topContent.slice(0, 5) as Record<string, unknown>[];
        for (const item of topItems) {
          if (y + 10 > H - 20) y = startNewPage();
          doc.setFontSize(8); setC(C.black);
          const name = String(item.name || item.campaign_name || item.title || "—").substring(0, 80);
          doc.text(`•  ${name}`, M + 2, y);
          y += 5;
          const details: string[] = [];
          if (item.spend !== undefined) details.push(`Spend: ${currSymbol}${Number(item.spend).toFixed(2)}`);
          if (item.impressions !== undefined) details.push(`Impressions: ${Number(item.impressions).toLocaleString()}`);
          if (item.clicks !== undefined) details.push(`Clicks: ${Number(item.clicks).toLocaleString()}`);
          if (item.engagement !== undefined) details.push(`Engagement: ${Number(item.engagement).toLocaleString()}`);
          if (item.views !== undefined) details.push(`Views: ${Number(item.views).toLocaleString()}`);
          if (details.length > 0) {
            doc.setFontSize(7); setC(C.grey);
            doc.text(details.join("  |  "), M + 8, y);
            y += 5;
          }
          y += 2;
        }
        y += 4;
      }

      // ── WHAT THIS MEANS FOR YOU ──
      if (platformInsight) {
        if (y + 20 > H - 20) y = startNewPage();
        doc.setFontSize(10); setC(C.primary);
        doc.text("What This Means for You", M, y); y += 6;

        // Generate simple bullet points from the metrics
        const bullets: string[] = [];
        const totalReach = section.metrics.reach ?? section.metrics.impressions ?? 0;
        const totalEng = section.metrics.engagement ?? ((section.metrics.likes ?? 0) + (section.metrics.comments ?? 0) + (section.metrics.shares ?? 0));

        if (totalReach > 0) {
          const perDay = Math.round(totalReach / daysInMonth);
          bullets.push(`Your content reached ${totalReach.toLocaleString()} people this month — that's roughly ${perDay.toLocaleString()} people per day discovering your business.`);
        }
        if (totalEng > 0) {
          bullets.push(`${totalEng.toLocaleString()} people actively engaged with your content — each interaction helps spread your message further.`);
        }
        if (section.metrics.follower_growth && section.metrics.follower_growth > 0) {
          bullets.push(`You gained ${section.metrics.follower_growth.toLocaleString()} new followers — your audience is growing steadily.`);
        }

        doc.setFontSize(8.5); setC(C.black);
        for (const bullet of bullets.slice(0, 3)) {
          if (y + 8 > H - 20) y = startNewPage();
          y = wrapText(`•  ${bullet}`, M + 2, y, CW - 8, 4.5);
          y += 2;
        }
      }
    }

    // ═══════ MONTHLY SUMMARY PAGE ═══════
    y = startNewPage();
    pageToc.push({ title: "Monthly Summary", page: pageCount });

    doc.setFontSize(22); setC(C.black);
    doc.text(labels.monthlySummary, M, y); y += 6;
    setF(C.primary); doc.rect(M, y, 50, 1.2, "F"); y += 10;

    // Executive summary paragraph
    doc.setFontSize(10); setC(C.black);
    y = wrapText(aiSummary, M, y, CW, 5);
    y += 8;

    // Traffic light table
    doc.setFontSize(12); setC(C.black);
    doc.text("Platform Status Overview", M, y); y += 7;

    const summaryColWidths = [CW * 0.25, CW * 0.12, CW * 0.63];
    setF(C.primary); doc.rect(M, y - 3, CW, 7, "F");
    doc.setFontSize(7.5); setC(C.white);
    doc.text("Platform", M + 3, y + 1);
    doc.text("Status", M + summaryColWidths[0] + 3, y + 1);
    doc.text("Verdict", M + summaryColWidths[0] + summaryColWidths[1] + 3, y + 1);
    y += 7;

    for (let i = 0; i < platformSections.length; i++) {
      if (y + 8 > H - 20) y = startNewPage();
      const section = platformSections[i];
      if (i % 2 === 0) {
        setF(C.offWhite); doc.rect(M, y - 3, CW, 8, "F");
      }

      // Determine traffic light — use primary metric
      const primaryMetric = Object.keys(section.metrics).find(k => typeof section.metrics[k] === "number" && section.prevMetrics[k] !== undefined && section.prevMetrics[k] !== 0);
      let tl = { color: C.amber, label: "Steady" };
      if (primaryMetric) {
        const change = calcChange(section.metrics[primaryMetric], section.prevMetrics[primaryMetric]);
        tl = getTrafficLight(primaryMetric, change.pct);
      } else if (Object.keys(section.prevMetrics).length === 0) {
        tl = { color: C.green, label: "First month" };
      }

      // Platform name
      doc.setFontSize(8); setC(C.black);
      doc.text(section.label, M + 3, y + 2);

      // Traffic light dot + label
      setF(tl.color); doc.circle(M + summaryColWidths[0] + 8, y + 0.5, 2.5, "F");
      doc.setFontSize(7); setC(C.black);
      doc.text(tl.label, M + summaryColWidths[0] + 14, y + 2);

      // One-sentence verdict
      const insight = aiPlatformInsights[section.platform];
      if (insight) {
        const firstSentence = insight.split(/[.!?]/)[0] + ".";
        doc.setFontSize(7); setC(C.grey);
        const vLines = doc.splitTextToSize(firstSentence.substring(0, 120), summaryColWidths[2] - 6);
        doc.text(vLines[0], M + summaryColWidths[0] + summaryColWidths[1] + 3, y + 2);
      }

      y += 8;
    }
    y += 8;

    // Key wins
    doc.setFontSize(11); setC(C.primary);
    doc.text(labels.keyWins, M, y); y += 7;
    doc.setFontSize(9); setC(C.black);

    // Find top 3 improving metrics
    const improvements: { label: string; pct: number }[] = [];
    for (const section of platformSections) {
      for (const key of section.enabledMetrics) {
        const val = section.metrics[key];
        const prevVal = section.prevMetrics[key];
        if (typeof val === "number" && typeof prevVal === "number" && prevVal > 0) {
          const change = calcChange(val, prevVal);
          const isPositive = LOWER_IS_BETTER.has(key) ? change.dir === "down" : change.dir === "up";
          if (isPositive) {
            improvements.push({ label: `${section.label}: ${METRIC_LABELS[key] ?? key} ${change.dir === "up" ? "up" : "improved"} ${Math.abs(change.pct).toFixed(1)}%`, pct: Math.abs(change.pct) });
          }
        }
      }
    }
    improvements.sort((a, b) => b.pct - a.pct);
    for (const win of improvements.slice(0, 3)) {
      y = wrapText(`•  ${win.label}`, M + 2, y, CW - 8, 4.5);
      y += 2;
    }
    if (improvements.length === 0) {
      y = wrapText("•  This is your first reporting month — we'll track improvements from here.", M + 2, y, CW - 8, 4.5);
      y += 2;
    }
    y += 6;

    // Worth keeping an eye on
    const declines: { label: string; pct: number }[] = [];
    for (const section of platformSections) {
      for (const key of section.enabledMetrics) {
        const val = section.metrics[key];
        const prevVal = section.prevMetrics[key];
        if (typeof val === "number" && typeof prevVal === "number" && prevVal > 0) {
          const change = calcChange(val, prevVal);
          const isNegative = LOWER_IS_BETTER.has(key) ? change.dir === "up" : change.dir === "down";
          if (isNegative && Math.abs(change.pct) > 5) {
            declines.push({ label: `${section.label}: ${METRIC_LABELS[key] ?? key} ${change.dir === "down" ? "decreased" : "increased"} ${Math.abs(change.pct).toFixed(1)}% — worth monitoring next month`, pct: Math.abs(change.pct) });
          }
        }
      }
    }
    if (declines.length > 0) {
      doc.setFontSize(11); setC(C.amber);
      doc.text(labels.watchList, M, y); y += 7;
      doc.setFontSize(9); setC(C.black);
      declines.sort((a, b) => b.pct - a.pct);
      for (const d of declines.slice(0, 2)) {
        y = wrapText(`•  ${d.label}`, M + 2, y, CW - 8, 4.5);
        y += 2;
      }
    }

    // ═══════ UPSELL PAGE (if scheduled) ═══════
    if (upsellData) {
      y = startNewPage();
      pageToc.push({ title: `${labels.aNoteFrom} ${orgName}`, page: pageCount });

      doc.setFontSize(22); setC(C.primary);
      doc.text(`${labels.aNoteFrom} ${orgName}`, M, y); y += 6;
      setF(C.primary); doc.rect(M, y, 50, 1.2, "F"); y += 12;

      // Headline
      doc.setFontSize(16); setC(C.black);
      const headlineLines = doc.splitTextToSize(upsellData.headline, CW);
      for (const line of headlineLines) {
        doc.text(line, M, y); y += 7;
      }
      y += 6;

      // Body content
      doc.setFontSize(10); setC(C.black);
      y = wrapText(upsellData.body_content, M, y, CW, 5);
      y += 8;

      // Comparison table if provided
      if (upsellData.comparison_data && Array.isArray(upsellData.comparison_data)) {
        const compData = upsellData.comparison_data as { label: string; option_a: string; option_b: string }[];
        if (compData.length > 0) {
          const compColW = [CW * 0.34, CW * 0.33, CW * 0.33];
          // Header
          setF(C.primary); doc.rect(M, y - 3, CW, 7, "F");
          doc.setFontSize(8); setC(C.white);
          doc.text("Feature", M + 3, y + 1);
          doc.text(compData[0]?.option_a ? "Option A" : "", M + compColW[0] + 3, y + 1);
          doc.text(compData[0]?.option_b ? "Option B" : "", M + compColW[0] + compColW[1] + 3, y + 1);
          y += 7;

          for (let i = 0; i < compData.length; i++) {
            if (y + 7 > H - 20) y = startNewPage();
            if (i % 2 === 0) { setF(C.offWhite); doc.rect(M, y - 3, CW, 7, "F"); }
            doc.setFontSize(7.5); setC(C.black);
            doc.text(compData[i].label, M + 3, y + 1);
            doc.text(compData[i].option_a ?? "", M + compColW[0] + 3, y + 1);
            doc.text(compData[i].option_b ?? "", M + compColW[0] + compColW[1] + 3, y + 1);
            y += 7;
          }
          y += 6;
        }
      }

      // CTA
      doc.setFontSize(10); setC(C.primary);
      doc.text(labels.interestedCTA, M, y);
    }

    // ═══════ END PAGE ═══════
    y = startNewPage();
    setF(C.primary); doc.rect(0, 0, W, H, "F");

    // Logo
    if (showLogo && org?.logo_url) {
      try {
        const logoRes = await fetch(org.logo_url);
        if (logoRes.ok) {
          const logoBlob = await logoRes.arrayBuffer();
          const logoBase64 = btoa(String.fromCharCode(...new Uint8Array(logoBlob)));
          const ext = org.logo_url.toLowerCase().includes(".png") ? "PNG" : "JPEG";
          doc.addImage(`data:image/${ext.toLowerCase()};base64,${logoBase64}`, ext, W / 2 - 25, 35, 50, 50);
        }
      } catch { /* skip */ }
    }

    const firstName = client.full_name.split(" ")[0];
    doc.setFontSize(28); setC(C.white);
    doc.text(`${labels.thankYou}, ${firstName}.`, W / 2, 110, { align: "center" });

    doc.setFontSize(11); setC(C.white);
    const closingText = `This report gives you a clear picture of where things stand. Every number here represents real people discovering your business. We're looking forward to building on this next month.`;
    const closingLines = doc.splitTextToSize(closingText, CW * 0.7);
    let closingY = 130;
    for (const line of closingLines) {
      doc.text(line, W / 2, closingY, { align: "center" });
      closingY += 6;
    }

    closingY += 15;
    doc.setFontSize(10); setC(C.white);
    doc.text(`${labels.preparedBy} ${orgName} | ${MONTH_NAMES[report_month]} ${report_year}`, W / 2, closingY, { align: "center" });

    if (org?.slug) {
      doc.text(org.slug, W / 2, closingY + 8, { align: "center" });
    }

    // Footer
    doc.setFontSize(7); setC(C.white);
    doc.text(`${orgName} | Confidential`, W / 2, H - 8, { align: "center" });

    // ───────── UPLOAD & SAVE ─────────
    const pdfBuffer = doc.output("arraybuffer");
    const pdfUint8 = new Uint8Array(pdfBuffer);

    const storagePath = `${client_id}/${report_year}-${String(report_month).padStart(2, "0")}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(storagePath, pdfUint8, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload PDF" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingReport } = await supabase.from("reports")
      .select("id").eq("client_id", client_id).eq("report_month", report_month).eq("report_year", report_year).maybeSingle();

    const reportData = {
      status: "success" as const,
      pdf_storage_path: storagePath,
      ai_executive_summary: aiSummary,
      ai_insights: JSON.stringify(aiPlatformInsights),
      ai_upsell_recommendations: upsellData ? upsellData.body_content : null,
      generated_at: new Date().toISOString(),
    };

    if (existingReport) {
      await supabase.from("reports").update(reportData).eq("id", existingReport.id);
    } else {
      await supabase.from("reports").insert({ client_id, report_month, report_year, org_id: client.org_id, ...reportData });
    }

    await supabase.from("report_logs").insert({
      client_id, report_id: existingReport?.id ?? null, status: "success", org_id: client.org_id,
    });

    return new Response(JSON.stringify({
      success: true, pdf_path: storagePath,
      message: `Report generated for ${client.company_name} - ${MONTH_NAMES[report_month]} ${report_year}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Report generation error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
