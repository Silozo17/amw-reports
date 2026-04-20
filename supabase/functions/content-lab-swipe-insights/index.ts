import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You analyse a list of saved short-form content ideas and return a single, punchy one-sentence pattern summary that helps the user understand what they keep saving.

Rules:
- Output strictly valid JSON, nothing else.
- Schema: { "summary": string (≤ 140 chars, friendly, second-person), "breakdown": { [pattern: string]: number } }
- Breakdown counts integer percentages summing to ~100, with 2-4 named patterns (e.g. "Transformations", "Myth-busting", "Tutorials", "Storytime", "Listicles", "Hot takes").
- Tone: warm, observational, never preachy. Example summary: "You skew 60% transformations and 30% myth-busting — high-contrast, opinion-led content."`;

interface IdeaRow {
  title: string;
  hook: string | null;
  caption: string | null;
  visual_direction: string | null;
  target_platform: string | null;
  hashtags: string[] | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return json({ error: 'unauthorized' }, 401);

    const { data: profile } = await supabase
      .from('profiles').select('org_id').eq('user_id', userData.user.id).maybeSingle();
    const orgId = profile?.org_id;
    if (!orgId) return json({ error: 'no org' }, 400);

    // Fetch saved ideas for this org
    const { data: saved, error: savedErr } = await supabase
      .from('content_lab_swipe_file')
      .select(`idea:content_lab_ideas (title, hook, caption, visual_direction, target_platform, hashtags)`)
      .eq('org_id', orgId)
      .limit(200);
    if (savedErr) throw savedErr;

    const ideas: IdeaRow[] = (saved ?? []).map((r: { idea: IdeaRow | null }) => r.idea).filter(Boolean) as IdeaRow[];
    if (ideas.length < 3) {
      return json({ error: 'Need at least 3 saved ideas' }, 400);
    }

    const userPrompt = `Here are ${ideas.length} ideas this user has saved. Identify the dominant patterns.\n\n${
      ideas.map((i, n) => `${n + 1}. ${i.hook ?? i.title}`).join('\n')
    }`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!aiRes.ok) throw new Error(`AI gateway: ${aiRes.status}`);
    const aiJson = await aiRes.json();
    const parsed = JSON.parse(aiJson.choices[0].message.content);

    const { error: upsertErr } = await supabase
      .from('content_lab_swipe_insights')
      .upsert({
        org_id: orgId,
        summary: String(parsed.summary ?? '').slice(0, 240),
        ideas_count: ideas.length,
        pattern_breakdown: parsed.breakdown ?? {},
        generated_at: new Date().toISOString(),
      }, { onConflict: 'org_id' });
    if (upsertErr) throw upsertErr;

    return json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    console.error('[swipe-insights]', msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
