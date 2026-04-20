import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STOPWORDS = new Set([
  'the','a','an','and','or','but','if','to','of','in','on','for','with','at','by','from','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','must','can','this','that','these','those','it','its','as','i','you','we','they','he','she','my','our','your','their','me','us','them',
]);

const tokenise = (s: string | null): Set<string> => {
  if (!s) return new Set();
  const tokens = s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  return new Set(tokens);
};

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { ideaId } = await req.json();
    if (!ideaId) return json({ error: 'ideaId required' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: idea, error: ideaErr } = await supabase
      .from('content_lab_ideas')
      .select('id, run_id, title, hook, caption, created_at, content_lab_runs!inner ( client_id )')
      .eq('id', ideaId)
      .single();
    if (ideaErr || !idea) return json({ error: 'Idea not found' }, 404);

    const clientId = (idea as { content_lab_runs: { client_id: string } }).content_lab_runs.client_id;
    const ideaCreated = new Date((idea as { created_at: string }).created_at);
    const cutoff = new Date(ideaCreated.getTime() - 7 * 86400_000); // allow a 7-day pre-window

    // Pull recent own posts for this client across all runs in the last 60 days.
    const { data: runs } = await supabase
      .from('content_lab_runs')
      .select('id')
      .eq('client_id', clientId)
      .gte('created_at', new Date(Date.now() - 60 * 86400_000).toISOString());
    const runIds = ((runs ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (runIds.length === 0) return json({ suggestion: null });

    const { data: posts } = await supabase
      .from('content_lab_posts')
      .select('id, thumbnail_url, caption, views, engagement_rate, post_url, posted_at, hook_text')
      .in('run_id', runIds)
      .eq('bucket', 'own')
      .gte('posted_at', cutoff.toISOString());

    const candidates = (posts ?? []) as Array<{
      id: string;
      thumbnail_url: string | null;
      caption: string | null;
      views: number;
      engagement_rate: number;
      post_url: string | null;
      posted_at: string | null;
      hook_text: string | null;
    }>;
    if (candidates.length === 0) return json({ suggestion: null });

    const ideaTokens = tokenise(`${(idea as { title: string }).title} ${(idea as { hook: string | null }).hook ?? ''} ${(idea as { caption: string | null }).caption ?? ''}`);

    let best: { post: typeof candidates[number]; score: number } | null = null;
    for (const c of candidates) {
      const cTokens = tokenise(`${c.caption ?? ''} ${c.hook_text ?? ''}`);
      const score = jaccard(ideaTokens, cTokens);
      if (score >= 0.18 && (!best || score > best.score)) {
        best = { post: c, score };
      }
    }

    return json({ suggestion: best });
  } catch (e) {
    console.error('content-lab-link-suggest error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
