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

// ══════════════════════════════════════════════════════════════
// SECTION TITLE CONSTANTS — hardcoded, never overridden
// ══════════════════════════════════════════════════════════════
const SECTION_TITLES = {
  performanceReport: "Performance Report",
  tableOfContents: "Table of Contents",
  monthlySummary: "Monthly Summary",
  keyWins: "Key Wins This Month",
  worthWatching: "Worth Watching",
  whatThisMeans: "What This Means for You",
  comparison: "Month-on-Month Comparison",
  topContent: "Top Performing Content",
  noteFromAgency: (orgName: string) => `A Note from ${orgName}`,
  thankYou: (firstName: string) => `Thank you, ${firstName}.`,
  preparedBy: (orgName: string, month: string) => `Prepared by ${orgName} | ${month}`,
  platformStatusOverview: "Platform Status Overview",
  noDataAvailable: "No data available for this period",
  preparedFor: "Prepared for",
  thisMonth: "This Month",
  lastMonth: "Last Month",
  change: "Change",
  interestedCTA: "Interested? Reply to this email or call us.",
} as const;

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

// ══════════════════════════════════════════════════════════════
// METRIC LABELS — only metrics with a label here appear in PDF
// ══════════════════════════════════════════════════════════════
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
  total_boards: "Total Boards", roas: "ROAS",
  reel_count: "Reels Published", image_count: "Images Published",
  carousel_count: "Carousels Published", website_clicks: "Website Clicks",
  email_contacts: "Email Taps", media_count: "Total Posts",
  profile_views: "Profile Views", bio_link_clicks: "Bio Link Clicks",
  total_video_count: "Total Videos", total_likes_received: "Total Likes Received",
  following: "Following", completion_rate: "Completion Rate",
  average_time_watched: "Avg. Watch Time (s)", new_followers: "New Followers",
  cta_clicks: "CTA Clicks", engaged_users: "Engaged Users",
  paid_reach: "Paid Reach", paid_video_views: "Paid Video Views",
  total_impressions: "Total Impressions", total_video_views: "Total Video Views",
};

/** Platform-specific metrics order — max 12 shown in grid */
const PLATFORM_AVAILABLE_METRICS: Record<string, string[]> = {
  google_ads: ["spend", "impressions", "clicks", "ctr", "conversions", "conversions_value", "conversion_rate", "cpc", "cpm", "cost_per_conversion", "roas", "reach"],
  meta_ads: ["spend", "impressions", "reach", "clicks", "link_clicks", "ctr", "leads", "cpc", "cpm", "cost_per_lead", "frequency"],
  facebook: ["views", "reach", "engagement", "engagement_rate", "reactions", "comments", "shares", "total_followers", "follower_growth", "posts_published"],
  instagram: ["total_followers", "follower_growth", "profile_visits", "reach", "engagement", "engagement_rate", "likes", "comments", "shares", "saves", "posts_published", "video_views"],
  tiktok: ["total_followers", "follower_growth", "video_views", "profile_views", "likes", "comments", "shares", "engagement_rate", "total_likes_received", "total_video_count"],
  linkedin: ["total_followers", "follower_growth", "impressions", "engagement", "engagement_rate", "likes", "comments", "shares", "clicks", "posts_published"],
  google_search_console: ["search_clicks", "search_impressions", "search_ctr", "search_position"],
  google_analytics: ["sessions", "active_users", "new_users", "ga_page_views", "bounce_rate", "avg_session_duration", "pages_per_session"],
  google_business_profile: ["gbp_views", "gbp_searches", "gbp_calls", "gbp_direction_requests", "gbp_website_clicks", "gbp_reviews_count", "gbp_average_rating"],
  youtube: ["subscribers", "views", "watch_time", "videos_published", "avg_view_duration"],
  pinterest: ["impressions", "saves", "pin_clicks", "outbound_clicks", "engagement", "engagement_rate", "total_followers", "total_pins", "total_boards"],
};

/** Key metrics per platform for traffic light and summary generation */
const PLATFORM_KEY_METRICS: Record<string, string[]> = {
  google_ads: ["conversions", "cpc", "ctr", "roas", "spend"],
  meta_ads: ["leads", "cpc", "ctr", "reach", "spend"],
  facebook: ["reach", "engagement", "engagement_rate", "follower_growth"],
  instagram: ["reach", "engagement", "engagement_rate", "follower_growth", "profile_visits"],
  tiktok: ["video_views", "engagement_rate", "follower_growth", "likes"],
  linkedin: ["impressions", "engagement", "engagement_rate", "follower_growth"],
  google_search_console: ["search_clicks", "search_impressions", "search_ctr", "search_position"],
  google_analytics: ["sessions", "active_users", "bounce_rate", "avg_session_duration"],
  google_business_profile: ["gbp_views", "gbp_searches", "gbp_calls", "gbp_website_clicks"],
  youtube: ["views", "subscribers", "watch_time", "avg_view_duration"],
  pinterest: ["impressions", "saves", "pin_clicks", "outbound_clicks"],
};

/** Metrics where a decrease is positive */
const INVERTED_METRICS = new Set(["spend", "cpc", "cpm", "cost_per_conversion", "cost_per_lead", "bounce_rate", "search_position"]);

/** Metrics that should always be shown even if zero */
const ALWAYS_SHOW_METRICS = new Set(["spend", "total_followers", "followers", "posts_published", "videos_published"]);

/** Hidden internal metrics */
const HIDDEN_METRICS = new Set(["campaign_count", "pages_count", "unfollows", "post_views", "post_clicks"]);

/** Platforms that get max 1 page */
const ONE_PAGE_PLATFORMS = new Set(["google_search_console", "google_business_profile", "youtube"]);

// ══════════════════════════════════════════════════════════════
// COLOUR HELPERS
// ══════════════════════════════════════════════════════════════
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
};

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
    const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p2 = 2 * l - q2;
    r = hue2rgb(p2, q2, h + 1/3);
    g = hue2rgb(p2, q2, h);
    b = hue2rgb(p2, q2, h - 1/3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const parseColorToRgb = (color: string | null, fallback: [number, number, number]): [number, number, number] => {
  if (!color) return fallback;
  if (color.startsWith("#")) return hexToRgb(color);
  try { return hexToRgb(hslToHex(color)); } catch { return fallback; }
};

/** Lighten an RGB color by blending toward white */
const lighten = (rgb: [number, number, number], amount: number): [number, number, number] => [
  Math.round(rgb[0] + (255 - rgb[0]) * amount),
  Math.round(rgb[1] + (255 - rgb[1]) * amount),
  Math.round(rgb[2] + (255 - rgb[2]) * amount),
];

/** Darken an RGB color */
const darken = (rgb: [number, number, number], amount: number): [number, number, number] => [
  Math.round(rgb[0] * (1 - amount)),
  Math.round(rgb[1] * (1 - amount)),
  Math.round(rgb[2] * (1 - amount)),
];

const DEFAULTS = {
  offWhite: [248, 248, 248] as [number, number, number],
  cardBg: [245, 245, 247] as [number, number, number],
  black: [26, 26, 26] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  grey: [120, 120, 120] as [number, number, number],
  lightGrey: [220, 220, 220] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  summaryBg: [240, 247, 255] as [number, number, number],
  summaryBorder: [83, 155, 219] as [number, number, number],
  coverDark: [26, 26, 26] as [number, number, number],
  coverDarkPanel: [36, 36, 36] as [number, number, number],
  tableAltRow: [250, 250, 250] as [number, number, number],
};

// ══════════════════════════════════════════════════════════════
// TEMPLATE-BASED SUMMARY GENERATION (NO AI)
// ══════════════════════════════════════════════════════════════

interface PlatformData {
  platform: string;
  label: string;
  description: string;
  metrics: Record<string, number>;
  prevMetrics: Record<string, number>;
  enabledMetrics: string[];
  topContent: unknown[];
  hasPrevSnapshot: boolean;
  hasData: boolean;
}

function formatMetricValueFn(key: string, val: number, currSymbol: string): string {
  if (["spend", "cpc", "cost_per_conversion", "cost_per_lead", "conversions_value"].includes(key))
    return `${currSymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (["ctr", "engagement_rate", "conversion_rate", "audience_growth_rate", "search_ctr", "bounce_rate", "search_impression_share", "completion_rate"].includes(key))
    return `${val.toFixed(2)}%`;
  if (["search_position", "gbp_average_rating"].includes(key)) return val.toFixed(1);
  if (["cpm"].includes(key)) return `${currSymbol}${val.toFixed(2)}`;
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return val % 1 !== 0 ? val.toFixed(2) : val.toLocaleString();
}

function calcChange(curr: number, prev: number): { pct: number; abs: number; dir: string } {
  if (prev === 0) return { pct: 0, abs: curr, dir: curr === 0 ? "flat" : "new" };
  const pct = ((curr - prev) / prev) * 100;
  return { pct, abs: curr - prev, dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

function generatePlatformSummary(
  platform: string,
  metrics: Record<string, number>,
  prevMetrics: Record<string, number> | null,
  currSymbol: string
): string {
  const lines: string[] = [];
  const platformLabel = PLATFORM_LABELS[platform] ?? platform;
  const isFirstMonth = !prevMetrics || Object.keys(prevMetrics).length === 0;
  const keyMetrics = PLATFORM_KEY_METRICS[platform] ?? [];

  if (isFirstMonth) {
    lines.push(`This is the first month of data for ${platformLabel}.`);
    lines.push(`No previous month comparison is available yet — next month's report will show your first month-on-month trends.`);
    return lines.join(" ");
  }

  // Find best performing key metric
  let bestMetric = "";
  let bestChange = 0;
  for (const key of keyMetrics) {
    if (HIDDEN_METRICS.has(key)) continue;
    const curr = metrics[key];
    const prev = prevMetrics[key];
    if (curr === undefined || prev === undefined || prev === 0) continue;
    const change = ((curr - prev) / prev) * 100;
    const effective = INVERTED_METRICS.has(key) ? -change : change;
    if (effective > bestChange) {
      bestChange = effective;
      bestMetric = key;
    }
  }

  // Find worst performing key metric
  let worstMetric = "";
  let worstChange = 0;
  for (const key of keyMetrics) {
    if (HIDDEN_METRICS.has(key)) continue;
    const curr = metrics[key];
    const prev = prevMetrics[key];
    if (curr === undefined || prev === undefined || prev === 0) continue;
    const change = ((curr - prev) / prev) * 100;
    const effective = INVERTED_METRICS.has(key) ? -change : change;
    if (effective < worstChange) {
      worstChange = effective;
      worstMetric = key;
    }
  }

  if (bestMetric) {
    const label = METRIC_LABELS[bestMetric] ?? bestMetric;
    const val = formatMetricValueFn(bestMetric, metrics[bestMetric], currSymbol);
    const rawChange = ((metrics[bestMetric] - (prevMetrics[bestMetric] ?? 0)) / (prevMetrics[bestMetric] || 1)) * 100;
    const direction = INVERTED_METRICS.has(bestMetric)
      ? (rawChange < 0 ? `improved ${Math.abs(Math.round(rawChange))}%` : `up ${Math.round(rawChange)}%`)
      : `up ${Math.round(Math.abs(rawChange))}%`;
    lines.push(`The standout result this month was ${label}, which reached ${val} — ${direction} from last month.`);
  }

  if (worstMetric && Math.abs(worstChange) > 10) {
    const label = METRIC_LABELS[worstMetric] ?? worstMetric;
    const rawChange = ((metrics[worstMetric] - (prevMetrics[worstMetric] ?? 0)) / (prevMetrics[worstMetric] || 1)) * 100;
    lines.push(`${label} moved ${Math.abs(Math.round(rawChange))}% compared to last month — worth keeping an eye on.`);
  }

  // Engagement rate commentary
  if (metrics.engagement_rate !== undefined) {
    const rate = metrics.engagement_rate;
    if (rate > 3) lines.push(`Your engagement rate of ${rate.toFixed(1)}% is strong — your audience is actively responding to your content.`);
    else if (rate > 1) lines.push(`Your engagement rate is ${rate.toFixed(1)}% — a solid baseline, with room to grow through more interactive content.`);
    else lines.push(`Engagement rate is at ${rate.toFixed(1)}% — consider experimenting with different content formats to encourage more interaction.`);
  }

  // Follower growth commentary
  if (metrics.follower_growth !== undefined && metrics.total_followers !== undefined) {
    if (metrics.follower_growth > 0) {
      lines.push(`You gained ${metrics.follower_growth.toLocaleString()} new followers this month, bringing your total to ${formatMetricValueFn("total_followers", metrics.total_followers, currSymbol)}.`);
    } else if (metrics.follower_growth === 0) {
      lines.push(`Your follower count held steady at ${formatMetricValueFn("total_followers", metrics.total_followers, currSymbol)}.`);
    }
  }

  if (lines.length === 0) {
    lines.push(`${platformLabel} performance was steady this month with no major changes.`);
  }

  return lines.join(" ");
}

function getPlatformStatus(
  platform: string,
  metrics: Record<string, number>,
  prevMetrics: Record<string, number> | null
): "Strong" | "Steady" | "Needs Attention" {
  if (!prevMetrics || Object.keys(prevMetrics).length === 0) return "Steady";
  const keyMetrics = PLATFORM_KEY_METRICS[platform] ?? [];
  let positiveCount = 0;
  let negativeCount = 0;

  for (const key of keyMetrics) {
    const curr = metrics[key];
    const prev = prevMetrics[key];
    if (curr === undefined || prev === undefined || prev === 0) continue;
    const change = (curr - prev) / prev;
    const isInverted = INVERTED_METRICS.has(key);
    if (isInverted ? change < -0.05 : change > 0.05) positiveCount++;
    if (isInverted ? change > 0.05 : change < -0.05) negativeCount++;
  }

  if (positiveCount >= negativeCount + 2) return "Strong";
  if (negativeCount >= positiveCount + 2) return "Needs Attention";
  return "Steady";
}

function getKeyWins(allPlatformData: PlatformData[], currSymbol: string): string[] {
  const wins: { platform: string; metric: string; change: number; value: string }[] = [];
  const seenPlatforms = new Set<string>();

  for (const { platform, metrics, prevMetrics } of allPlatformData) {
    if (seenPlatforms.has(platform)) continue;
    const keyMetrics = PLATFORM_KEY_METRICS[platform] ?? [];
    let bestKey = "";
    let bestChange = 0;
    for (const key of keyMetrics) {
      if (HIDDEN_METRICS.has(key) || !METRIC_LABELS[key]) continue;
      const curr = metrics[key];
      const prev = prevMetrics?.[key];
      if (!curr || !prev || prev === 0) continue;
      const rawChange = ((curr - prev) / prev) * 100;
      const effective = INVERTED_METRICS.has(key) ? -rawChange : rawChange;
      if (effective > bestChange && effective > 10) {
        bestChange = effective;
        bestKey = key;
      }
    }
    if (bestKey) {
      seenPlatforms.add(platform);
      wins.push({
        platform: PLATFORM_LABELS[platform] ?? platform,
        metric: METRIC_LABELS[bestKey]!,
        change: bestChange,
        value: formatMetricValueFn(bestKey, metrics[bestKey], currSymbol),
      });
    }
  }

  return wins
    .sort((a, b) => b.change - a.change)
    .slice(0, 5)
    .map(w => `${w.platform}: ${w.metric} reached ${w.value} — up ${Math.round(w.change)}% from last month`);
}

function getWorthWatching(allPlatformData: PlatformData[]): string[] {
  const items: { text: string; pct: number }[] = [];
  const seenPlatforms = new Set<string>();

  for (const { platform, metrics, prevMetrics, label } of allPlatformData) {
    if (seenPlatforms.has(platform)) continue;
    const keyMetrics = PLATFORM_KEY_METRICS[platform] ?? [];
    let worstKey = "";
    let worstEffective = 0;
    for (const key of keyMetrics) {
      if (HIDDEN_METRICS.has(key) || !METRIC_LABELS[key]) continue;
      const curr = metrics[key];
      const prev = prevMetrics?.[key];
      if (curr === undefined || !prev || prev === 0) continue;
      const rawChange = ((curr - prev) / prev) * 100;
      const effective = INVERTED_METRICS.has(key) ? -rawChange : rawChange;
      if (effective < worstEffective && effective < -5) {
        worstEffective = effective;
        worstKey = key;
      }
    }
    if (worstKey) {
      seenPlatforms.add(platform);
      const rawChange = ((metrics[worstKey] - (prevMetrics?.[worstKey] ?? 0)) / (prevMetrics?.[worstKey] || 1)) * 100;
      const direction = rawChange < 0 ? "decreased" : "increased";
      const pctStr = Math.abs(rawChange) >= 100 ? Math.round(Math.abs(rawChange)).toLocaleString() : Math.abs(rawChange).toFixed(1);
      items.push({
        text: `${label}: ${METRIC_LABELS[worstKey]} ${direction} ${pctStr}% — worth monitoring next month`,
        pct: Math.abs(worstEffective),
      });
    }
  }

  return items.sort((a, b) => b.pct - a.pct).slice(0, 3).map(i => i.text);
}

// ══════════════════════════════════════════════════════════════
// DATA CLEANUP
// ══════════════════════════════════════════════════════════════
function cleanMetricsForDisplay(
  platform: string,
  metrics: Record<string, number>,
  prevMetrics: Record<string, number> | null
): string[] {
  const allowed = PLATFORM_AVAILABLE_METRICS[platform] ?? [];
  const result: string[] = [];

  for (const key of allowed) {
    if (HIDDEN_METRICS.has(key)) continue;
    const val = metrics[key];
    if (val === undefined || val === null) continue;
    if (!ALWAYS_SHOW_METRICS.has(key) && val === 0 && (!prevMetrics || !prevMetrics[key] || prevMetrics[key] === 0)) continue;
    const label = METRIC_LABELS[key];
    if (!label) continue;
    result.push(key);
  }

  return result.slice(0, 12);
}

function getPostCaption(item: Record<string, unknown>): string {
  let caption = String(item.message || item.caption || item.text || item.title || item.name || item.campaign_name || "").trim();
  if (!caption || caption === "—" || caption === "undefined" || caption === "null") {
    const postDate = item.created_time || item.date || item.published_at || item.timestamp || "";
    caption = postDate ? `Post published on ${String(postDate).substring(0, 10)}` : "Post published this month";
  }
  if (caption.length > 80) caption = caption.substring(0, 77) + "...";
  return caption;
}

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════

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

    // ── FETCH ALL DATA ──
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

    // Auth check
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

    // Org branding
    const { data: org } = await supabase.from("organisations").select("*").eq("id", client.org_id).single();
    const orgName = org?.name ?? "Your Agency";
    const reportSettings = (org?.report_settings ?? {}) as Record<string, unknown>;
    const showLogo = reportSettings.show_logo !== false;
    const reportAccentColor = (reportSettings.report_accent_color as string) || null;

    const primaryColor = parseColorToRgb(reportAccentColor || org?.primary_color, [179, 47, 191]);
    const secondaryColor = parseColorToRgb(org?.secondary_color, [83, 155, 219]);

    const C = {
      offWhite: DEFAULTS.offWhite,
      cardBg: DEFAULTS.cardBg,
      black: DEFAULTS.black,
      primary: primaryColor,
      primaryLight: lighten(primaryColor, 0.85),
      primaryMid: lighten(primaryColor, 0.7),
      secondary: secondaryColor,
      secondaryLight: lighten(secondaryColor, 0.88),
      green: DEFAULTS.green,
      greenLight: lighten(DEFAULTS.green, 0.88),
      amber: DEFAULTS.amber,
      amberLight: lighten(DEFAULTS.amber, 0.88),
      red: DEFAULTS.red,
      redLight: lighten(DEFAULTS.red, 0.88),
      white: DEFAULTS.white,
      grey: DEFAULTS.grey,
      lightGrey: DEFAULTS.lightGrey,
      summaryBg: DEFAULTS.summaryBg,
      summaryBorder: secondaryColor,
      coverDark: DEFAULTS.coverDark,
      coverDarkPanel: DEFAULTS.coverDarkPanel,
      tableAltRow: DEFAULTS.tableAltRow,
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

    // Fetch upsell
    const { data: upsellData } = await supabase.from("report_upsells")
      .select("*").eq("client_id", client_id).eq("report_month", report_month)
      .eq("report_year", report_year).eq("is_active", true).limit(1).maybeSingle();

    // ── BUILD PLATFORM DATA ──
    const platformSections: PlatformData[] = [];
    const noDataPlatforms: string[] = [];

    for (const snapshot of snapshots) {
      const config = configs.find((c: Record<string, unknown>) => c.platform === snapshot.platform);
      const metrics = snapshot.metrics_data as Record<string, number>;
      const prevSnapshot = prevSnapshots.find((s: Record<string, unknown>) => s.platform === snapshot.platform);
      const prevMetrics = (prevSnapshot?.metrics_data ?? {}) as Record<string, number>;
      const hasPrevSnapshot = !!prevSnapshot;
      const topContent = Array.isArray(snapshot.top_content) ? snapshot.top_content : [];

      // Clean metrics for display
      let enabledMetrics: string[];
      if (config?.enabled_metrics?.length > 0) {
        const configMetrics = (config.enabled_metrics as string[]).filter((k: string) => METRIC_LABELS[k] && !HIDDEN_METRICS.has(k));
        enabledMetrics = configMetrics.filter(k => {
          if (ALWAYS_SHOW_METRICS.has(k)) return true;
          const curr = metrics[k] ?? 0;
          const prev = prevMetrics[k] ?? 0;
          return curr !== 0 || prev !== 0;
        }).slice(0, 12);
      } else {
        enabledMetrics = cleanMetricsForDisplay(snapshot.platform as string, metrics, hasPrevSnapshot ? prevMetrics : null);
      }

      const hasAnyData = enabledMetrics.some(k => (metrics[k] ?? 0) !== 0);

      if (!hasAnyData) {
        noDataPlatforms.push(PLATFORM_LABELS[snapshot.platform as string] ?? (snapshot.platform as string));
        continue;
      }

      platformSections.push({
        platform: snapshot.platform as string,
        label: PLATFORM_LABELS[snapshot.platform as string] ?? (snapshot.platform as string),
        description: PLATFORM_DESCRIPTIONS[snapshot.platform as string] ?? "performance data for this platform.",
        metrics,
        prevMetrics,
        enabledMetrics,
        topContent,
        hasPrevSnapshot,
        hasData: hasAnyData,
      });
    }

    // ── GENERATE TEMPLATE SUMMARIES (NO AI) ──
    const platformSummaries: Record<string, string> = {};
    for (const section of platformSections) {
      platformSummaries[section.platform] = generatePlatformSummary(
        section.platform,
        section.metrics,
        section.hasPrevSnapshot ? section.prevMetrics : null,
        currSymbol
      );
    }

    const keyWins = getKeyWins(platformSections, currSymbol);
    const worthWatching = getWorthWatching(platformSections);

    // Executive summary (template-based)
    const executiveSummary = (() => {
      const lines: string[] = [];
      lines.push(`This report covers ${client.company_name}'s marketing performance for ${MONTH_NAMES[report_month]} ${report_year}.`);
      if (keyWins.length > 0) {
        lines.push(`The highlight this month: ${keyWins[0]}.`);
      }
      const strongPlatforms = platformSections.filter(s => getPlatformStatus(s.platform, s.metrics, s.hasPrevSnapshot ? s.prevMetrics : null) === "Strong");
      if (strongPlatforms.length > 0) {
        const names = strongPlatforms.map(s => s.label).join(", ");
        lines.push(`${names} ${strongPlatforms.length === 1 ? "is" : "are"} performing strongly this month.`);
      }
      if (worthWatching.length > 0) {
        lines.push(`There are some areas worth monitoring — see the details below.`);
      }
      lines.push(`We look forward to building on these results next month.`);
      return lines.join(" ");
    })();

    // ═══════════════════════════════════════════════════════
    // PDF GENERATION — LANDSCAPE A4 with visual design
    // ═══════════════════════════════════════════════════════
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297, H = 210, M = 14;
    const CW = W - M * 2;

    const setC = (c: number[]) => doc.setTextColor(c[0], c[1], c[2]);
    const setF = (c: number[]) => doc.setFillColor(c[0], c[1], c[2]);
    const setD = (c: number[]) => doc.setDrawColor(c[0], c[1], c[2]);

    let pageCount = 0;
    const pageToc: { title: string; page: number }[] = [];

    const formatVal = (key: string, val: number) => formatMetricValueFn(key, val, currSymbol);

    const getChangeColor = (key: string, dir: string): number[] => {
      if (dir === "flat" || dir === "new") return C.grey;
      const lower = INVERTED_METRICS.has(key);
      if (dir === "up") return lower ? C.red : C.green;
      return lower ? C.green : C.red;
    };

    const addPageFooter = () => {
      // Thin bottom line
      setD(C.lightGrey); doc.setLineWidth(0.3);
      doc.line(M, H - 10, W - M, H - 10);
      doc.setFontSize(6.5); setC(C.grey);
      doc.text(`${orgName}  |  Confidential`, M, H - 6);
      doc.text(`${client.company_name} — ${MONTH_NAMES[report_month]} ${report_year}`, W / 2, H - 6, { align: "center" });
      doc.text(`Page ${pageCount}`, W - M, H - 6, { align: "right" });
    };

    const startNewPage = (): number => {
      if (pageCount > 0) doc.addPage();
      pageCount++;
      // Top accent bar
      setF(C.primary); doc.rect(0, 0, W, 2.5, "F");
      addPageFooter();
      return M + 8;
    };

    const wrapText = (text: string, x: number, y: number, maxW: number, lh: number): number => {
      const lines = doc.splitTextToSize(text, maxW);
      for (const line of lines) {
        if (y > H - 16) { y = startNewPage(); }
        doc.text(line, x, y);
        y += lh;
      }
      return y;
    };

    // ═══════════════════════════════════════
    // PAGE 1: COVER — Dark themed
    // ═══════════════════════════════════════
    pageCount++;
    // Full dark background
    setF(C.coverDark); doc.rect(0, 0, W, H, "F");
    // Top accent bar
    setF(C.primary); doc.rect(0, 0, W, 4, "F");

    // Org logo top-left
    if (showLogo && org?.logo_url) {
      try {
        const logoRes = await fetch(org.logo_url);
        if (logoRes.ok) {
          const logoBlob = await logoRes.arrayBuffer();
          const logoBase64 = btoa(String.fromCharCode(...new Uint8Array(logoBlob)));
          const ext = org.logo_url.toLowerCase().includes(".png") ? "PNG" : "JPEG";
          doc.addImage(`data:image/${ext.toLowerCase()};base64,${logoBase64}`, ext, M + 4, 16, 40, 40);
        }
      } catch { /* skip logo */ }
    }

    // Title block
    doc.setFontSize(10); setC(C.grey);
    doc.text(SECTION_TITLES.performanceReport.toUpperCase(), M + 4, 72);

    doc.setFontSize(38); setC(C.white);
    const companyLines = doc.splitTextToSize(client.company_name, W * 0.6);
    let coverY = 88;
    for (const line of companyLines) {
      doc.text(line, M + 4, coverY);
      coverY += 15;
    }

    coverY += 4;
    doc.setFontSize(12); setC(C.primary);
    doc.text(`${MONTH_NAMES[report_month]} ${report_year}`, M + 4, coverY);
    coverY += 8;
    doc.setFontSize(10); setC(C.grey);
    doc.text(`${SECTION_TITLES.preparedFor}: ${client.full_name}`, M + 4, coverY);

    // 3 Hero KPIs at bottom
    const allMetrics: Record<string, number> = {};
    for (const s of platformSections) {
      for (const [k, v] of Object.entries(s.metrics)) {
        if (typeof v === "number") allMetrics[k] = (allMetrics[k] ?? 0) + v;
      }
    }

    const heroMetricCandidates = [
      { key: "reach", label: "People Reached" },
      { key: "impressions", label: "Impressions" },
      { key: "engagement", label: "Engagements" },
      { key: "clicks", label: "Clicks" },
      { key: "search_clicks", label: "Search Clicks" },
      { key: "views", label: "Views" },
      { key: "sessions", label: "Sessions" },
      { key: "total_followers", label: "Followers" },
      { key: "conversions", label: "Conversions" },
      { key: "leads", label: "Leads" },
    ];
    const heroMetrics = heroMetricCandidates
      .filter(h => (allMetrics[h.key] ?? 0) > 0)
      .sort((a, b) => (allMetrics[b.key] ?? 0) - (allMetrics[a.key] ?? 0))
      .slice(0, 3);

    const kpiBarY = H - 50;
    const kpiW = (W - M * 2 - 8) / 3;
    heroMetrics.forEach((hero, i) => {
      const x = M + i * (kpiW + 4);
      setF(C.coverDarkPanel); doc.roundedRect(x, kpiBarY, kpiW, 36, 2, 2, "F");
      // Accent top edge
      setF(C.primary); doc.rect(x, kpiBarY, kpiW, 2, "F");
      // Value
      doc.setFontSize(26); setC(C.primary);
      doc.text(formatVal(hero.key, allMetrics[hero.key]), x + kpiW / 2, kpiBarY + 18, { align: "center" });
      // Label
      doc.setFontSize(7.5); setC(C.grey);
      doc.text(hero.label.toUpperCase(), x + kpiW / 2, kpiBarY + 28, { align: "center" });
    });

    // Cover footer
    doc.setFontSize(6.5); setC(C.grey);
    doc.text(`${orgName}  |  Confidential`, W / 2, H - 6, { align: "center" });

    // ═══════════════════════════════════════
    // PAGE 2: TABLE OF CONTENTS
    // ═══════════════════════════════════════
    let y = startNewPage();
    doc.setFontSize(20); setC(C.black);
    doc.text(SECTION_TITLES.tableOfContents, M, y); y += 5;
    setF(C.primary); doc.rect(M, y, 40, 1.5, "F"); y += 10;

    const prevMonth = report_month === 1 ? 12 : report_month - 1;
    const prevYear = report_month === 1 ? report_year - 1 : report_year;
    const prevMonthName = MONTH_NAMES[prevMonth];
    const daysInMonth = new Date(report_year, report_month, 0).getDate();

    doc.setFontSize(9); setC(C.grey);
    y = wrapText(
      `This report covers performance from 1 ${MONTH_NAMES[report_month]} ${report_year} to ${daysInMonth} ${MONTH_NAMES[report_month]} ${report_year}. All figures compared to ${prevMonthName} ${prevYear} unless stated otherwise.`,
      M, y, CW, 5
    );
    y += 10;

    // TOC entries
    let tocIndex = 1;
    for (const section of platformSections) {
      // Section row with number
      setF(C.cardBg); doc.roundedRect(M, y - 4, CW, 14, 2, 2, "F");
      setF(C.primary); doc.rect(M, y - 4, 3, 14, "F");
      doc.setFontSize(11); setC(C.black);
      doc.text(`${tocIndex}. ${section.label}`, M + 8, y + 2);
      doc.setFontSize(7.5); setC(C.grey);
      doc.text(`Performance metrics, comparison, and analysis`, M + 8, y + 7);
      const status = getPlatformStatus(section.platform, section.metrics, section.hasPrevSnapshot ? section.prevMetrics : null);
      const statusColor = status === "Strong" ? C.green : status === "Needs Attention" ? C.red : C.amber;
      setF(statusColor); doc.circle(W - M - 10, y + 2, 2.5, "F");
      doc.setFontSize(7); setC(statusColor);
      doc.text(status, W - M - 30, y + 3);
      y += 18;
      tocIndex++;
    }

    // No data platforms
    for (const label of noDataPlatforms) {
      doc.setFontSize(10); setC(C.grey);
      doc.text(`${label} — ${SECTION_TITLES.noDataAvailable}`, M + 8, y + 2);
      y += 10;
    }

    // Summary entry
    setF(C.cardBg); doc.roundedRect(M, y - 4, CW, 14, 2, 2, "F");
    setF(C.primary); doc.rect(M, y - 4, 3, 14, "F");
    doc.setFontSize(11); setC(C.black);
    doc.text(`${tocIndex}. ${SECTION_TITLES.monthlySummary}`, M + 8, y + 2);
    doc.setFontSize(7.5); setC(C.grey);
    doc.text("Overall performance across all platforms with traffic light status", M + 8, y + 7);
    y += 18;
    tocIndex++;

    if (upsellData) {
      setF(C.cardBg); doc.roundedRect(M, y - 4, CW, 14, 2, 2, "F");
      setF(C.primary); doc.rect(M, y - 4, 3, 14, "F");
      doc.setFontSize(11); setC(C.black);
      doc.text(`${tocIndex}. ${SECTION_TITLES.noteFromAgency(orgName)}`, M + 8, y + 2);
      doc.setFontSize(7.5); setC(C.grey);
      doc.text("A service recommendation based on your results", M + 8, y + 7);
      y += 18;
    }

    // ═══════════════════════════════════════
    // PLATFORM PAGES
    // ═══════════════════════════════════════
    for (const section of platformSections) {
      const isOnePage = ONE_PAGE_PLATFORMS.has(section.platform);
      let platformPageCount = 0;
      const maxPlatformPages = isOnePage ? 1 : 2;

      y = startNewPage();
      platformPageCount++;
      pageToc.push({ title: section.label, page: pageCount });

      // ── PLATFORM HEADER ──
      doc.setFontSize(20); setC(C.primary);
      doc.text(section.label, M, y);
      // Status badge
      const platStatus = getPlatformStatus(section.platform, section.metrics, section.hasPrevSnapshot ? section.prevMetrics : null);
      const platStatusColor = platStatus === "Strong" ? C.green : platStatus === "Needs Attention" ? C.red : C.amber;
      const badgeX = M + doc.getTextWidth(section.label) + 6;
      setF(lighten(platStatusColor, 0.85)); doc.roundedRect(badgeX, y - 5, 28, 8, 2, 2, "F");
      setF(platStatusColor); doc.circle(badgeX + 5, y - 1, 2, "F");
      doc.setFontSize(6.5); setC(platStatusColor);
      doc.text(platStatus, badgeX + 9, y);
      y += 5;

      doc.setFontSize(8); setC(C.grey);
      const descLines = doc.splitTextToSize(`${section.label} tracks ${section.description}`, CW);
      doc.text(descLines, M, y);
      y += descLines.length * 3.5 + 3;
      setF(C.primary); doc.rect(M, y, 40, 1, "F"); y += 7;

      const hasPrev = section.hasPrevSnapshot;

      if (!hasPrev) {
        setF(C.amberLight); doc.roundedRect(M, y - 3, CW, 10, 2, 2, "F");
        doc.setFontSize(8); setC(C.amber);
        doc.text("This is your first month tracked for this platform — no comparison data available yet.", M + 4, y + 3);
        y += 12;
      }

      // ── METRICS GRID (3 columns) ──
      const gridMetrics = section.enabledMetrics.filter(k => typeof section.metrics[k] === "number" && METRIC_LABELS[k]);
      const colCount = 3;
      const cardW = (CW - (colCount - 1) * 4) / colCount;
      const cardH = hasPrev ? 28 : 22;
      let cardX = M;
      let cardsInRow = 0;

      for (const key of gridMetrics) {
        if (y + cardH > H - 16) {
          if (platformPageCount >= maxPlatformPages) break;
          y = startNewPage();
          platformPageCount++;
          cardX = M; cardsInRow = 0;
        }

        const val = section.metrics[key];
        const prevVal = section.prevMetrics[key];

        // Card with left border accent
        setF(C.cardBg); doc.roundedRect(cardX, y, cardW, cardH, 2, 2, "F");
        // Left accent border — color based on change
        let accentColor = C.primary;
        if (hasPrev && prevVal !== undefined && key in section.prevMetrics && prevVal !== 0) {
          const change = calcChange(val, prevVal);
          accentColor = getChangeColor(key, change.dir);
        }
        setF(accentColor); doc.rect(cardX, y + 1, 2.5, cardH - 2, "F");

        // Label
        doc.setFontSize(6.5); setC(C.grey);
        doc.text(METRIC_LABELS[key]!.toUpperCase(), cardX + 6, y + 7);

        // Value
        doc.setFontSize(17); setC(C.black);
        doc.text(formatVal(key, val), cardX + 6, y + 17);

        // Change indicator
        if (hasPrev) {
          if (prevVal !== undefined && key in section.prevMetrics) {
            if (prevVal === 0) {
              doc.setFontSize(6.5); setC(C.grey);
              doc.text("— 0.0%", cardX + 6, y + 24);
            } else {
              const change = calcChange(val, prevVal);
              const color = getChangeColor(key, change.dir);
              doc.setFontSize(6.5); setC(color);
              const arrow = change.dir === "up" ? "▲" : change.dir === "down" ? "▼" : "—";
              doc.text(`${arrow} ${Math.abs(change.pct).toFixed(1)}% vs last month`, cardX + 6, y + 24);
            }
          } else {
            doc.setFontSize(6.5); setC(C.grey);
            doc.text("New this month", cardX + 6, y + 24);
          }
        }

        cardX += cardW + 4;
        cardsInRow++;
        if (cardsInRow >= colCount) {
          cardX = M; y += cardH + 4; cardsInRow = 0;
        }
      }
      if (cardsInRow > 0) y += cardH + 4;

      // ── SUMMARY BOX (template-based) ──
      const summaryText = platformSummaries[section.platform];
      if (summaryText && y + 25 <= H - 16 && platformPageCount <= maxPlatformPages) {
        y += 2;
        const boxTop = y;
        doc.setFontSize(8.5);
        const summaryLines = doc.splitTextToSize(summaryText, CW - 16);
        const maxLines = (y + summaryLines.length * 4 + 14 > H - 16) ? 4 : summaryLines.length;
        const finalLines = summaryLines.slice(0, maxLines);

        const boxH = finalLines.length * 4 + 14;
        // Blue-tinted background
        setF(C.secondaryLight); doc.roundedRect(M, boxTop, CW, boxH, 3, 3, "F");
        // Left accent
        setF(C.secondary); doc.rect(M, boxTop, 3, boxH, "F");

        doc.setFontSize(8); setC(C.secondary);
        doc.text(SECTION_TITLES.whatThisMeans.toUpperCase(), M + 8, boxTop + 7);
        doc.setFontSize(8.5); setC(C.black);
        let sY = boxTop + 13;
        for (const line of finalLines) {
          doc.text(line, M + 8, sY);
          sY += 4;
        }
        y = boxTop + boxH + 4;
      }

      // ── COMPARISON TABLE ──
      if (hasPrev && gridMetrics.length > 0 && platformPageCount <= maxPlatformPages) {
        if (y + 20 > H - 16) {
          if (platformPageCount < maxPlatformPages) {
            y = startNewPage();
            platformPageCount++;
          }
        }
        if (platformPageCount <= maxPlatformPages) {
          doc.setFontSize(10); setC(C.black);
          doc.text(SECTION_TITLES.comparison, M, y); y += 6;

          const colWidths = [CW * 0.30, CW * 0.22, CW * 0.22, CW * 0.26];
          const tableHeaders = ["Metric", SECTION_TITLES.thisMonth, SECTION_TITLES.lastMonth, SECTION_TITLES.change];

          // Table header row
          setF(C.primary); doc.roundedRect(M, y - 3.5, CW, 8, 1, 1, "F");
          doc.setFontSize(7); setC(C.white);
          let hx = M;
          for (let i = 0; i < tableHeaders.length; i++) {
            doc.text(tableHeaders[i].toUpperCase(), hx + 4, y + 1.5);
            hx += colWidths[i];
          }
          y += 8;

          const maxRows = isOnePage ? 8 : 15;
          let rowIdx = 0;
          for (const key of gridMetrics) {
            if (rowIdx >= maxRows) break;
            if (y + 7 > H - 16) {
              if (platformPageCount >= maxPlatformPages) break;
              y = startNewPage();
              platformPageCount++;
              // Re-render header
              setF(C.primary); doc.roundedRect(M, y - 3.5, CW, 8, 1, 1, "F");
              doc.setFontSize(7); setC(C.white);
              hx = M;
              for (let i = 0; i < tableHeaders.length; i++) {
                doc.text(tableHeaders[i].toUpperCase(), hx + 4, y + 1.5);
                hx += colWidths[i];
              }
              y += 8;
            }

            const val = section.metrics[key];
            const prevVal = section.prevMetrics[key];

            // Alternating row bg
            if (rowIdx % 2 === 0) {
              setF(C.tableAltRow); doc.rect(M, y - 3, CW, 7, "F");
            }

            doc.setFontSize(7.5);
            let rx = M;
            setC(C.black); doc.text(METRIC_LABELS[key]!, rx + 4, y + 1);
            rx += colWidths[0];
            doc.text(formatVal(key, val), rx + 4, y + 1);
            rx += colWidths[1];
            if (prevVal !== undefined && key in section.prevMetrics) {
              doc.text(formatVal(key, prevVal), rx + 4, y + 1);
            } else {
              setC(C.grey); doc.text("—", rx + 4, y + 1);
            }
            rx += colWidths[2];

            if (prevVal !== undefined && key in section.prevMetrics && prevVal !== 0) {
              const change = calcChange(val, prevVal);
              const color = getChangeColor(key, change.dir);
              setC(color);
              const arrow = change.dir === "up" ? "▲" : change.dir === "down" ? "▼" : "—";
              doc.text(`${arrow} ${Math.abs(change.pct).toFixed(1)}%`, rx + 4, y + 1);
            } else if (prevVal !== undefined && key in section.prevMetrics) {
              setC(C.grey); doc.text("— 0.0%", rx + 4, y + 1);
            } else {
              setC(C.grey); doc.text("New", rx + 4, y + 1);
            }

            y += 7; rowIdx++;
          }
          y += 4;
        }
      } else if (!hasPrev) {
        if (y + 10 <= H - 16) {
          doc.setFontSize(8); setC(C.grey);
          doc.text("No previous month data available for comparison.", M, y);
          y += 8;
        }
      }

      // ── TOP CONTENT ──
      if (section.topContent.length > 0 && platformPageCount <= maxPlatformPages) {
        const maxPosts = (y + 40 > H - 16 && platformPageCount >= maxPlatformPages) ? 3 : 5;
        if (y + 20 > H - 16) {
          if (platformPageCount < maxPlatformPages) {
            y = startNewPage();
            platformPageCount++;
          }
        }

        if (platformPageCount <= maxPlatformPages) {
          doc.setFontSize(10); setC(C.black);
          doc.text(SECTION_TITLES.topContent, M, y); y += 7;

          const topItems = section.topContent.slice(0, maxPosts) as Record<string, unknown>[];
          for (let idx = 0; idx < topItems.length; idx++) {
            const item = topItems[idx];
            if (y + 12 > H - 16) {
              if (platformPageCount >= maxPlatformPages) break;
            }

            // Post card row
            setF(idx % 2 === 0 ? C.cardBg : C.white);
            doc.roundedRect(M, y - 3, CW, 12, 1.5, 1.5, "F");

            doc.setFontSize(8); setC(C.black);
            const postTitle = getPostCaption(item);
            doc.text(`${idx + 1}.  ${postTitle}`, M + 4, y + 2);

            // Metrics inline
            const details: string[] = [];
            if (item.spend !== undefined) details.push(`Spend: ${currSymbol}${Number(item.spend).toFixed(2)}`);
            if (item.impressions !== undefined) details.push(`Imp: ${Number(item.impressions).toLocaleString()}`);
            if (item.clicks !== undefined) details.push(`Clicks: ${Number(item.clicks).toLocaleString()}`);
            if (item.engagement !== undefined) details.push(`Eng: ${Number(item.engagement).toLocaleString()}`);
            if (item.views !== undefined) details.push(`Views: ${Number(item.views).toLocaleString()}`);
            if (item.likes !== undefined) details.push(`Likes: ${Number(item.likes).toLocaleString()}`);
            if (details.length > 0) {
              doc.setFontSize(6.5); setC(C.grey);
              doc.text(details.join("  |  "), M + 10, y + 7);
            }
            y += 14;
          }
          y += 2;
        }
      }
    }

    // ═══════════════════════════════════════
    // MONTHLY SUMMARY PAGE
    // ═══════════════════════════════════════
    y = startNewPage();
    pageToc.push({ title: SECTION_TITLES.monthlySummary, page: pageCount });

    doc.setFontSize(20); setC(C.black);
    doc.text(SECTION_TITLES.monthlySummary, M, y); y += 5;
    setF(C.primary); doc.rect(M, y, 40, 1.5, "F"); y += 10;

    // Executive summary in a styled box
    setF(C.primaryLight); doc.roundedRect(M, y - 3, CW, 30, 3, 3, "F");
    setF(C.primary); doc.rect(M, y - 3, 3, 30, "F");
    doc.setFontSize(9); setC(C.black);
    const summaryLines = doc.splitTextToSize(executiveSummary, CW - 16);
    let sumY = y + 3;
    for (const line of summaryLines.slice(0, 6)) {
      doc.text(line, M + 8, sumY);
      sumY += 4.5;
    }
    y += 34;

    // Traffic light overview
    doc.setFontSize(11); setC(C.black);
    doc.text(SECTION_TITLES.platformStatusOverview, M, y); y += 7;

    const summaryColWidths = [CW * 0.28, CW * 0.15, CW * 0.57];
    // Header row
    setF(C.primary); doc.roundedRect(M, y - 3.5, CW, 8, 1, 1, "F");
    doc.setFontSize(7); setC(C.white);
    doc.text("PLATFORM", M + 4, y + 1.5);
    doc.text("STATUS", M + summaryColWidths[0] + 4, y + 1.5);
    doc.text("VERDICT", M + summaryColWidths[0] + summaryColWidths[1] + 4, y + 1.5);
    y += 8;

    for (let i = 0; i < platformSections.length; i++) {
      if (y + 9 > H - 16) y = startNewPage();
      const section = platformSections[i];
      const status = getPlatformStatus(section.platform, section.metrics, section.hasPrevSnapshot ? section.prevMetrics : null);
      const statusColor = status === "Strong" ? C.green : status === "Needs Attention" ? C.red : C.amber;
      const statusBgColor = status === "Strong" ? C.greenLight : status === "Needs Attention" ? C.redLight : C.amberLight;

      if (i % 2 === 0) {
        setF(C.tableAltRow); doc.rect(M, y - 3, CW, 9, "F");
      }

      doc.setFontSize(8); setC(C.black);
      doc.text(section.label, M + 4, y + 2);

      // Status badge
      const badgeW = 22;
      const bx = M + summaryColWidths[0] + 4;
      setF(statusBgColor); doc.roundedRect(bx, y - 1.5, badgeW, 7, 2, 2, "F");
      setF(statusColor); doc.circle(bx + 4, y + 2, 1.8, "F");
      doc.setFontSize(6.5); setC(statusColor);
      doc.text(status, bx + 8, y + 3);

      // Short verdict from template summary (first sentence, max 15 words)
      const summaryText = platformSummaries[section.platform] ?? "";
      const firstSentence = summaryText.split(/[.!?]/)[0] + ".";
      const verdictWords = firstSentence.split(/\s+/).slice(0, 15).join(" ");
      const verdict = verdictWords.endsWith(".") ? verdictWords : verdictWords + "...";
      doc.setFontSize(6.5); setC(C.grey);
      const vLines = doc.splitTextToSize(verdict, summaryColWidths[2] - 8);
      doc.text(vLines[0], M + summaryColWidths[0] + summaryColWidths[1] + 4, y + 2);

      y += 9;
    }
    y += 8;

    // Key Wins
    if (keyWins.length > 0) {
      doc.setFontSize(11); setC(C.green);
      doc.text(SECTION_TITLES.keyWins, M, y); y += 7;

      for (const win of keyWins) {
        setF(C.greenLight); doc.roundedRect(M, y - 3, CW, 9, 2, 2, "F");
        setF(C.green); doc.rect(M, y - 3, 2.5, 9, "F");
        doc.setFontSize(8); setC(C.black);
        const winLines = doc.splitTextToSize(win, CW - 12);
        doc.text(winLines[0], M + 6, y + 2);
        y += 12;
      }
    } else {
      doc.setFontSize(11); setC(C.green);
      doc.text(SECTION_TITLES.keyWins, M, y); y += 7;
      doc.setFontSize(8); setC(C.grey);
      doc.text("This is your first reporting month — we'll track improvements from here.", M + 6, y);
      y += 10;
    }
    y += 4;

    // Worth Watching
    if (worthWatching.length > 0) {
      if (y + 20 > H - 16) y = startNewPage();
      doc.setFontSize(11); setC(C.amber);
      doc.text(SECTION_TITLES.worthWatching, M, y); y += 7;

      for (const item of worthWatching) {
        setF(C.amberLight); doc.roundedRect(M, y - 3, CW, 9, 2, 2, "F");
        setF(C.amber); doc.rect(M, y - 3, 2.5, 9, "F");
        doc.setFontSize(8); setC(C.black);
        const watchLines = doc.splitTextToSize(item, CW - 12);
        doc.text(watchLines[0], M + 6, y + 2);
        y += 12;
      }
    }

    // ═══════════════════════════════════════
    // UPSELL PAGE
    // ═══════════════════════════════════════
    if (upsellData) {
      y = startNewPage();
      pageToc.push({ title: SECTION_TITLES.noteFromAgency(orgName), page: pageCount });

      doc.setFontSize(20); setC(C.primary);
      doc.text(SECTION_TITLES.noteFromAgency(orgName), M, y); y += 5;
      setF(C.primary); doc.rect(M, y, 40, 1.5, "F"); y += 12;

      doc.setFontSize(14); setC(C.black);
      const headlineLines = doc.splitTextToSize(upsellData.headline, CW);
      for (const line of headlineLines) {
        doc.text(line, M, y); y += 7;
      }
      y += 6;

      doc.setFontSize(9); setC(C.black);
      y = wrapText(upsellData.body_content, M, y, CW, 4.5);
      y += 8;

      if (upsellData.comparison_data && Array.isArray(upsellData.comparison_data)) {
        const compData = upsellData.comparison_data as { label: string; option_a: string; option_b: string }[];
        if (compData.length > 0) {
          const compColW = [CW * 0.34, CW * 0.33, CW * 0.33];
          setF(C.primary); doc.roundedRect(M, y - 3.5, CW, 8, 1, 1, "F");
          doc.setFontSize(7.5); setC(C.white);
          doc.text("FEATURE", M + 4, y + 1.5);
          doc.text(compData[0]?.option_a ? "OPTION A" : "", M + compColW[0] + 4, y + 1.5);
          doc.text(compData[0]?.option_b ? "OPTION B" : "", M + compColW[0] + compColW[1] + 4, y + 1.5);
          y += 8;

          for (let i = 0; i < compData.length; i++) {
            if (y + 7 > H - 16) y = startNewPage();
            if (i % 2 === 0) { setF(C.tableAltRow); doc.rect(M, y - 3, CW, 7, "F"); }
            doc.setFontSize(7.5); setC(C.black);
            doc.text(compData[i].label, M + 4, y + 1);
            doc.text(compData[i].option_a ?? "", M + compColW[0] + 4, y + 1);
            doc.text(compData[i].option_b ?? "", M + compColW[0] + compColW[1] + 4, y + 1);
            y += 7;
          }
          y += 6;
        }
      }

      doc.setFontSize(10); setC(C.primary);
      doc.text(SECTION_TITLES.interestedCTA, M, y);
    }

    // ═══════════════════════════════════════
    // END PAGE — dark themed
    // ═══════════════════════════════════════
    y = startNewPage();
    // Override: full dark bg
    setF(C.primary); doc.rect(0, 0, W, H, "F");

    if (showLogo && org?.logo_url) {
      try {
        const logoRes = await fetch(org.logo_url);
        if (logoRes.ok) {
          const logoBlob = await logoRes.arrayBuffer();
          const logoBase64 = btoa(String.fromCharCode(...new Uint8Array(logoBlob)));
          const ext = org.logo_url.toLowerCase().includes(".png") ? "PNG" : "JPEG";
          doc.addImage(`data:image/${ext.toLowerCase()};base64,${logoBase64}`, ext, W / 2 - 20, 30, 40, 40);
        }
      } catch { /* skip */ }
    }

    const firstName = client.full_name.split(" ")[0];
    doc.setFontSize(28); setC(C.white);
    doc.text(SECTION_TITLES.thankYou(firstName), W / 2, 95, { align: "center" });

    doc.setFontSize(10); setC(C.white);
    const closingText = `This report gives you a clear picture of where things stand. Every number here represents real people discovering your business. We look forward to building on this next month.`;
    const closingLines = doc.splitTextToSize(closingText, CW * 0.65);
    let closingY = 115;
    for (const line of closingLines) {
      doc.text(line, W / 2, closingY, { align: "center" });
      closingY += 5.5;
    }

    closingY += 12;
    doc.setFontSize(9); setC(C.white);
    doc.text(SECTION_TITLES.preparedBy(orgName, `${MONTH_NAMES[report_month]} ${report_year}`), W / 2, closingY, { align: "center" });

    doc.setFontSize(6.5); setC(C.white);
    doc.text(`${orgName}  |  Confidential`, W / 2, H - 8, { align: "center" });

    // ═══════════════════════════════════════
    // UPLOAD & SAVE
    // ═══════════════════════════════════════
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
      ai_executive_summary: executiveSummary,
      ai_insights: JSON.stringify(platformSummaries),
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
