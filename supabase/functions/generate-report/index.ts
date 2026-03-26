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
  google_business_profile: "Google Business Profile", youtube: "YouTube",
};

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
  audience_growth_rate: "Audience Growth",
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
  // Try HSL format "H S% L%"
  try { return hexToRgb(hslToHex(color)); } catch { return fallback; }
};

// Default fallback colors
const DEFAULTS = {
  offWhite: [244, 237, 227] as [number, number, number],
  black: [36, 31, 33] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  grey: [120, 120, 120] as [number, number, number],
  lightGrey: [200, 200, 200] as [number, number, number],
  green: [78, 214, 142] as [number, number, number],
  orange: [238, 135, 51] as [number, number, number],
  blue: [83, 155, 219] as [number, number, number],
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

    // Fetch all required data including organisation
    const [clientRes, snapshotsRes, configRes, prevSnapshotsRes, yoySnapshotsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", client_id).single(),
      supabase.from("monthly_snapshots").select("*").eq("client_id", client_id).eq("report_month", report_month).eq("report_year", report_year),
      supabase.from("client_platform_config").select("*").eq("client_id", client_id).eq("is_enabled", true),
      supabase.from("monthly_snapshots").select("*").eq("client_id", client_id)
        .eq("report_month", report_month === 1 ? 12 : report_month - 1)
        .eq("report_year", report_month === 1 ? report_year - 1 : report_year),
      supabase.from("monthly_snapshots").select("*").eq("client_id", client_id)
        .eq("report_month", report_month).eq("report_year", report_year - 1),
    ]);

    const client = clientRes.data;
    if (!client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch organisation branding
    const { data: org } = await supabase.from("organisations").select("*").eq("id", client.org_id).single();
    const orgName = org?.name ?? "Your Agency";
    const reportSettings = (org?.report_settings ?? {}) as Record<string, unknown>;
    const showLogo = reportSettings.show_logo !== false;
    const showAiInsights = reportSettings.show_ai_insights !== false;
    const reportAccentColor = (reportSettings.report_accent_color as string) || null;

    // Resolve brand colors from org settings
    const primaryColor = parseColorToRgb(reportAccentColor || org?.primary_color, [179, 47, 191]);
    const secondaryColor = parseColorToRgb(org?.secondary_color, DEFAULTS.blue);
    const accentColor = parseColorToRgb(org?.accent_color, DEFAULTS.green);

    // Build color palette using org branding
    const C = {
      offWhite: DEFAULTS.offWhite,
      black: DEFAULTS.black,
      primary: primaryColor,
      secondary: secondaryColor,
      accent: accentColor,
      green: DEFAULTS.green,
      orange: DEFAULTS.orange,
      white: DEFAULTS.white,
      grey: DEFAULTS.grey,
      lightGrey: DEFAULTS.lightGrey,
    };

    const snapshots = snapshotsRes.data ?? [];
    const prevSnapshots = prevSnapshotsRes.data ?? [];
    const yoySnapshots = yoySnapshotsRes.data ?? [];
    const configs = configRes.data ?? [];

    const CURRENCY_SYMBOLS: Record<string, string> = {
      GBP: "£", EUR: "€", USD: "$", PLN: "zł", CAD: "C$", AUD: "A$", NZD: "NZ$",
    };
    const currSymbol = CURRENCY_SYMBOLS[client.preferred_currency ?? "GBP"] ?? "£";

    if (snapshots.length === 0) {
      return new Response(JSON.stringify({ 
        error: "No data snapshots found for this period. Please sync platform data before generating a report." 
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate AI insights
    let aiSummary = "";
    let aiInsights = "";
    let aiUpsell = "";

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableApiKey && snapshots.length > 0) {
      try {
        const dataContext = JSON.stringify({
          client_name: client.company_name,
          month: MONTH_NAMES[report_month],
          year: report_year,
          current: snapshots.map((s: any) => ({ platform: s.platform, metrics: s.metrics_data })),
          previous: prevSnapshots.map((s: any) => ({ platform: s.platform, metrics: s.metrics_data })),
          yoy: yoySnapshots.map((s: any) => ({ platform: s.platform, metrics: s.metrics_data })),
        });

        const aiCall = async (prompt: string, maxTokens: number) => {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableApiKey}` },
            body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }], max_tokens: maxTokens }),
          });
          if (!res.ok) { console.error("AI call failed:", res.status, await res.text()); return ""; }
          const json = await res.json();
          return json.choices?.[0]?.message?.content ?? "";
        };

        aiSummary = await aiCall(
          `Write a monthly marketing performance executive summary for ${client.company_name} for ${MONTH_NAMES[report_month]} ${report_year}. 3-4 sentences, plain English, non-technical. Highlight best results, biggest changes, areas needing attention. Professional and clear. Data: ${dataContext}. If data is empty, note that data collection is in progress.`,
          500
        );

        if (showAiInsights) {
          aiInsights = await aiCall(
            `Write platform-by-platform insights for ${client.company_name}'s marketing report for ${MONTH_NAMES[report_month]} ${report_year}. For each platform, 2-3 sentences explaining what happened. Simple language. Data: ${dataContext}. If no data, note it will be included once platforms are active.`,
            800
          );
        }

        if (client.enable_upsell) {
          aiUpsell = await aiCall(
            `Based on marketing data for ${client.company_name}, suggest 2-3 ${orgName} services that could help. ${orgName} offers: SEO, content production, web dev, CRM/automations, social media management, paid campaigns, email marketing, branding. Currently subscribed: ${(client.services_subscribed ?? []).join(", ") || "unknown"}. Helpful, not pushy. 1-2 sentences each. Data: ${dataContext}`,
            400
          );
        }
      } catch (aiError) {
        console.error("AI generation error:", aiError);
        aiSummary = `This report covers ${client.company_name}'s marketing performance for ${MONTH_NAMES[report_month]} ${report_year}.`;
      }
    } else {
      aiSummary = `This report covers ${client.company_name}'s marketing performance for ${MONTH_NAMES[report_month]} ${report_year}. Connect platforms and sync data to enable AI insights.`;
    }

    // ───────── GENERATE PDF ─────────
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, H = 297, M = 18;
    const CW = W - M * 2;

    const setC = (c: number[]) => doc.setTextColor(c[0], c[1], c[2]);
    const setF = (c: number[]) => doc.setFillColor(c[0], c[1], c[2]);

    const stripMarkdown = (text: string): string =>
      text
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/^[-*]\s+/gm, '• ');

    const wrapText = (text: string, x: number, y: number, maxW: number, lh: number): number => {
      const clean = stripMarkdown(text);
      const lines = doc.splitTextToSize(clean, maxW);
      for (const line of lines) {
        if (y > H - 30) { doc.addPage(); y = newPageHeader(); }
        doc.text(line, x, y);
        y += lh;
      }
      return y;
    };

    const newPageHeader = (): number => {
      setF(C.offWhite); doc.rect(0, 0, W, H, "F");
      setF(C.primary); doc.rect(0, 0, W, 8, "F");
      // Footer
      doc.setFontSize(7); setC(C.grey);
      doc.text(`${orgName} | Confidential`, W / 2, H - 8, { align: "center" });
      doc.text(`${client.company_name} — ${MONTH_NAMES[report_month]} ${report_year}`, W / 2, H - 4, { align: "center" });
      return M + 8;
    };

    const sectionTitle = (title: string, y: number): number => {
      if (y > H - 60) { doc.addPage(); y = newPageHeader(); }
      doc.setFontSize(20); setC(C.black); doc.text(title, M, y);
      setF(C.primary); doc.rect(M, y + 4, 50, 2, "F");
      return y + 16;
    };

    const formatMetricValue = (key: string, val: number): string => {
      if (key === "spend" || key === "cpc" || key === "cost_per_conversion") return `${currSymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (key === "ctr" || key === "engagement_rate" || key === "conversion_rate" || key === "audience_growth_rate") return `${val.toFixed(2)}%`;
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
      return val % 1 !== 0 ? val.toFixed(2) : val.toLocaleString();
    };

    // ═══════ PAGE 1: COVER ═══════
    setF(C.black); doc.rect(0, 0, W, H, "F");

    // Decorative elements
    setF(C.primary); doc.rect(0, 0, 6, H, "F");

    // Org logo or name
    if (showLogo && org?.logo_url) {
      try {
        const logoRes = await fetch(org.logo_url);
        if (logoRes.ok) {
          const logoBlob = await logoRes.arrayBuffer();
          const logoBase64 = btoa(String.fromCharCode(...new Uint8Array(logoBlob)));
          const ext = org.logo_url.toLowerCase().includes(".png") ? "PNG" : "JPEG";
          doc.addImage(`data:image/${ext.toLowerCase()};base64,${logoBase64}`, ext, W / 2 - 25, 55, 50, 50);
        } else {
          doc.setFontSize(72); setC(C.primary); doc.text(orgName, W / 2, 80, { align: "center" });
        }
      } catch {
        doc.setFontSize(72); setC(C.primary); doc.text(orgName, W / 2, 80, { align: "center" });
      }
    } else {
      doc.setFontSize(72); setC(C.primary); doc.text(orgName, W / 2, 80, { align: "center" });
    }

    setF(C.primary); doc.rect(W / 2 - 30, 115, 60, 1.5, "F");

    doc.setFontSize(28); setC(C.white); doc.text("Monthly Marketing", W / 2, 145, { align: "center" });
    doc.text("Performance Report", W / 2, 158, { align: "center" });

    doc.setFontSize(20); setC(C.primary); doc.text(client.company_name, W / 2, 188, { align: "center" });
    doc.setFontSize(14); setC(C.grey); doc.text(`${MONTH_NAMES[report_month]} ${report_year}`, W / 2, 203, { align: "center" });

    // Client logo if available
    if (client.logo_url) {
      try {
        const clientLogoRes = await fetch(client.logo_url);
        if (clientLogoRes.ok) {
          const clientLogoBlob = await clientLogoRes.arrayBuffer();
          const clientLogoBase64 = btoa(String.fromCharCode(...new Uint8Array(clientLogoBlob)));
          const cExt = client.logo_url.toLowerCase().includes(".png") ? "PNG" : "JPEG";
          doc.addImage(`data:image/${cExt.toLowerCase()};base64,${clientLogoBase64}`, cExt, W / 2 - 15, 215, 30, 30);
        }
      } catch { /* skip client logo on error */ }
    }

    // Decorative bottom bar
    setF(C.primary); doc.rect(M, H - 40, CW, 0.5, "F");
    doc.setFontSize(9); setC(C.grey);
    doc.text(`Prepared by ${orgName}`, W / 2, H - 28, { align: "center" });
    doc.text("Confidential", W / 2, H - 22, { align: "center" });

    // ═══════ PAGE 2: EXECUTIVE SUMMARY ═══════
    doc.addPage();
    let y = newPageHeader();
    y = sectionTitle("Executive Summary", y);

    doc.setFontSize(11); setC(C.black);
    y = wrapText(aiSummary || "Report data will be available once platform connections are active.", M, y, CW, 6);

    // ═══════ KPI HERO CARDS ═══════
    y += 8;
    y = sectionTitle("Key Performance Indicators", y);

    const totalSpend = snapshots.reduce((s: number, sn: any) => s + (sn.metrics_data?.spend || 0), 0);
    const totalImpressions = snapshots.reduce((s: number, sn: any) => s + (sn.metrics_data?.impressions || 0), 0);
    const totalClicks = snapshots.reduce((s: number, sn: any) => s + (sn.metrics_data?.clicks || 0), 0);
    const totalEngagement = snapshots.reduce((s: number, sn: any) => s + (sn.metrics_data?.engagement || 0) + (sn.metrics_data?.likes || 0) + (sn.metrics_data?.comments || 0) + (sn.metrics_data?.shares || 0), 0);

    const prevTotalSpend = prevSnapshots.reduce((s: number, sn: any) => s + (sn.metrics_data?.spend || 0), 0);
    const prevTotalImpressions = prevSnapshots.reduce((s: number, sn: any) => s + (sn.metrics_data?.impressions || 0), 0);
    const prevTotalClicks = prevSnapshots.reduce((s: number, sn: any) => s + (sn.metrics_data?.clicks || 0), 0);
    const prevTotalEngagement = prevSnapshots.reduce((s: number, sn: any) => s + (sn.metrics_data?.engagement || 0) + (sn.metrics_data?.likes || 0) + (sn.metrics_data?.comments || 0) + (sn.metrics_data?.shares || 0), 0);

    const kpiCards = [
      { label: "TOTAL SPEND", value: `${currSymbol}${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, prev: prevTotalSpend, curr: totalSpend, isCost: true },
      { label: "IMPRESSIONS", value: totalImpressions >= 1000 ? `${(totalImpressions / 1000).toFixed(1)}K` : String(totalImpressions), prev: prevTotalImpressions, curr: totalImpressions },
      { label: "CLICKS", value: totalClicks >= 1000 ? `${(totalClicks / 1000).toFixed(1)}K` : String(totalClicks), prev: prevTotalClicks, curr: totalClicks },
      { label: "ENGAGEMENT", value: totalEngagement >= 1000 ? `${(totalEngagement / 1000).toFixed(1)}K` : String(totalEngagement), prev: prevTotalEngagement, curr: totalEngagement },
    ];

    const kpiW = (CW - 15) / 4;
    const kpiH = 32;
    let kpiX = M;

    if (y + kpiH > H - 30) { doc.addPage(); y = newPageHeader(); }

    for (const kpi of kpiCards) {
      setF(C.white); doc.roundedRect(kpiX, y, kpiW, kpiH, 3, 3, "F");
      setF(C.primary); doc.rect(kpiX, y, kpiW, 2, "F");

      doc.setFontSize(6.5); setC(C.grey);
      doc.text(kpi.label, kpiX + 5, y + 9);

      doc.setFontSize(16); setC(C.black);
      doc.text(kpi.value, kpiX + 5, y + 20);

      if (kpi.prev > 0) {
        const change = ((kpi.curr - kpi.prev) / kpi.prev) * 100;
        const isGood = kpi.isCost ? change < 0 : change > 0;
        doc.setFontSize(7); setC(isGood ? C.green : C.orange);
        const arrow = change >= 0 ? "▲" : "▼";
        doc.text(`${arrow} ${Math.abs(change).toFixed(1)}% MoM`, kpiX + 5, y + 27);
      }

      kpiX += kpiW + 5;
    }
    y += kpiH + 12;

    // ═══════ PLATFORM SECTIONS ═══════
    for (const snapshot of snapshots) {
      doc.addPage();
      y = newPageHeader();

      const platformName = PLATFORM_LABELS[snapshot.platform] ?? snapshot.platform;
      const config = configs.find((c: any) => c.platform === snapshot.platform);
      const enabledMetrics: string[] = config?.enabled_metrics?.length > 0 ? config.enabled_metrics : Object.keys(snapshot.metrics_data as Record<string, unknown>);
      const prevSnapshot = prevSnapshots.find((s: any) => s.platform === snapshot.platform);
      const yoySnapshot = yoySnapshots.find((s: any) => s.platform === snapshot.platform);

      doc.setFontSize(22); setC(C.primary); doc.text(platformName, M, y);
      setF(C.primary); doc.rect(M, y + 5, 40, 1.5, "F");
      y += 18;

      const metrics = snapshot.metrics_data as Record<string, number>;
      const prevMetrics = (prevSnapshot?.metrics_data ?? {}) as Record<string, number>;
      const yoyMetrics = (yoySnapshot?.metrics_data ?? {}) as Record<string, number>;

      const cardW = (CW - 16) / 3;
      const cardH = 30;
      let cardX = M;
      let cardsInRow = 0;

      for (const metricKey of enabledMetrics) {
        if (!(metricKey in metrics)) continue;

        if (y + cardH > H - 30) {
          doc.addPage(); y = newPageHeader();
          cardX = M; cardsInRow = 0;
        }

        setF(C.white); doc.roundedRect(cardX, y, cardW, cardH, 2, 2, "F");
        setF(C.primary); doc.rect(cardX, y + 3, 1.5, cardH - 6, "F");

        doc.setFontSize(7); setC(C.grey);
        const label = METRIC_LABELS[metricKey] ?? metricKey;
        doc.text(label.toUpperCase(), cardX + 6, y + 8);

        doc.setFontSize(15); setC(C.black);
        const fmtVal = formatMetricValue(metricKey, metrics[metricKey]);
        doc.text(fmtVal, cardX + 6, y + 18);

        if (client.enable_mom_comparison && prevMetrics[metricKey] !== undefined && prevMetrics[metricKey] !== 0) {
          const change = ((metrics[metricKey] - prevMetrics[metricKey]) / prevMetrics[metricKey]) * 100;
          const isCost = metricKey === "spend" || metricKey === "cpc" || metricKey === "cost_per_conversion";
          const isGood = isCost ? change < 0 : change > 0;
          doc.setFontSize(6.5); setC(isGood ? C.green : C.orange);
          const arrow = change >= 0 ? "▲" : "▼";
          doc.text(`${arrow} ${Math.abs(change).toFixed(1)}% MoM`, cardX + 6, y + 24);
        }

        if (client.enable_yoy_comparison && yoyMetrics[metricKey] !== undefined && yoyMetrics[metricKey] !== 0) {
          const yoyChange = ((metrics[metricKey] - yoyMetrics[metricKey]) / yoyMetrics[metricKey]) * 100;
          doc.setFontSize(5.5); setC(C.secondary);
          doc.text(`YoY: ${yoyChange >= 0 ? "+" : ""}${yoyChange.toFixed(1)}%`, cardX + 6, y + 28);
        }

        cardX += cardW + 8;
        cardsInRow++;
        if (cardsInRow >= 3) {
          cardX = M; y += cardH + 6; cardsInRow = 0;
        }
      }
      if (cardsInRow > 0) y += cardH + 6;

      // ── SIMULATED BAR CHART ──
      y += 6;
      if (y + 50 < H - 30) {
        doc.setFontSize(10); setC(C.black); doc.text("Performance Breakdown", M, y);
        y += 8;

        const chartMetrics = ["impressions", "clicks", "engagement", "reach"].filter(k => metrics[k] > 0);
        if (chartMetrics.length > 0) {
          const maxVal = Math.max(...chartMetrics.map(k => metrics[k]));
          const barMaxW = CW - 40;

          for (const key of chartMetrics) {
            if (y + 10 > H - 30) { doc.addPage(); y = newPageHeader(); }
            const val = metrics[key];
            const barW = (val / maxVal) * barMaxW;

            doc.setFontSize(7); setC(C.grey);
            doc.text((METRIC_LABELS[key] || key).toUpperCase(), M, y);

            setF(C.lightGrey); doc.roundedRect(M, y + 2, barMaxW, 5, 2, 2, "F");
            setF(C.primary); doc.roundedRect(M, y + 2, Math.max(barW, 4), 5, 2, 2, "F");

            doc.setFontSize(7); setC(C.black);
            doc.text(formatMetricValue(key, val), M + barMaxW + 3, y + 6);

            y += 14;
          }
        }
      }
    }

    // ═══════ ENGAGEMENT BREAKDOWN PAGE ═══════
    const totalEng = snapshots.reduce((s: number, sn: any) => {
      const m = sn.metrics_data as Record<string, number>;
      return s + (m.engagement || 0) + (m.likes || 0) + (m.comments || 0) + (m.shares || 0);
    }, 0);

    if (totalEng > 0) {
      doc.addPage();
      y = newPageHeader();
      y = sectionTitle("Engagement Distribution", y);

      const engByPlatform = snapshots.map((sn: any) => {
        const m = sn.metrics_data as Record<string, number>;
        return { name: PLATFORM_LABELS[sn.platform] || sn.platform, value: (m.engagement || 0) + (m.likes || 0) + (m.comments || 0) + (m.shares || 0) };
      }).filter(e => e.value > 0).sort((a, b) => b.value - a.value);

      const pieColors = [C.primary, C.secondary, C.accent, C.orange, C.grey, [200, 60, 60] as [number, number, number]];
      const maxEng = Math.max(...engByPlatform.map(e => e.value));
      const barMaxW = CW * 0.6;

      for (let i = 0; i < engByPlatform.length; i++) {
        if (y + 18 > H - 30) { doc.addPage(); y = newPageHeader(); }
        const item = engByPlatform[i];
        const barW = (item.value / maxEng) * barMaxW;
        const pct = ((item.value / totalEng) * 100).toFixed(1);
        const color = pieColors[i % pieColors.length];

        doc.setFontSize(9); setC(C.black); doc.text(item.name, M, y);
        setF(C.lightGrey); doc.roundedRect(M, y + 3, barMaxW, 7, 3, 3, "F");
        setF(color); doc.roundedRect(M, y + 3, Math.max(barW, 4), 7, 3, 3, "F");

        doc.setFontSize(8); setC(C.black);
        doc.text(`${item.value.toLocaleString()} (${pct}%)`, M + barMaxW + 4, y + 9);

        y += 18;
      }
    }

    // ═══════ TOP CONTENT PAGE ═══════
    const hasTopContent = snapshots.some((sn: any) => sn.top_content && Array.isArray(sn.top_content) && sn.top_content.length > 0);
    if (hasTopContent) {
      doc.addPage();
      y = newPageHeader();
      y = sectionTitle("Top Performing Content", y);

      for (const snapshot of snapshots) {
        const topContent = (snapshot as any).top_content;
        if (!topContent || !Array.isArray(topContent) || topContent.length === 0) continue;

        doc.setFontSize(12); setC(C.primary);
        doc.text(PLATFORM_LABELS[snapshot.platform] || snapshot.platform, M, y);
        y += 8;

        for (const item of topContent.slice(0, 5)) {
          if (y + 12 > H - 30) { doc.addPage(); y = newPageHeader(); }
          doc.setFontSize(8); setC(C.black);
          const name = (item.name || item.campaign_name || item.title || "—").substring(0, 60);
          doc.text(`• ${name}`, M + 4, y);
          y += 5;
          if (item.spend !== undefined || item.clicks !== undefined || item.impressions !== undefined) {
            doc.setFontSize(7); setC(C.grey);
            const details = [];
            if (item.spend !== undefined) details.push(`Spend: ${currSymbol}${Number(item.spend).toFixed(2)}`);
            if (item.impressions !== undefined) details.push(`Imp: ${Number(item.impressions).toLocaleString()}`);
            if (item.clicks !== undefined) details.push(`Clicks: ${Number(item.clicks).toLocaleString()}`);
            doc.text(details.join("  |  "), M + 8, y);
            y += 6;
          }
          y += 2;
        }
        y += 6;
      }
    }

    // ═══════ DEMOGRAPHICS PLACEHOLDER ═══════
    doc.addPage();
    y = newPageHeader();
    y = sectionTitle("Audience & Demographics", y);

    const placeholders = [
      { title: "Age Distribution", desc: "Age group breakdown will appear here once demographic data is synced." },
      { title: "Gender Split", desc: "Male/female audience split will be displayed in future reports." },
      { title: "Geographic Reach", desc: "Top countries and cities data will be shown when available." },
      { title: "Device Breakdown", desc: "Mobile vs desktop vs tablet usage breakdown coming soon." },
    ];

    const phW = (CW - 8) / 2;
    const phH = 35;

    for (let i = 0; i < placeholders.length; i++) {
      const px = M + (i % 2) * (phW + 8);
      const py = y + Math.floor(i / 2) * (phH + 8);

      setF(C.white); doc.roundedRect(px, py, phW, phH, 3, 3, "F");
      setF(C.lightGrey); doc.rect(px + 2, py + 2, phW - 4, 1, "F");

      doc.setFontSize(9); setC(C.black); doc.text(placeholders[i].title, px + 6, py + 12);
      doc.setFontSize(7); setC(C.grey);
      const descLines = doc.splitTextToSize(placeholders[i].desc, phW - 12);
      doc.text(descLines, px + 6, py + 19);
    }

    y += Math.ceil(placeholders.length / 2) * (phH + 8) + 8;
    doc.setFontSize(9); setC(C.grey);
    doc.text("Demographic insights will be available in future reports as platforms provide this data.", M, y);

    // ═══════ AI INSIGHTS PAGE ═══════
    if (showAiInsights && aiInsights) {
      doc.addPage();
      y = newPageHeader();
      y = sectionTitle("Insights & Analysis", y);
      doc.setFontSize(11); setC(C.black);
      wrapText(aiInsights, M, y, CW, 6);
    }

    // ═══════ UPSELL PAGE ═══════
    if (client.enable_upsell && aiUpsell) {
      doc.addPage();
      y = newPageHeader();
      y = sectionTitle("Recommendations", y);
      doc.setFontSize(10); setC(C.grey);
      doc.text("Based on your current marketing performance:", M, y);
      y += 8;
      doc.setFontSize(11); setC(C.black);
      wrapText(aiUpsell, M, y, CW, 6);
    }

    // ═══════ CLOSING PAGE ═══════
    doc.addPage();
    setF(C.black); doc.rect(0, 0, W, H, "F");
    setF(C.primary); doc.rect(0, 0, 6, H, "F");

    if (showLogo && org?.logo_url) {
      try {
        const closingLogoRes = await fetch(org.logo_url);
        if (closingLogoRes.ok) {
          const closingLogoBlob = await closingLogoRes.arrayBuffer();
          const closingLogoBase64 = btoa(String.fromCharCode(...new Uint8Array(closingLogoBlob)));
          const ext = org.logo_url.toLowerCase().includes(".png") ? "PNG" : "JPEG";
          doc.addImage(`data:image/${ext.toLowerCase()};base64,${closingLogoBase64}`, ext, W / 2 - 20, 75, 40, 40);
        } else {
          doc.setFontSize(48); setC(C.primary); doc.text(orgName, W / 2, 100, { align: "center" });
        }
      } catch {
        doc.setFontSize(48); setC(C.primary); doc.text(orgName, W / 2, 100, { align: "center" });
      }
    } else {
      doc.setFontSize(48); setC(C.primary); doc.text(orgName, W / 2, 100, { align: "center" });
    }

    setF(C.primary); doc.rect(W / 2 - 25, 125, 50, 1, "F");

    doc.setFontSize(18); setC(C.white); doc.text("Thank you", W / 2, 148, { align: "center" });

    doc.setFontSize(11); setC(C.grey);
    doc.text("For questions about this report, please contact", W / 2, 170, { align: "center" });
    doc.text(`your ${orgName} account manager.`, W / 2, 178, { align: "center" });

    if (org?.slug) {
      doc.setFontSize(10); setC(C.primary); doc.text(org.slug, W / 2, 200, { align: "center" });
    }

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
      ai_insights: aiInsights,
      ai_upsell_recommendations: aiUpsell || null,
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
