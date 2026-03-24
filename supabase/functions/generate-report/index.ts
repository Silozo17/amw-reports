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

// AMW Brand Colors
const COLORS = {
  offWhite: [244, 237, 227] as [number, number, number],
  black: [36, 31, 33] as [number, number, number],
  purple: [179, 47, 191] as [number, number, number],
  blue: [83, 155, 219] as [number, number, number],
  green: [78, 214, 142] as [number, number, number],
  orange: [238, 135, 51] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  grey: [120, 120, 120] as [number, number, number],
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
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all required data in parallel
    const [clientRes, recipientsRes, snapshotsRes, configRes, prevSnapshotsRes, yoySnapshotsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", client_id).single(),
      supabase.from("client_recipients").select("*").eq("client_id", client_id),
      supabase.from("monthly_snapshots").select("*").eq("client_id", client_id).eq("report_month", report_month).eq("report_year", report_year),
      supabase.from("client_platform_config").select("*").eq("client_id", client_id).eq("is_enabled", true),
      // Previous month
      supabase.from("monthly_snapshots").select("*").eq("client_id", client_id)
        .eq("report_month", report_month === 1 ? 12 : report_month - 1)
        .eq("report_year", report_month === 1 ? report_year - 1 : report_year),
      // Same month last year
      supabase.from("monthly_snapshots").select("*").eq("client_id", client_id)
        .eq("report_month", report_month)
        .eq("report_year", report_year - 1),
    ]);

    const client = clientRes.data;
    if (!client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const snapshots = snapshotsRes.data ?? [];
    const prevSnapshots = prevSnapshotsRes.data ?? [];
    const yoySnapshots = yoySnapshotsRes.data ?? [];
    const configs = configRes.data ?? [];

    if (snapshots.length === 0) {
      return new Response(JSON.stringify({ 
        error: "No data snapshots found for this period. Please sync platform data before generating a report." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

        // Executive summary
        const summaryRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{
              role: "user",
              content: `You are writing a monthly marketing performance executive summary for ${client.company_name} for ${MONTH_NAMES[report_month]} ${report_year}. 

Write 3-4 sentences in plain English that a non-technical business owner would understand. Highlight the best results, biggest changes, and any areas needing attention. Be professional, clear, and encouraging where results are positive. Do not use jargon.

Data: ${dataContext}

If data is empty or unavailable, write a brief note that data collection is in progress and the first full report will be available next month.`
            }],
            max_tokens: 500,
          }),
        });
        if (summaryRes.ok) {
          const summaryJson = await summaryRes.json();
          aiSummary = summaryJson.choices?.[0]?.message?.content ?? "";
        } else {
          console.error("AI summary failed:", summaryRes.status, await summaryRes.text());
        }

        // Platform insights
        const insightsRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{
              role: "user",
              content: `Write platform-by-platform insights for ${client.company_name}'s marketing report for ${MONTH_NAMES[report_month]} ${report_year}.

For each platform with data, write 2-3 sentences explaining what happened, whether it's positive or negative, and what it means for the business. Use simple language a non-technical business owner would understand. Avoid jargon — explain terms like CTR, engagement rate etc in plain English.

Data: ${dataContext}

If no data is available, write a brief note that data will be included once platform connections are active.`
            }],
            max_tokens: 800,
          }),
        });
        if (insightsRes.ok) {
          const insightsJson = await insightsRes.json();
          aiInsights = insightsJson.choices?.[0]?.message?.content ?? "";
        } else {
          console.error("AI insights failed:", insightsRes.status, await insightsRes.text());
        }

        // Upsell recommendations (if enabled)
        if (client.enable_upsell) {
          const upsellRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${lovableApiKey}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{
                role: "user",
                content: `Based on the marketing data for ${client.company_name}, suggest 2-3 relevant AMW Media services that could help improve their results. 

AMW Media offers: SEO, content production, web development, CRM and automations, social media management, paid campaign expansion, email marketing, branding.

Currently subscribed to: ${(client.services_subscribed ?? []).join(", ") || "unknown"}

Write recommendations that feel helpful and natural, not pushy. Each should be 1-2 sentences explaining why it would benefit this specific client based on their data.

Data: ${dataContext}`
              }],
              max_tokens: 400,
            }),
          });
          if (upsellRes.ok) {
            const upsellJson = await upsellRes.json();
            aiUpsell = upsellJson.choices?.[0]?.message?.content ?? "";
          } else {
            console.error("AI upsell failed:", upsellRes.status, await upsellRes.text());
          }
        }
      } catch (aiError) {
        console.error("AI generation error:", aiError);
        aiSummary = `This report covers ${client.company_name}'s marketing performance for ${MONTH_NAMES[report_month]} ${report_year}. Detailed AI-powered insights will be available in future reports.`;
      }
    } else {
      aiSummary = `This report covers ${client.company_name}'s marketing performance for ${MONTH_NAMES[report_month]} ${report_year}. Connect platform accounts and sync data to enable AI-powered insights.`;
    }

    // Generate PDF using jsPDF
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const pageH = 297;
    const margin = 20;
    const contentW = pageW - margin * 2;

    // Helper functions
    const setColor = (color: [number, number, number]) => {
      doc.setTextColor(color[0], color[1], color[2]);
    };
    const setFillColor = (color: [number, number, number]) => {
      doc.setFillColor(color[0], color[1], color[2]);
    };

    const wrapText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number): number => {
      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        if (y > pageH - 30) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, x, y);
        y += lineHeight;
      }
      return y;
    };

    // ===== PAGE 1: COVER =====
    setFillColor(COLORS.black);
    doc.rect(0, 0, pageW, pageH, "F");

    // AMW branding
    doc.setFontSize(72);
    setColor(COLORS.purple);
    doc.text("AMW", pageW / 2, 80, { align: "center" });

    doc.setFontSize(16);
    setColor(COLORS.offWhite);
    doc.text("M E D I A", pageW / 2, 95, { align: "center" });

    // Divider line
    setFillColor(COLORS.purple);
    doc.rect(pageW / 2 - 30, 105, 60, 1, "F");

    // Report title
    doc.setFontSize(24);
    setColor(COLORS.white);
    doc.text("Monthly Marketing", pageW / 2, 130, { align: "center" });
    doc.text("Performance Report", pageW / 2, 142, { align: "center" });

    // Client name
    doc.setFontSize(18);
    setColor(COLORS.purple);
    doc.text(client.company_name, pageW / 2, 170, { align: "center" });

    // Month/Year
    doc.setFontSize(14);
    setColor(COLORS.grey);
    doc.text(`${MONTH_NAMES[report_month]} ${report_year}`, pageW / 2, 185, { align: "center" });

    // Footer
    doc.setFontSize(9);
    setColor(COLORS.grey);
    doc.text("Prepared by AMW Media", pageW / 2, pageH - 25, { align: "center" });
    doc.text("Confidential", pageW / 2, pageH - 18, { align: "center" });

    // ===== PAGE 2: EXECUTIVE SUMMARY =====
    doc.addPage();
    setFillColor(COLORS.offWhite);
    doc.rect(0, 0, pageW, pageH, "F");

    // Header bar
    setFillColor(COLORS.purple);
    doc.rect(0, 0, pageW, 12, "F");

    doc.setFontSize(24);
    setColor(COLORS.black);
    doc.text("Executive Summary", margin, 35);

    // Purple underline
    setFillColor(COLORS.purple);
    doc.rect(margin, 39, 50, 1.5, "F");

    doc.setFontSize(11);
    setColor(COLORS.black);
    let y = wrapText(aiSummary || "Report data will be available once platform connections are active and data has been synced.", margin, 52, contentW, 6);

    // ===== PERFORMANCE OVERVIEW =====
    y += 10;
    if (y > pageH - 80) { doc.addPage(); y = margin + 15; setFillColor(COLORS.offWhite); doc.rect(0, 0, pageW, pageH, "F"); setFillColor(COLORS.purple); doc.rect(0, 0, pageW, 12, "F"); }

    doc.setFontSize(20);
    setColor(COLORS.black);
    doc.text("Performance Overview", margin, y);
    setFillColor(COLORS.purple);
    doc.rect(margin, y + 4, 45, 1.5, "F");
    y += 15;

    // Show metrics from snapshots as KPI cards
    const PLATFORM_LABELS: Record<string, string> = {
      google_ads: "Google Ads", meta_ads: "Meta Ads", facebook: "Facebook",
      instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn",
    };

    const METRIC_LABELS: Record<string, string> = {
      spend: "Spend", impressions: "Impressions", clicks: "Clicks",
      ctr: "CTR", conversions: "Conversions", cpc: "CPC",
      reach: "Reach", total_followers: "Followers", follower_growth: "Growth",
      engagement: "Engagement", engagement_rate: "Eng. Rate",
      likes: "Likes", comments: "Comments", shares: "Shares",
      video_views: "Video Views", posts_published: "Posts",
    };

    if (snapshots.length === 0) {
      doc.setFontSize(11);
      setColor(COLORS.grey);
      y = wrapText("No data snapshots available for this period. Connect platform accounts and run a sync to populate report data.", margin, y, contentW, 6);
    } else {
      for (const snapshot of snapshots) {
        if (y > pageH - 60) {
          doc.addPage();
          setFillColor(COLORS.offWhite);
          doc.rect(0, 0, pageW, pageH, "F");
          setFillColor(COLORS.purple);
          doc.rect(0, 0, pageW, 12, "F");
          y = margin + 15;
        }

        const platformName = PLATFORM_LABELS[snapshot.platform] ?? snapshot.platform;
        const config = configs.find((c: any) => c.platform === snapshot.platform);
        const enabledMetrics: string[] = config?.enabled_metrics ?? Object.keys(snapshot.metrics_data as Record<string, unknown>);
        const prevSnapshot = prevSnapshots.find((s: any) => s.platform === snapshot.platform);
        const yoySnapshot = yoySnapshots.find((s: any) => s.platform === snapshot.platform);

        // Platform header
        doc.setFontSize(16);
        setColor(COLORS.purple);
        doc.text(platformName, margin, y);
        y += 8;

        const metrics = snapshot.metrics_data as Record<string, number>;
        const prevMetrics = (prevSnapshot?.metrics_data ?? {}) as Record<string, number>;
        const yoyMetrics = (yoySnapshot?.metrics_data ?? {}) as Record<string, number>;

        // Metric cards in a grid
        let cardX = margin;
        const cardW = (contentW - 10) / 3;
        const cardH = 22;
        let cardsInRow = 0;

        for (const metricKey of enabledMetrics) {
          if (!(metricKey in metrics)) continue;

          if (y + cardH > pageH - 25) {
            doc.addPage();
            setFillColor(COLORS.offWhite);
            doc.rect(0, 0, pageW, pageH, "F");
            setFillColor(COLORS.purple);
            doc.rect(0, 0, pageW, 12, "F");
            y = margin + 15;
            cardX = margin;
            cardsInRow = 0;
          }

          // Card background
          setFillColor(COLORS.white);
          doc.roundedRect(cardX, y, cardW, cardH, 2, 2, "F");

          // Metric label
          doc.setFontSize(7);
          setColor(COLORS.grey);
          const label = METRIC_LABELS[metricKey] ?? metricKey;
          doc.text(label.toUpperCase(), cardX + 4, y + 5);

          // Metric value
          doc.setFontSize(14);
          setColor(COLORS.black);
          const value = typeof metrics[metricKey] === "number"
            ? metrics[metricKey] % 1 !== 0 ? metrics[metricKey].toFixed(2) : metrics[metricKey].toLocaleString()
            : String(metrics[metricKey]);
          doc.text(String(value), cardX + 4, y + 14);

          // MoM change
          if (client.enable_mom_comparison && prevMetrics[metricKey] !== undefined) {
            const change = prevMetrics[metricKey] !== 0
              ? ((metrics[metricKey] - prevMetrics[metricKey]) / prevMetrics[metricKey]) * 100
              : 0;
            const changeStr = `${change >= 0 ? "+" : ""}${change.toFixed(1)}% MoM`;
            doc.setFontSize(6);
            setColor(change >= 0 ? COLORS.green : COLORS.orange);
            doc.text(changeStr, cardX + 4, y + 19);
          }

          cardX += cardW + 5;
          cardsInRow++;
          if (cardsInRow >= 3) {
            cardX = margin;
            y += cardH + 4;
            cardsInRow = 0;
          }
        }
        if (cardsInRow > 0) y += cardH + 4;
        y += 6;
      }
    }

    // ===== AI INSIGHTS PAGE =====
    if (aiInsights) {
      doc.addPage();
      setFillColor(COLORS.offWhite);
      doc.rect(0, 0, pageW, pageH, "F");
      setFillColor(COLORS.purple);
      doc.rect(0, 0, pageW, 12, "F");

      doc.setFontSize(24);
      setColor(COLORS.black);
      doc.text("Insights & Analysis", margin, 35);
      setFillColor(COLORS.purple);
      doc.rect(margin, 39, 45, 1.5, "F");

      doc.setFontSize(11);
      setColor(COLORS.black);
      wrapText(aiInsights, margin, 52, contentW, 6);
    }

    // ===== UPSELL PAGE (optional) =====
    if (client.enable_upsell && aiUpsell) {
      doc.addPage();
      setFillColor(COLORS.offWhite);
      doc.rect(0, 0, pageW, pageH, "F");
      setFillColor(COLORS.purple);
      doc.rect(0, 0, pageW, 12, "F");

      doc.setFontSize(24);
      setColor(COLORS.black);
      doc.text("Recommendations", margin, 35);
      setFillColor(COLORS.purple);
      doc.rect(margin, 39, 45, 1.5, "F");

      doc.setFontSize(10);
      setColor(COLORS.grey);
      doc.text("Based on your current marketing performance, here are some suggestions:", margin, 50);

      doc.setFontSize(11);
      setColor(COLORS.black);
      wrapText(aiUpsell, margin, 60, contentW, 6);
    }

    // ===== CLOSING PAGE =====
    doc.addPage();
    setFillColor(COLORS.black);
    doc.rect(0, 0, pageW, pageH, "F");

    doc.setFontSize(48);
    setColor(COLORS.purple);
    doc.text("AMW", pageW / 2, 100, { align: "center" });

    doc.setFontSize(14);
    setColor(COLORS.offWhite);
    doc.text("M E D I A", pageW / 2, 112, { align: "center" });

    setFillColor(COLORS.purple);
    doc.rect(pageW / 2 - 25, 120, 50, 1, "F");

    doc.setFontSize(16);
    setColor(COLORS.white);
    doc.text("Thank you", pageW / 2, 145, { align: "center" });

    doc.setFontSize(11);
    setColor(COLORS.grey);
    doc.text("For questions about this report, please contact", pageW / 2, 165, { align: "center" });
    doc.text("your AMW Media account manager.", pageW / 2, 173, { align: "center" });

    doc.setFontSize(10);
    setColor(COLORS.purple);
    doc.text("amwmedia.co.uk", pageW / 2, 195, { align: "center" });

    // Generate PDF buffer
    const pdfBuffer = doc.output("arraybuffer");
    const pdfUint8 = new Uint8Array(pdfBuffer);

    // Upload to storage
    const storagePath = `${client_id}/${report_year}-${String(report_month).padStart(2, "0")}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(storagePath, pdfUint8, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert report record
    const { data: existingReport } = await supabase.from("reports")
      .select("id")
      .eq("client_id", client_id)
      .eq("report_month", report_month)
      .eq("report_year", report_year)
      .maybeSingle();

    if (existingReport) {
      await supabase.from("reports").update({
        status: "success",
        pdf_storage_path: storagePath,
        ai_executive_summary: aiSummary,
        ai_insights: aiInsights,
        ai_upsell_recommendations: aiUpsell || null,
        generated_at: new Date().toISOString(),
      }).eq("id", existingReport.id);
    } else {
      await supabase.from("reports").insert({
        client_id,
        report_month,
        report_year,
        status: "success",
        pdf_storage_path: storagePath,
        ai_executive_summary: aiSummary,
        ai_insights: aiInsights,
        ai_upsell_recommendations: aiUpsell || null,
        generated_at: new Date().toISOString(),
      });
    }

    // Log report generation
    await supabase.from("report_logs").insert({
      client_id,
      report_id: existingReport?.id ?? null,
      status: "success",
    });

    return new Response(JSON.stringify({
      success: true,
      pdf_path: storagePath,
      message: `Report generated for ${client.company_name} - ${MONTH_NAMES[report_month]} ${report_year}`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Report generation error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
