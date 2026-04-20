import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, ImageRun,
} from 'npm:docx@8.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STORAGE_BUCKET = 'content-lab-reports';
const MAX_BENCHMARKS_PER_IDEA = 3;
const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour

interface IdeaFull {
  id: string;
  idea_number: number;
  title: string;
  hook: string | null;
  hook_variants: unknown;
  caption: string | null;
  caption_with_hashtag: string | null;
  visual_direction: string | null;
  script_full: string | null;
  cta: string | null;
  target_platform: string | null;
  hashtags: string[] | null;
  duration_seconds: number | null;
  is_wildcard: boolean;
  run_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate the user with the anon key + their JWT (service-role IGNORES auth headers).
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: 'unauthorized' }, 401);
    const userId = userData.user.id;

    // Use a true service-role client for the privileged reads/writes.
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const runId = typeof body.run_id === 'string' ? body.run_id : null;
    const ideaIds = Array.isArray(body.idea_ids) ? body.idea_ids.filter((i: unknown) => typeof i === 'string') : [];
    if (!runId && ideaIds.length === 0) return json({ error: 'run_id or idea_ids required' }, 400);

    // Fetch ideas
    let ideasQuery = supabase
      .from('content_lab_ideas')
      .select('id, idea_number, title, hook, hook_variants, caption, caption_with_hashtag, visual_direction, script_full, cta, target_platform, hashtags, duration_seconds, is_wildcard, run_id')
      .order('idea_number');
    ideasQuery = runId ? ideasQuery.eq('run_id', runId) : ideasQuery.in('id', ideaIds);
    const { data: ideas, error: ideasErr } = await ideasQuery;
    if (ideasErr) throw ideasErr;
    if (!ideas || ideas.length === 0) return json({ error: 'no ideas found' }, 404);

    // Resolve ALL run org_ids touched by these ideas — caller must belong to every org.
    const runIds = [...new Set((ideas as IdeaFull[]).map((i) => i.run_id))];
    const { data: runRows } = await supabase
      .from('content_lab_runs')
      .select('id, org_id, client_id, completed_at')
      .in('id', runIds);
    if (!runRows || runRows.length === 0) return json({ error: 'run missing' }, 404);

    const orgIds = [...new Set(runRows.map((r) => r.org_id as string))];
    const { data: memberships } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId)
      .in('org_id', orgIds);
    const memberOrgIds = new Set((memberships ?? []).map((m) => m.org_id as string));
    const unauthorized = orgIds.some((o) => !memberOrgIds.has(o));
    if (unauthorized) return json({ error: 'forbidden' }, 403);

    const run = runRows[0];

    const [{ data: org }, { data: client }] = await Promise.all([
      supabase.from('organisations').select('name, logo_url, primary_color').eq('id', run.org_id).maybeSingle(),
      supabase.from('clients').select('company_name').eq('id', run.client_id).maybeSingle(),
    ]);

    // (runIds was already computed above for the membership check.)
    const { data: benchmarks } = await supabase
      .from('content_lab_posts')
      .select('id, run_id, thumbnail_url, post_url, author_handle, views, engagement_rate, platform')
      .in('run_id', runIds)
      .order('views', { ascending: false, nullsFirst: false })
      .limit(MAX_BENCHMARKS_PER_IDEA * runIds.length);

    const doc = await buildDocument({
      ideas: ideas as IdeaFull[],
      org: org ?? { name: 'AMW', logo_url: null, primary_color: null },
      client: client ?? { company_name: 'Client' },
      benchmarks: benchmarks ?? [],
    });

    const buffer = await Packer.toBuffer(doc);
    const fileName = `content-brief-${Date.now()}.docx`;
    const path = `${run.org_id}/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      });
    if (uploadErr) throw uploadErr;

    const { data: signed, error: signErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRY);
    if (signErr) throw signErr;

    return json({ url: signed.signedUrl, path, idea_count: ideas.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    console.error('[export-docx]', msg);
    return json({ error: msg }, 500);
  }
});

interface BuildArgs {
  ideas: IdeaFull[];
  org: { name: string; logo_url: string | null; primary_color: string | null };
  client: { company_name: string };
  benchmarks: Array<{ run_id: string; thumbnail_url: string | null; post_url: string | null; author_handle: string; views: number | null; engagement_rate: number | null; platform: string | null }>;
}

async function buildDocument({ ideas, org, client, benchmarks }: BuildArgs): Promise<Document> {
  const cover = await coverPage(org, client, ideas.length);
  const ideaBlocks: Paragraph[] = [];
  for (const idea of ideas) {
    const ideaBenchmarks = benchmarks.filter((b) => b.run_id === idea.run_id).slice(0, MAX_BENCHMARKS_PER_IDEA);
    ideaBlocks.push(...await ideaPage(idea, ideaBenchmarks));
  }
  return new Document({
    creator: org.name,
    title: `${client.company_name} — Content Brief`,
    styles: {
      default: { document: { run: { font: 'Helvetica', size: 22 } } },
    },
    sections: [{ children: [...cover, ...ideaBlocks] }],
  });
}

async function coverPage(
  org: { name: string; logo_url: string | null },
  client: { company_name: string },
  count: number,
): Promise<Paragraph[]> {
  const logoPara = await tryImageParagraph(org.logo_url, 200, 60);
  return [
    ...(logoPara ? [logoPara] : []),
    new Paragraph({ spacing: { before: 600 }, children: [new TextRun({ text: 'Content Brief', size: 56, bold: true })] }),
    new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: client.company_name, size: 36 })] }),
    new Paragraph({
      spacing: { before: 200 },
      children: [new TextRun({ text: `${count} ideas · prepared by ${org.name}`, size: 22, color: '888888' })],
    }),
    new Paragraph({
      spacing: { before: 100 },
      children: [new TextRun({ text: new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), size: 22, color: '888888' })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

async function ideaPage(
  idea: IdeaFull,
  benchmarks: BuildArgs['benchmarks'],
): Promise<Paragraph[]> {
  const blocks: Paragraph[] = [];
  blocks.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({
      text: `Idea ${idea.idea_number}${idea.is_wildcard ? ' · Wildcard' : ''}`,
      size: 28, bold: true,
    })],
  }));
  blocks.push(new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: idea.title, size: 32, bold: true })] }));

  if (idea.hook) {
    blocks.push(sectionHeading('Hook'));
    blocks.push(textPara(idea.hook));
  }
  const variants = parseVariants(idea.hook_variants);
  if (variants.length > 0) {
    blocks.push(sectionHeading('Hook variants'));
    variants.forEach((v) => blocks.push(textPara(`• ${v}`)));
  }
  if (idea.script_full) {
    blocks.push(sectionHeading('Script'));
    idea.script_full.split('\n').filter((l) => l.trim()).forEach((line) => blocks.push(textPara(line)));
  }
  if (idea.caption ?? idea.caption_with_hashtag) {
    blocks.push(sectionHeading('Caption'));
    blocks.push(textPara(idea.caption_with_hashtag ?? idea.caption ?? ''));
  }
  if (idea.visual_direction) {
    blocks.push(sectionHeading('Visual direction'));
    blocks.push(textPara(idea.visual_direction));
  }
  if (idea.cta) {
    blocks.push(sectionHeading('Call to action'));
    blocks.push(textPara(idea.cta));
  }
  const meta: string[] = [];
  if (idea.target_platform) meta.push(`Platform: ${idea.target_platform}`);
  if (idea.duration_seconds) meta.push(`Duration: ~${idea.duration_seconds}s`);
  if (idea.hashtags?.length) meta.push(`Hashtags: ${idea.hashtags.join(' ')}`);
  if (meta.length) {
    blocks.push(sectionHeading('Details'));
    meta.forEach((m) => blocks.push(textPara(m)));
  }
  if (benchmarks.length > 0) {
    blocks.push(sectionHeading('Benchmark inspiration'));
    for (const b of benchmarks) {
      const img = await tryImageParagraph(b.thumbnail_url, 120, 160);
      if (img) blocks.push(img);
      blocks.push(textPara(
        `@${b.author_handle} · ${formatViews(b.views)} views${b.post_url ? ` · ${b.post_url}` : ''}`,
      ));
    }
  }
  blocks.push(new Paragraph({ children: [new PageBreak()] }));
  return blocks;
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 60 },
    children: [new TextRun({ text: text.toUpperCase(), size: 18, bold: true, color: '888888' })],
  });
}

function textPara(text: string): Paragraph {
  return new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text, size: 22 })] });
}

function parseVariants(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => (typeof v === 'string' ? v : (v as { text?: string })?.text ?? '')).filter(Boolean);
}

function formatViews(v: number | null): string {
  if (!v) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

async function tryImageParagraph(url: string | null, height: number, width: number): Promise<Paragraph | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    const type = ct.includes('png') ? 'png' : ct.includes('gif') ? 'gif' : 'jpg';
    const data = new Uint8Array(await res.arrayBuffer());
    return new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new ImageRun({
        type, data, transformation: { width, height },
        altText: { title: 'image', description: 'image', name: 'image' },
      })],
    });
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
