import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import usePageMeta from '@/hooks/usePageMeta';
import { useAdminSecurity, useToggleSpendFreeze } from '@/hooks/useAdminSecurity';
import { toast } from 'sonner';

const fmtGbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

const AdminSecurity = () => {
  usePageMeta({ title: 'Security — Admin — AMW Reports', description: 'Platform spend and security controls.' });
  const { data, isLoading } = useAdminSecurity();
  const toggle = useToggleSpendFreeze();

  const onFreeze = async () => {
    if (!confirm('Activate the platform spend freeze? This will block all paid edge functions until lifted.')) return;
    await toggle.mutateAsync({ active: true, reason: 'Manual freeze by admin' });
    toast.success('Spend freeze activated');
  };
  const onLift = async () => {
    await toggle.mutateAsync({ active: false });
    toast.success('Spend freeze lifted');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display flex items-center gap-2">
            <Shield className="h-6 w-6" /> Security & Spend
          </h1>
          <p className="text-muted-foreground font-body mt-1">Platform-wide spend monitoring and circuit-breaker controls.</p>
        </div>

        <Card className={data?.freeze.active ? 'border-destructive' : undefined}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              {data?.freeze.active ? <ShieldAlert className="h-5 w-5 text-destructive" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
              Spend circuit breaker
            </CardTitle>
            {data?.freeze.active ? (
              <Button variant="outline" onClick={onLift} disabled={toggle.isPending}>Lift freeze</Button>
            ) : (
              <Button variant="destructive" onClick={onFreeze} disabled={toggle.isPending}>Force freeze</Button>
            )}
          </CardHeader>
          <CardContent>
            {data?.freeze.active ? (
              <div className="space-y-1">
                <Badge variant="destructive">Frozen</Badge>
                <p className="text-sm text-muted-foreground">{data.freeze.reason}</p>
                <p className="text-xs text-muted-foreground">Since: {data.freeze.at}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Platform is operating normally.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: 'Spend (24h)', value: data?.spendToday ?? 0 },
            { label: 'Spend (7d)', value: data?.spendWeek ?? 0 },
            { label: 'Spend (30d)', value: data?.spendMonth ?? 0 },
          ].map((c) => (
            <Card key={c.label}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-body text-muted-foreground">{c.label}</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-display">{isLoading ? '—' : fmtGbp(c.value)}</p></CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Top 10 orgs by 30d spend</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Organisation</TableHead><TableHead className="text-right">30d spend</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data?.topOrgs ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No spend recorded yet.</TableCell></TableRow>
                ) : data?.topOrgs.map((o) => (
                  <TableRow key={o.org_id}><TableCell>{o.org_name}</TableCell><TableCell className="text-right">{fmtGbp(o.spend_pence)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table></div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminSecurity;
