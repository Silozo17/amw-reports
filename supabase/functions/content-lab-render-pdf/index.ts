// content-lab-render-pdf: builds an A4 landscape branded PDF for a Content Lab run.
// Cover -> Viral Feed (top 12) -> 12 Ideas. Uploads to content-lab-reports/{org_id}/{run_id}.pdf
// and writes pdf_storage_path on the run row.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { jsPDF } from "npm:jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// A4 landscape in mm
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 12;
const FOOTER_Y = PAGE_H - 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-render-pdf", method: req.method }));

  try {
    const { run_id } = await req.json().catch(() => ({}));
    if (!run_id) return json({ error: "run_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: run, error: runErr } = await admin
      .from("content_lab_runs")
      .select("id, org_id, client_id, niche_id, created_at")
      .eq("id", run_id).single();
    if (runErr || !run) return json({ error: "Run not found" }, 404);

    const [{ data: niche }, { data: client }, { data: org }, { data: posts }, { data: ideas }] = await Promise.all([
      admin.from("content_lab_niches").select("label, language").eq("id", run.niche_id).maybeSingle(),
      admin.from("clients").select("company_name, logo_url").eq("id", run.client_id).maybeSingle(),
      admin.from("organisations").select("name, logo_url, primary_color, accent_color, heading_font, body_font").eq("id", run.org_id).maybeSingle(),
      admin.from("content_lab_posts").select("*").eq("run_id", run_id).order("engagement_rate", { ascending: false }).limit(12),
      admin.from("content_lab_ideas").select("*").eq("run_id", run_id).order("idea_number"),
    ]);

    const primaryHex = (org?.primary_color as string | null) ?? "#0F172A";
    const accentHex = (org?.accent_color as string | null) ?? "#6366F1";

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // === Cover ===
    drawCover(doc, {
      title: niche?.label ?? "Content Lab Report",
      clientName: client?.company_name ?? "",
      orgName: org?.name ?? "",
      dateLabel: new Date(run.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      primaryHex,
      accentHex,
    });

    // === Viral Feed ===
    if (posts && posts.length > 0) {
      doc.addPage();
      drawSectionHeader(doc, "Viral Feed — Top Performing Posts", primaryHex);
      const thumbs = await fetchThumbs(posts.map((p) => p.thumbnail_url as string | null));
      // 4 columns x 3 rows grid
      const cols = 4;
      const gap = 6;
      const cardW = (PAGE_W - MARGIN * 2 - gap * (cols - 1)) / cols;
      const cardH = 78;
      const startY = 28;
      for (let i = 0; i < posts.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = MARGIN + col * (cardW + gap);
        const y = startY + row * (cardH + gap);
        drawPostCard(doc, posts[i], thumbs[i], { x, y, w: cardW, h: cardH, accentHex });
      }
      drawFooter(doc, org?.name ?? "", 1);
    }

    // === Ideas ===
    if (ideas && ideas.length > 0) {
      // 2 ideas per page
      for (let i = 0; i < ideas.length; i += 2) {
        doc.addPage();
        if (i === 0) drawSectionHeader(doc, "12 Content Ideas for the Month", primaryHex);
        const topY = i === 0 ? 28 : 18;
        drawIdeaCard(doc, ideas[i], { x: MARGIN, y: topY, w: PAGE_W - MARGIN * 2, h: (PAGE_H - topY - 14) / 2 - 3, accentHex });
        if (ideas[i + 1]) {
          drawIdeaCard(doc, ideas[i + 1], {
            x: MARGIN,
            y: topY + (PAGE_H - topY - 14) / 2 + 3,
            w: PAGE_W - MARGIN * 2,
            h: (PAGE_H - topY - 14) / 2 - 3,
            accentHex,
          });
        }
        drawFooter(doc, org?.name ?? "", doc.getNumberOfPages());
      }
    }

    const ab = doc.output("arraybuffer");
    const path = `${run.org_id}/${run_id}.pdf`;
    const { error: upErr } = await admin.storage.from("content-lab-reports").upload(path, new Uint8Array(ab), {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) {
      console.error("Upload failed:", upErr);
      return json({ error: upErr.message }, 500);
    }

    await admin.from("content_lab_runs").update({ pdf_storage_path: path }).eq("id", run_id);

    return json({ ok: true, path });
  } catch (e) {
    console.error("content-lab-render-pdf error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Drawing helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function drawCover(doc: jsPDF, o: {
  title: string; clientName: string; orgName: string; dateLabel: string; primaryHex: string; accentHex: string;
}) {
  const [pr, pg, pb] = hexToRgb(o.primaryHex);
  const [ar, ag, ab] = hexToRgb(o.accentHex);

  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Accent stripe
  doc.setFillColor(ar, ag, ab);
  doc.rect(0, PAGE_H - 6, PAGE_W, 6, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("CONTENT LAB REPORT", MARGIN, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(38);
  const titleLines = doc.splitTextToSize(o.title, PAGE_W - MARGIN * 2);
  doc.text(titleLines, MARGIN, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text(o.dateLabel, MARGIN, 80);

  if (o.clientName) {
    doc.setFontSize(11);
    doc.text(`Prepared for ${o.clientName}`, MARGIN, 92);
  }

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text(o.orgName, MARGIN, PAGE_H - 14);
}

function drawSectionHeader(doc: jsPDF, title: string, primaryHex: string) {
  const [r, g, b] = hexToRgb(primaryHex);
  doc.setTextColor(r, g, b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, MARGIN, 18);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 21, PAGE_W - MARGIN, 21);
}

function drawFooter(doc: jsPDF, orgName: string, pageNum: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(orgName, MARGIN, FOOTER_Y);
  doc.text(`Page ${pageNum}`, PAGE_W - MARGIN, FOOTER_Y, { align: "right" });
}

interface Box { x: number; y: number; w: number; h: number; accentHex: string }

function drawPostCard(doc: jsPDF, post: Record<string, unknown>, thumb: { data: string; format: string } | null, b: Box) {
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.roundedRect(b.x, b.y, b.w, b.h, 1.5, 1.5, "S");

  // Thumbnail (square top portion)
  const thumbH = 38;
  if (thumb) {
    try {
      doc.addImage(thumb.data, thumb.format, b.x + 2, b.y + 2, b.w - 4, thumbH, undefined, "FAST");
    } catch (_) {
      drawThumbPlaceholder(doc, b.x + 2, b.y + 2, b.w - 4, thumbH);
    }
  } else {
    drawThumbPlaceholder(doc, b.x + 2, b.y + 2, b.w - 4, thumbH);
  }

  let ty = b.y + thumbH + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text(`@${truncate(String(post.author_handle ?? ""), 20)}`, b.x + 2, ty);

  ty += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  const caption = String(post.caption ?? post.ai_summary ?? "—");
  const captionLines = doc.splitTextToSize(truncate(caption, 120), b.w - 4);
  doc.text(captionLines.slice(0, 3), b.x + 2, ty);

  ty = b.y + b.h - 6;
  const [ar, ag, ab] = hexToRgb(b.accentHex);
  doc.setTextColor(ar, ag, ab);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  const likes = Number(post.likes ?? 0).toLocaleString();
  const comments = Number(post.comments ?? 0).toLocaleString();
  doc.text(`♥ ${likes}  💬 ${comments}`, b.x + 2, ty);
}

function drawThumbPlaceholder(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(240, 240, 245);
  doc.rect(x, y, w, h, "F");
  doc.setTextColor(170, 170, 170);
  doc.setFontSize(7);
  doc.text("No image", x + w / 2, y + h / 2, { align: "center", baseline: "middle" });
}

function drawIdeaCard(doc: jsPDF, idea: Record<string, unknown>, b: Box) {
  const [ar, ag, ab] = hexToRgb(b.accentHex);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.roundedRect(b.x, b.y, b.w, b.h, 2, 2, "S");

  // Idea number badge
  doc.setFillColor(ar, ag, ab);
  doc.roundedRect(b.x + 4, b.y + 4, 18, 9, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`IDEA ${idea.idea_number ?? ""}`, b.x + 13, b.y + 10.5, { align: "center" });

  // Title
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const titleLines = doc.splitTextToSize(String(idea.title ?? ""), b.w - 30);
  doc.text(titleLines.slice(0, 2), b.x + 26, b.y + 10);

  let ty = b.y + 22;
  const colW = (b.w - 12) / 2;

  // Left col: hook + body
  if (idea.hook) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(ar, ag, ab);
    doc.text("HOOK", b.x + 4, ty);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    const hookLines = doc.splitTextToSize(String(idea.hook), colW);
    doc.text(hookLines.slice(0, 3), b.x + 4, ty + 4);
    ty += 4 + hookLines.slice(0, 3).length * 4 + 2;
  }
  if (idea.body) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(ar, ag, ab);
    doc.text("BODY", b.x + 4, ty);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const maxLines = Math.max(1, Math.floor((b.y + b.h - ty - 14) / 4));
    const bodyLines = doc.splitTextToSize(String(idea.body), colW);
    doc.text(bodyLines.slice(0, maxLines), b.x + 4, ty + 4);
  }
  if (idea.cta) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(ar, ag, ab);
    doc.text("CTA", b.x + 4, b.y + b.h - 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(truncate(String(idea.cta), 80), b.x + 14, b.y + b.h - 6);
  }

  // Right col: why it works + checklist + hashtags
  const rx = b.x + colW + 12;
  let ry = b.y + 22;
  if (idea.why_it_works) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(ar, ag, ab);
    doc.text("WHY IT WORKS", rx, ry);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const wLines = doc.splitTextToSize(String(idea.why_it_works), colW);
    doc.text(wLines.slice(0, 3), rx, ry + 4);
    ry += 4 + wLines.slice(0, 3).length * 4 + 2;
  }
  const checklist = (idea.filming_checklist as string[] | null) ?? [];
  if (checklist.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(ar, ag, ab);
    doc.text("FILMING CHECKLIST", rx, ry);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const items = checklist.slice(0, 5).map((c) => `• ${c}`);
    const itemLines = doc.splitTextToSize(items.join("\n"), colW);
    doc.text(itemLines, rx, ry + 4);
  }
  const hashtags = (idea.hashtags as string[] | null) ?? [];
  if (hashtags.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    const tagText = hashtags.slice(0, 8).map((h) => `#${h}`).join(" ");
    doc.text(truncate(tagText, 90), rx, b.y + b.h - 6);
  }
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ── Image fetching ─────────────────────────────────────────────────────────────

async function fetchThumbs(urls: Array<string | null>): Promise<Array<{ data: string; format: string } | null>> {
  return await Promise.all(urls.map(async (url) => {
    if (!url) return null;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") ?? "";
      const format = ct.includes("png") ? "PNG" : "JPEG";
      const buf = new Uint8Array(await res.arrayBuffer());
      // Cap at ~500KB per image to keep PDF size reasonable
      if (buf.byteLength > 500_000) return null;
      const base64 = btoa(String.fromCharCode(...buf));
      return { data: `data:image/${format.toLowerCase()};base64,${base64}`, format };
    } catch (_) {
      return null;
    }
  }));
}
