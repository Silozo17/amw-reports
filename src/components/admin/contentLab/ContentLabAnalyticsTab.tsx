import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useContentLabAnalytics } from '@/hooks/useContentLabAnalytics';

const formatGbp = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

const ContentLabAnalyticsTab = () => {
  const { data, isLoading, error } = useContentLabAnalytics();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-destructive font-body">
        Failed to load analytics: {error instanceof Error ? error.message : 'Unknown error'}
      </p>
    );
  }

  const totalMrr = data.mrr_by_tier.reduce((s, t) => s + Number(t.mrr_gbp || 0), 0);
  const totalActiveOrgs = data.mrr_by_tier.reduce((s, t) => s + Number(t.org_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Headline */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-body text-muted-foreground">Total MRR</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-display">{formatGbp(totalMrr)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-body text-muted-foreground">Active subscriptions</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-display">{totalActiveOrgs}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-body text-muted-foreground">Avg regens / idea</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-display">{data.regen_rate_avg ?? '—'}</p></CardContent>
        </Card>
      </div>

      {/* MRR by tier */}
      <Card>
        <CardHeader><CardTitle className="text-base font-display">Revenue by tier</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tier</TableHead><TableHead className="text-right">Orgs</TableHead><TableHead className="text-right">MRR</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.mrr_by_tier.map((row) => (
                <TableRow key={row.tier}>
                  <TableCell className="font-body capitalize">{row.tier}</TableCell>
                  <TableCell className="text-right font-body">{row.org_count}</TableCell>
                  <TableCell className="text-right font-body">{formatGbp(Number(row.mrr_gbp))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Run completion */}
      <Card>
        <CardHeader><CardTitle className="text-base font-display">Run completion by vertical</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Vertical</TableHead><TableHead className="text-right">Completed</TableHead>
              <TableHead className="text-right">Failed</TableHead><TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Rate</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.run_completion.map((row) => (
                <TableRow key={row.industry_slug}>
                  <TableCell className="font-body">{row.industry_slug}</TableCell>
                  <TableCell className="text-right font-body">{row.completed}</TableCell>
                  <TableCell className="text-right font-body">{row.failed}</TableCell>
                  <TableCell className="text-right font-body">{row.total}</TableCell>
                  <TableCell className="text-right font-body">{row.completion_rate_pct ?? '—'}%</TableCell>
                </TableRow>
              ))}
              {data.run_completion.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground font-body">No runs yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pool quality */}
      <Card>
        <CardHeader><CardTitle className="text-base font-display">Pool quality by vertical</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Vertical</TableHead><TableHead className="text-right">Niches</TableHead>
              <TableHead className="text-right">Limited</TableHead><TableHead className="text-right">% Limited</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.pool_quality.map((row) => (
                <TableRow key={row.industry_slug}>
                  <TableCell className="font-body">{row.industry_slug}</TableCell>
                  <TableCell className="text-right font-body">{row.niche_count}</TableCell>
                  <TableCell className="text-right font-body">{row.limited_count}</TableCell>
                  <TableCell className="text-right font-body">{row.limited_pct ?? '—'}%</TableCell>
                </TableRow>
              ))}
              {data.pool_quality.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground font-body">No niches yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Churn signals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">
            Churn signals
            <Badge variant="secondary" className="ml-2 font-body">{data.churn_signals.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Organisation</TableHead><TableHead>Tier</TableHead>
              <TableHead className="text-right">Runs</TableHead><TableHead className="text-right">Credits</TableHead>
              <TableHead className="text-right">Days since last run</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.churn_signals.map((row) => (
                <TableRow key={row.org_id}>
                  <TableCell className="font-body">{row.org_name}</TableCell>
                  <TableCell className="font-body capitalize">{row.content_lab_tier ?? '—'}</TableCell>
                  <TableCell className="text-right font-body">{row.lifetime_runs}</TableCell>
                  <TableCell className="text-right font-body">{row.current_credit_balance}</TableCell>
                  <TableCell className="text-right font-body">{row.days_since_last_run ?? '∞'}</TableCell>
                </TableRow>
              ))}
              {data.churn_signals.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground font-body">No churn signals — healthy 🎉</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContentLabAnalyticsTab;
