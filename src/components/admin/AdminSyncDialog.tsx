import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type SyncScope = 'channel' | 'client' | 'organisation' | 'platform';
type TimeMode = 'single_month' | 'date_range' | 'full';

interface Client {
  id: string;
  company_name: string;
}

interface Connection {
  id: string;
  client_id: string;
  platform: string;
  account_name: string | null;
  account_id: string | null;
  is_connected: boolean;
}

interface AdminSyncDialogProps {
  clients: Client[];
  connections: Connection[];
  onComplete: () => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  tiktok_ads: 'TikTok Ads',
  linkedin: 'LinkedIn',
  linkedin_ads: 'LinkedIn Ads',
  google_search_console: 'Google Search Console',
  google_analytics: 'Google Analytics',
  google_business_profile: 'Google Business Profile',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PINTEREST_MAX_MONTHS = 3;

function getYearOptions(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 4 }, (_, i) => current - i);
}

export default function AdminSyncDialog({ clients, connections, onComplete }: AdminSyncDialogProps) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<SyncScope>('organisation');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [channelMode, setChannelMode] = useState<'all' | 'selected'>('all');
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());
  const [timeMode, setTimeMode] = useState<TimeMode>('single_month');
  const [singleMonth, setSingleMonth] = useState(new Date().getMonth() + 1);
  const [singleYear, setSingleYear] = useState(new Date().getFullYear());
  const [rangeStartMonth, setRangeStartMonth] = useState(1);
  const [rangeStartYear, setRangeStartYear] = useState(new Date().getFullYear());
  const [rangeEndMonth, setRangeEndMonth] = useState(new Date().getMonth() + 1);
  const [rangeEndYear, setRangeEndYear] = useState(new Date().getFullYear());
  const [isSyncing, setIsSyncing] = useState(false);

  const activeConnections = useMemo(
    () => connections.filter(c => c.is_connected && c.account_id),
    [connections]
  );

  const clientConnections = selectedClientId
    ? activeConnections.filter(c => c.client_id === selectedClientId)
    : [];

  const distinctPlatforms = useMemo(
    () => [...new Set(activeConnections.map(c => c.platform))].sort(),
    [activeConnections]
  );

  const resetSelections = () => {
    setSelectedClientId('');
    setSelectedConnectionId('');
    setSelectedPlatform('');
    setChannelMode('all');
    setSelectedChannelIds(new Set());
    setTimeMode('single_month');
  };

  const getTargetConnections = (): Connection[] => {
    let pool: Connection[] = [];
    switch (scope) {
      case 'channel':
        return activeConnections.filter(c => c.id === selectedConnectionId);
      case 'client':
        pool = activeConnections.filter(c => c.client_id === selectedClientId);
        break;
      case 'organisation':
        pool = activeConnections;
        break;
      case 'platform':
        pool = activeConnections.filter(c => c.platform === selectedPlatform);
        break;
    }
    if (channelMode === 'selected' && selectedChannelIds.size > 0) {
      pool = pool.filter(c => selectedChannelIds.has(c.id));
    }
    return pool;
  };

  const selectableChannels = useMemo(() => {
    switch (scope) {
      case 'client':
        return clientConnections;
      case 'organisation':
        return activeConnections;
      case 'platform':
        return activeConnections.filter(c => c.platform === selectedPlatform);
      default:
        return [];
    }
  }, [scope, selectedClientId, selectedPlatform, activeConnections, clientConnections]);

  const isReady = (): boolean => {
    switch (scope) {
      case 'channel': return !!selectedConnectionId;
      case 'client': return !!selectedClientId;
      case 'organisation': return activeConnections.length > 0;
      case 'platform': return !!selectedPlatform;
    }
  };

  const targetCount = isReady() ? getTargetConnections().length : 0;

  const hasPinterest = useMemo(() => {
    if (!isReady()) return false;
    return getTargetConnections().some(c => c.platform === 'pinterest');
  }, [scope, selectedClientId, selectedConnectionId, selectedPlatform, channelMode, selectedChannelIds, activeConnections]);

  const needsClientSelect = scope === 'channel' || scope === 'client';
  const needsChannelSelect = scope === 'channel' && selectedClientId;
  const showChannelFilter = scope !== 'channel' && selectableChannels.length > 0;

  const handleSync = async () => {
    const targets = getTargetConnections();
    if (targets.length === 0) {
      toast.info('No active connections to sync');
      return;
    }
    setIsSyncing(true);

    const payload: Record<string, unknown> = {
      connections: targets.map(c => ({ id: c.id, platform: c.platform })),
      mode: timeMode,
    };
    if (timeMode === 'single_month') {
      payload.month = singleMonth;
      payload.year = singleYear;
    } else if (timeMode === 'date_range') {
      payload.start_month = rangeStartMonth;
      payload.start_year = rangeStartYear;
      payload.end_month = rangeEndMonth;
      payload.end_year = rangeEndYear;
    } else {
      payload.months = 24;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-sync', { body: payload });
      if (error) {
        toast.error(`Sync failed: ${error.message}`);
      } else if (data?.error) {
        toast.error(`Sync failed: ${data.error}`);
      } else {
        const enqueued = data?.jobs_enqueued ?? 0;
        toast.success(`Sync started: ${enqueued} job${enqueued !== 1 ? 's' : ''} enqueued — processing server-side`);
        onComplete();
      }
    } catch {
      toast.error('Sync request failed');
    } finally {
      setIsSyncing(false);
      setOpen(false);
    }
  };

  const toggleChannel = (id: string) => {
    setSelectedChannelIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const years = getYearOptions();

  const summaryText = (() => {
    if (!isReady() || targetCount === 0) return 'Select scope and target to continue';
    const timeLabel = timeMode === 'single_month'
      ? `1 month (${MONTHS[singleMonth - 1]} ${singleYear})`
      : timeMode === 'date_range'
        ? `${MONTHS[rangeStartMonth - 1]} ${rangeStartYear} – ${MONTHS[rangeEndMonth - 1]} ${rangeEndYear}`
        : '24 months (full history)';
    return `${targetCount} connection${targetCount !== 1 ? 's' : ''} × ${timeLabel} — server-side`;
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { resetSelections(); setScope('organisation'); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Sync Data
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">Sync Data</DialogTitle>
          <DialogDescription>
            Server-side sync — safe to navigate away once started.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-2">

            {/* ── Step 1: Scope ── */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 1 — Scope</p>
              <RadioGroup value={scope} onValueChange={(v) => { setScope(v as SyncScope); resetSelections(); }} className="grid grid-cols-2 gap-2">
                {([
                  ['channel', 'Single Channel'],
                  ['client', 'Single Client'],
                  ['organisation', 'Whole Org'],
                  ['platform', 'By Platform'],
                ] as const).map(([val, label]) => (
                  <label
                    key={val}
                    htmlFor={`scope-${val}`}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors ${scope === val ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}`}
                  >
                    <RadioGroupItem value={val} id={`scope-${val}`} />
                    {label}
                  </label>
                ))}
              </RadioGroup>
            </section>

            {/* ── Step 2: Target ── */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 2 — Target</p>

              {needsClientSelect && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Client</Label>
                  <Select value={selectedClientId} onValueChange={(v) => { setSelectedClientId(v); setSelectedConnectionId(''); setSelectedChannelIds(new Set()); }}>
                    <SelectTrigger><SelectValue placeholder="Choose a client…" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {needsChannelSelect && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Channel</Label>
                  {clientConnections.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No active connections for this client</p>
                  ) : (
                    <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                      <SelectTrigger><SelectValue placeholder="Choose a channel…" /></SelectTrigger>
                      <SelectContent>
                        {clientConnections.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {PLATFORM_LABELS[c.platform] ?? c.platform} — {c.account_name || c.account_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {scope === 'platform' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Platform</Label>
                  <Select value={selectedPlatform} onValueChange={(v) => { setSelectedPlatform(v); setSelectedChannelIds(new Set()); }}>
                    <SelectTrigger><SelectValue placeholder="Choose a platform…" /></SelectTrigger>
                    <SelectContent>
                      {distinctPlatforms.map(p => (
                        <SelectItem key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {scope === 'organisation' && (
                <p className="text-sm text-muted-foreground">All <strong>{activeConnections.length}</strong> active connection{activeConnections.length !== 1 ? 's' : ''} will be synced.</p>
              )}

              {/* Channel multi-select filter */}
              {showChannelFilter && (
                <div className="space-y-2 pt-1 border-t border-border/50">
                  <Label className="text-xs text-muted-foreground">Channels</Label>
                  <RadioGroup value={channelMode} onValueChange={(v) => { setChannelMode(v as 'all' | 'selected'); setSelectedChannelIds(new Set()); }} className="flex gap-4">
                    <label htmlFor="ch-all" className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <RadioGroupItem value="all" id="ch-all" />
                      All ({selectableChannels.length})
                    </label>
                    <label htmlFor="ch-selected" className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <RadioGroupItem value="selected" id="ch-selected" />
                      Pick specific
                    </label>
                  </RadioGroup>

                  {channelMode === 'selected' && (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto rounded-md border border-border/50 p-2">
                      {selectableChannels.map(c => {
                        const clientName = clients.find(cl => cl.id === c.client_id)?.company_name ?? '';
                        return (
                          <label key={c.id} htmlFor={`ch-${c.id}`} className="flex items-center gap-2 py-0.5 cursor-pointer text-sm">
                            <Checkbox
                              id={`ch-${c.id}`}
                              checked={selectedChannelIds.has(c.id)}
                              onCheckedChange={() => toggleChannel(c.id)}
                            />
                            <span>
                              {clientName && <span className="text-muted-foreground">{clientName} — </span>}
                              {PLATFORM_LABELS[c.platform] ?? c.platform}
                              {c.account_name && <span className="text-muted-foreground"> ({c.account_name})</span>}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Step 3: Time range ── */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 3 — Time Range</p>
              <RadioGroup value={timeMode} onValueChange={(v) => setTimeMode(v as TimeMode)} className="space-y-1">
                <label htmlFor="tm-single" className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="single_month" id="tm-single" />
                  Single month
                </label>
                <label htmlFor="tm-range" className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="date_range" id="tm-range" />
                  Date range
                </label>
                <label htmlFor="tm-full" className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="full" id="tm-full" />
                  Full history (24 months)
                </label>
              </RadioGroup>

              {/* Month/year pickers — always rendered, visibility controlled */}
              <div className={timeMode === 'single_month' ? 'flex gap-2 pl-6' : 'hidden'}>
                <Select value={String(singleMonth)} onValueChange={(v) => setSingleMonth(Number(v))}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(singleYear)} onValueChange={(v) => setSingleYear(Number(v))}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={timeMode === 'date_range' ? 'pl-6 space-y-2' : 'hidden'}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10">From</span>
                  <Select value={String(rangeStartMonth)} onValueChange={(v) => setRangeStartMonth(Number(v))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(rangeStartYear)} onValueChange={(v) => setRangeStartYear(Number(v))}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {years.map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10">To</span>
                  <Select value={String(rangeEndMonth)} onValueChange={(v) => setRangeEndMonth(Number(v))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(rangeEndYear)} onValueChange={(v) => setRangeEndYear(Number(v))}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {years.map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {hasPinterest && timeMode !== 'single_month' && (
                <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Pinterest connections will be capped to {PINTEREST_MAX_MONTHS} months automatically.
                </div>
              )}
            </section>

            {/* ── Summary ── */}
            <div className="rounded-md bg-muted/50 border border-border/50 px-3 py-2 text-xs text-muted-foreground">
              {summaryText}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleSync} disabled={!isReady() || targetCount === 0 || isSyncing} className="gap-2 w-full sm:w-auto">
            {isSyncing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Syncing…</>
            ) : (
              <><RefreshCw className="h-4 w-4" /> Start Sync ({targetCount})</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
