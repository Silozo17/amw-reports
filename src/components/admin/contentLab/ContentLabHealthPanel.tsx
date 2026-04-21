import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { useContentLabHealth } from '@/hooks/useContentLabHealth';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  onSelectRun?: (runId: string) => void;
}

const ContentLabHealthPanel = ({ onSelectRun }: Props) => {
  const { data, isLoading, error } = useContentLabHealth();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-destructive font-body">
        Failed to load health: {error instanceof Error ? error.message : 'Unknown error'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <HealthStat
          icon={<Clock className="h-4 w-4" />}
          label="Stuck runs (>20min)"
          count={data.stuck_runs.length}
          tone={data.stuck_runs.length > 0 ? 'warn' : 'ok'}
        />
        <HealthStat
          icon={<RefreshCw className="h-4 w-4" />}
          label="Refund failures (7d)"
          count={data.refund_failures.length}
          tone={data.refund_failures.length > 0 ? 'error' : 'ok'}
        />
        <HealthStat
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Tier-sync mismatches"
          count={data.tier_mismatches.length}
          tone={data.tier_mismatches.length > 0 ? 'warn' : 'ok'}
        />
      </div>

      {/* Stuck runs */}
      <Card>
        <CardHeader><CardTitle className="text-base font-display">Stuck runs</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Run</TableHead><TableHead>Status</TableHead>
              <TableHead>Last update</TableHead><TableHead>Error</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.stuck_runs.map((r) => (
                <TableRow
                  key={r.id}
                  className={onSelectRun ? 'cursor-pointer hover:bg-muted/50' : ''}
                  onClick={() => onSelectRun?.(r.id)}
                >
                  <TableCell className="font-mono text-xs">{r.id.slice(0, 8)}…</TableCell>
                  <TableCell><Badge variant="secondary" className="font-body">{r.status}</Badge></TableCell>
                  <TableCell className="font-body text-sm">
                    {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="font-body text-sm text-muted-foreground max-w-md truncate">
                    {r.error_message ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
              {data.stuck_runs.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground font-body">
                  No stuck runs 🎉
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table></div>
        </CardContent>
      </Card>

      {/* Refund failures */}
      <Card>
        <CardHeader><CardTitle className="text-base font-display">Refund failures (last 7 days)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>When</TableHead><TableHead>Run</TableHead>
              <TableHead>Ledger</TableHead><TableHead>Reason</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.refund_failures.map((row) => {
                const payload = (row.payload ?? {}) as { ledger_id?: string; refund_reason?: string; caller?: string };
                return (
                  <TableRow
                    key={row.id}
                    className={onSelectRun ? 'cursor-pointer hover:bg-muted/50' : ''}
                    onClick={() => onSelectRun?.(row.run_id)}
                  >
                    <TableCell className="font-body text-sm">
                      {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.run_id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-mono text-xs">{payload.ledger_id?.slice(0, 8) ?? '—'}…</TableCell>
                    <TableCell className="font-body text-sm text-muted-foreground">
                      {payload.refund_reason ?? row.error_message ?? '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {data.refund_failures.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground font-body">
                  No refund failures 🎉
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table></div>
        </CardContent>
      </Card>

      {/* Tier-sync mismatches */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">Tier-sync mismatches</CardTitle>
          <p className="text-xs text-muted-foreground font-body mt-1">
            Orgs with a Content Lab tier set but no active subscription — Stripe webhook should clear these.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Organisation</TableHead><TableHead>Tier</TableHead><TableHead>Sub status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.tier_mismatches.map((row) => (
                <TableRow key={row.org_id}>
                  <TableCell className="font-body">{row.org_name}</TableCell>
                  <TableCell className="font-body capitalize">{row.content_lab_tier}</TableCell>
                  <TableCell className="font-body capitalize">{row.status}</TableCell>
                </TableRow>
              ))}
              {data.tier_mismatches.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground font-body">
                  All tiers in sync 🎉
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table></div>
        </CardContent>
      </Card>
    </div>
  );
};

interface StatProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: 'ok' | 'warn' | 'error';
}

const TONE_CLASSES: Record<StatProps['tone'], string> = {
  ok: 'text-muted-foreground',
  warn: 'text-yellow-500',
  error: 'text-destructive',
};

const HealthStat = ({ icon, label, count, tone }: StatProps) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-body text-muted-foreground flex items-center gap-2">
        {icon}{label}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className={`text-2xl font-display ${TONE_CLASSES[tone]}`}>{count}</p>
    </CardContent>
  </Card>
);

export default ContentLabHealthPanel;
