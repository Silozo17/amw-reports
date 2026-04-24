import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  AdminOrgContentLabRow,
  useAdminOrgContentLabRows,
  useAdjustContentLabCredits,
  useSetContentLabTier,
} from '@/hooks/useAdminContentLabPlans';
import { CONTENT_LAB_TIER_LIST, runLimitForTier } from '@/lib/contentLabPricing';

type CreditModalState = { org: AdminOrgContentLabRow; mode: 'grant' | 'revoke' } | null;

const TIER_VALUES = ['none', 'starter', 'growth', 'scale'] as const;

const AdminPlansPanel = () => {
  const { data: rows = [], isLoading } = useAdminOrgContentLabRows();
  const setTier = useSetContentLabTier();
  const adjust = useAdjustContentLabCredits();

  const [credit, setCredit] = useState<CreditModalState>(null);
  const [amount, setAmount] = useState<string>('5');
  const [reason, setReason] = useState<string>('');

  const handleTierChange = (orgId: string, value: string) => {
    setTier.mutate({ orgId, tier: value === 'none' ? null : value });
  };

  const submitCredit = () => {
    if (!credit) return;
    const parsed = parseInt(amount, 10);
    if (!parsed || parsed <= 0) return;
    const delta = credit.mode === 'grant' ? parsed : -parsed;
    adjust.mutate(
      { orgId: credit.org.org_id, delta, reason: reason.trim() || `admin_${credit.mode}` },
      {
        onSuccess: () => {
          setCredit(null);
          setAmount('5');
          setReason('');
        },
      },
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Tier definitions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {CONTENT_LAB_TIER_LIST.map((t) => (
              <div key={t.key} className="rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-display tracking-wide uppercase text-muted-foreground">{t.name}</p>
                <p className="mt-1 text-2xl font-display">£{t.priceMonthly}<span className="text-sm text-muted-foreground">/mo</span></p>
                <p className="mt-2 text-sm">{t.runsPerMonth} runs / month</p>
                <p className="mt-1 text-[11px] font-mono text-muted-foreground break-all">{t.priceId}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Tier prices live in Stripe and <code>src/lib/contentLabPricing.ts</code>. To change a price, update both.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Per-organisation Content Lab</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Runs this month</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const limit = runLimitForTier(row.tier);
                    return (
                      <TableRow key={row.org_id}>
                        <TableCell className="font-medium">{row.org_name}</TableCell>
                        <TableCell>
                          <Select
                            value={row.tier ?? 'none'}
                            onValueChange={(v) => handleTierChange(row.org_id, v)}
                            disabled={setTier.isPending}
                          >
                            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {TIER_VALUES.map((t) => (
                                <SelectItem key={t} value={t}>{t === 'none' ? 'None' : t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {row.status ? <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>{row.status}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {row.runs_this_month}{limit > 0 ? ` / ${limit}` : ''}
                        </TableCell>
                        <TableCell>{row.credits_balance}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setCredit({ org: row, mode: 'grant' })}>Grant</Button>
                            <Button size="sm" variant="outline" onClick={() => setCredit({ org: row, mode: 'revoke' })} disabled={row.credits_balance === 0}>Revoke</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!credit} onOpenChange={(open) => { if (!open) setCredit(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {credit?.mode === 'grant' ? 'Grant credits' : 'Revoke credits'} — {credit?.org.org_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Amount</label>
              <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Reason (optional)</label>
              <Input placeholder="e.g. compensation for failed run" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Current balance: {credit?.org.credits_balance ?? 0}. {credit?.mode === 'revoke' && 'Cannot reduce below zero.'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredit(null)}>Cancel</Button>
            <Button onClick={submitCredit} disabled={adjust.isPending}>
              {credit?.mode === 'grant' ? 'Grant' : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminPlansPanel;
