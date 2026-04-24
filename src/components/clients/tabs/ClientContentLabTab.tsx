import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Play, FileText, Loader2, CheckCircle2, AlertCircle, Clock,
  Pencil, ArrowRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useContentLabRuns, useContentLabUsage } from '@/hooks/useContentLab';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import { useStartContentLabRun } from '@/hooks/useStartContentLabRun';
import { useRunProgress } from '@/hooks/useRunProgress';
import StartRunDialog from '@/components/content-lab/StartRunDialog';
import UsageHeader from '@/components/content-lab/UsageHeader';
import ContentLabPaywall from '@/components/content-lab/ContentLabPaywall';
import { parseCompetitors } from '@/lib/competitors';
import type { Client } from '@/types/database';

interface Props {
  client: Client;
  /** Switch the parent tabs to the Settings tab. */
  onEditClient: () => void;
}

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-primary/10 text-primary',
  completed: 'bg-emerald-500/10 text-emerald-500',
  failed: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

const PHASE_LABELS: Record<string, string> = {
  discover: 'Discovering competitors & viral accounts',
  validate: 'Validating handles',
  scrape: 'Scraping posts',
  analyse: 'Analysing patterns',
  ideate: 'Generating ideas',
  notify: 'Sending notification',
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'running' || status === 'pending') return <Loader2 className="h-3 w-3 animate-spin" />;
  if (status === 'completed') return <CheckCircle2 className="h-3 w-3" />;
  if (status === 'failed') return <AlertCircle className="h-3 w-3" />;
  return <Clock className="h-3 w-3" />;
};

const ClientContentLabTab = ({ client, onEditClient }: Props) => {
  const navigate = useNavigate();
  const { hasAccess, canGenerate, isLoading: accessLoading } = useContentLabAccess();
  const { data: runs = [] } = useContentLabRuns(client.id);
  const { data: usage } = useContentLabUsage();
  const { start, starting } = useStartContentLabRun();

  const [confirmOpen, setConfirmOpen] = useState(false);

  const latest = runs[0];
  const isActive = latest?.status === 'pending' || latest?.status === 'running';
  const { data: progress = [] } = useRunProgress(latest?.id, isActive);

  const handles = (client.social_handles ?? {}) as Record<string, string>;
  const connectedHandles = useMemo(
    () => (['instagram', 'tiktok', 'facebook'] as const).filter((p) => handles[p]),
    [handles],
  );
  const competitors = useMemo(() => parseCompetitors(client.competitors), [client.competitors]);

  const checks = [
    { key: 'industry', ok: !!client.industry, label: 'Industry', value: client.industry ?? 'Not set' },
    { key: 'location', ok: !!client.location, label: 'Location', value: client.location ?? 'Not set' },
    {
      key: 'handles',
      ok: connectedHandles.length > 0,
      label: 'Social handles',
      value: connectedHandles.length
        ? connectedHandles.map((p) => `@${handles[p]} (${p})`).join(', ')
        : 'Add Instagram or TikTok',
    },
    {
      key: 'competitors',
      ok: competitors.length >= 1,
      label: 'Competitors',
      value: competitors.length ? `${competitors.length} added` : 'None added',
    },
    {
      key: 'voice',
      ok: !!client.brand_voice,
      label: 'Brand voice',
      value: client.brand_voice ?? 'Not set (recommended)',
    },
  ];

  const missingHints: string[] = [];
  if (!client.industry) missingHints.push('Industry');
  if (!client.location) missingHints.push('Location');
  if (connectedHandles.length === 0) missingHints.push('Instagram or TikTok handle');
  if (competitors.length === 0) missingHints.push('A few competitors');

  const noCredits = (usage?.creditBalance ?? 0) <= 0;
  const hardBlocked = connectedHandles.length === 0;
  const canStart = canGenerate && !noCredits && !hardBlocked && !isActive;

  if (accessLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!hasAccess) return <ContentLabPaywall />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Content Lab</p>
          <h2 className="mt-1 font-display text-2xl">Generate ideas for {client.company_name}</h2>
          <p className="text-xs text-muted-foreground">
            Research-backed content ideas from your client's posts, local competitors, and viral worldwide content.
          </p>
        </div>
        <UsageHeader buttonSize="sm" />
      </div>


      <StartRunDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        clientName={client.company_name}
        missingHints={missingHints}
        starting={starting}
        onConfirm={async () => {
          const id = await start(client.id, { navigateOnStart: false });
          setConfirmOpen(false);
          if (id) navigate(`/content-lab/run/${id}`);
        }}
      />

      {/* Readiness + Run summary */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base">Data this run will use</h3>
            <Button variant="ghost" size="sm" onClick={onEditClient}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit in Settings
            </Button>
          </div>
          <ul className="space-y-2">
            {checks.map((c) => (
              <li key={c.key} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    c.ok ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'
                  }`}
                >
                  {c.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.value}</p>
                </div>
              </li>
            ))}
          </ul>
          {competitors.length > 0 && (
            <div className="border-t pt-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Competitors
              </p>
              <div className="flex flex-wrap gap-1.5">
                {competitors.slice(0, 12).map((c, i) => (
                  <Badge key={`${c.name}-${i}`} variant="secondary" className="text-[11px]">
                    {c.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-3 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-display text-base">What we'll do</h3>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>· Scan your client's last 30 days of posts</li>
            <li>· Find {client.location ? `local competitors in ${client.location}` : 'local competitors'}</li>
            <li>
              · Pull viral content in {client.industry ?? 'your niche'} worldwide
            </li>
            <li>· Draft 30 platform-tailored ideas</li>
          </ul>
          <div className="mt-auto space-y-2">
            <Button
              className="w-full"
              size="lg"
              onClick={() => setConfirmOpen(true)}
              disabled={!canStart}
            >
              {isActive ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Run in progress</>
              ) : (
                <><Play className="mr-2 h-4 w-4" /> Generate ideas (1 credit)</>
              )}
            </Button>
            {hardBlocked && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Add an Instagram or TikTok handle in Settings to run.
              </p>
            )}
            {noCredits && !hardBlocked && (
              <p className="text-[11px] text-destructive">No credits left — buy more above.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Live progress */}
      {isActive && latest && (
        <Card className="space-y-3 border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="font-display text-base">Working on your report…</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/content-lab/run/${latest.id}`)}>
              Open run <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>
          {progress.length === 0 ? (
            <p className="text-xs text-muted-foreground">Starting up…</p>
          ) : (
            <ol className="space-y-1.5 text-xs">
              {progress.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      p.status === 'failed' ? 'bg-destructive' :
                      p.status === 'ok' ? 'bg-emerald-500' :
                      'bg-primary animate-pulse'
                    }`}
                  />
                  <span className="text-muted-foreground">{PHASE_LABELS[p.phase] ?? p.phase}</span>
                  {p.message && <span className="ml-2 text-muted-foreground">— {p.message}</span>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

      {/* History */}
      <section className="space-y-3">
        <h3 className="font-display text-base">Previous runs</h3>
        {runs.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No runs yet — your generated ideas will appear here.
          </Card>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <Card
                key={r.id}
                className="flex cursor-pointer items-center justify-between gap-3 p-3 transition-colors hover:border-primary/40"
                onClick={() => navigate(`/content-lab/run/${r.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.current_phase ?? (r.status === 'completed' ? 'Done' : r.status)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs capitalize ${
                    STATUS_TONE[r.status] ?? ''
                  }`}
                >
                  <StatusIcon status={r.status} /> {r.status}
                </span>
                {r.status === 'completed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); navigate(`/content-lab/run/${r.id}`); }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ClientContentLabTab;
