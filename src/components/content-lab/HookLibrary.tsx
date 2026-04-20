import { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface HookVariant {
  text: string;
  mechanism: string;
  why: string;
}

interface HookSource {
  text: string;
  mechanism: string;
  why?: string | null;
  origin: 'analyse' | 'idea';
  source_handle?: string | null;
  source_url?: string | null;
  idea_number?: number | null;
}

interface HookLibraryProps {
  analysedHooks: Array<{
    hook_text: string;
    mechanism: string | null;
    why_it_works: string | null;
    source_handle?: string | null;
    source_url?: string | null;
  }>;
  ideas: Array<{
    idea_number: number;
    hook: string | null;
    hook_variants: HookVariant[] | null;
  }>;
}

const MECHANISM_LABELS: Record<string, string> = {
  curiosity_gap: 'Curiosity gap',
  negative: 'Negative framing',
  social_proof: 'Social proof',
  contrarian: 'Contrarian',
  pattern_interrupt: 'Pattern interrupt',
  stat_shock: 'Stat shock',
  question: 'Question',
  story_open: 'Story open',
  unknown: 'Other',
};

const HookLibrary = ({ analysedHooks, ideas }: HookLibraryProps) => {
  const [copied, setCopied] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const all: HookSource[] = [];
    analysedHooks.forEach((h) => {
      if (!h.hook_text) return;
      all.push({
        text: h.hook_text,
        mechanism: (h.mechanism ?? 'unknown').toLowerCase(),
        why: h.why_it_works,
        origin: 'analyse',
        source_handle: h.source_handle ?? null,
        source_url: h.source_url ?? null,
      });
    });
    ideas.forEach((i) => {
      (i.hook_variants ?? []).forEach((v) => {
        if (!v?.text) return;
        all.push({
          text: v.text,
          mechanism: (v.mechanism ?? 'unknown').toLowerCase(),
          why: v.why,
          origin: 'idea',
          idea_number: i.idea_number,
        });
      });
    });

    // De-dupe by lowercase text
    const seen = new Set<string>();
    const deduped = all.filter((h) => {
      const k = h.text.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return deduped.reduce<Record<string, HookSource[]>>((acc, h) => {
      const key = h.mechanism || 'unknown';
      (acc[key] = acc[key] ?? []).push(h);
      return acc;
    }, {});
  }, [analysedHooks, ideas]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      toast.success('Hook copied');
      setTimeout(() => setCopied(null), 1200);
    } catch {
      toast.error('Copy failed');
    }
  };

  const groups = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);

  if (groups.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        No hooks extracted yet — they appear after the analysis step completes.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([mechanism, hooks]) => (
        <Card key={mechanism} className="space-y-3 p-5">
          <header className="flex items-center justify-between">
            <h3 className="font-display text-lg">{MECHANISM_LABELS[mechanism] ?? mechanism}</h3>
            <Badge variant="outline">{hooks.length}</Badge>
          </header>
          <ul className="space-y-2">
            {hooks.map((h, idx) => (
              <li
                key={`${mechanism}-${idx}`}
                className="group flex items-start justify-between gap-3 rounded-md border border-border/50 bg-muted/30 p-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium leading-snug">{h.text}</p>
                  {h.why && <p className="text-xs text-muted-foreground">{h.why}</p>}
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {h.origin === 'analyse'
                      ? h.source_handle ? `From @${h.source_handle}` : 'From scraped post'
                      : `From idea #${h.idea_number}`}
                    {h.source_url && (
                      <>
                        {' · '}
                        <a href={h.source_url} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                          source
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(h.text)}
                  aria-label="Copy hook"
                >
                  {copied === h.text ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
};

export default HookLibrary;
