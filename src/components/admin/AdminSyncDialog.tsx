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
import { RefreshCw, Loader2 } from 'lucide-react';
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
  const [timeMode, setTimeMode] = useState<TimeMode>('full');
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
    setTimeMode('full');
  };

  /** Get the connections that will actually be synced. */
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

  /** The pool of connections available for channel multi-select. */
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
      const { data, error } = await supabase.functions.invoke('admin-sync', {
        body: payload,
      });

      if (error) {
        toast.error(`Sync failed: ${error.message}`);
      } else if (data?.error) {
        toast.error(`Sync failed: ${data.error}`);
      } else {
        const s = data?.summary;
        if (s?.failed > 0) {
          toast.error(`Sync done: ${s.synced} ok, ${s.failed} failed`);
        } else {
          toast.success(`Sync complete: ${s?.synced ?? 0} month-syncs succeeded`);
        }
        onComplete();
      }
    } catch (e) {
      toast.error('Sync request failed');
      console.error(e);
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
          <DialogTitle className="font-display">Sync Data (Server-Side)</DialogTitle>
          <DialogDescription>
            Choose scope, channels, and time range. Sync runs server-side — you can navigate away safely.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-5 pb-2">
            {/* ── Step 1: Scope ── */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">1. Sync scope</Label>
              <RadioGroup value={scope} onValueChange={(v) => { setScope(v as SyncScope); resetSelections(); }}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="channel" id="scope-channel" />
                  <Label htmlFor="scope-channel" className="font-normal cursor-pointer">Single Channel</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="client" id="scope-client" />
                  <Label htmlFor="scope-client" className="font-normal cursor-pointer">Single Client</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="organisation" id="scope-org" />
                  <Label htmlFor="scope-org" className="font-normal cursor-pointer">Whole Organisation</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="platform" id="scope-platform" />
                  <Label htmlFor="scope-platform" className="font-normal cursor-pointer">Whole Platform (across clients)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* ── Scope-specific selectors ── */}
            {(scope === 'channel' || scope === 'client') && (
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={selectedClientId} onValueChange={(v) => { setSelectedClientId(v); setSelectedConnectionId(''); setSelectedChannelIds(new Set()); }}>
                  <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === 'channel' && selectedClientId && (
              <div className="space-y-2">
                <Label>Channel</Label>
                {clientConnections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active connections for this client</p>
                ) : (
                  <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                    <SelectTrigger><SelectValue placeholder="Select a channel" /></SelectTrigger>
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
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={selectedPlatform} onValueChange={(v) => { setSelectedPlatform(v); setSelectedChannelIds(new Set()); }}>
                  <SelectTrigger><SelectValue placeholder="Select a platform" /></SelectTrigger>
                  <SelectContent>
                    {distinctPlatforms.map(p => (
                      <SelectItem key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ── Step 2: Channel selection (multi-select for non-single scopes) ── */}
            {scope !== 'channel' && selectableChannels.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">2. Channels</Label>
                <RadioGroup value={channelMode} onValueChange={(v) => { setChannelMode(v as 'all' | 'selected'); setSelectedChannelIds(new Set()); }}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="ch-all" />
                    <Label htmlFor="ch-all" className="font-normal cursor-pointer">All channels ({selectableChannels.length})</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="selected" id="ch-selected" />
                    <Label htmlFor="ch-selected" className="font-normal cursor-pointer">Select specific channels</Label>
                  </div>
                </RadioGroup>

                {channelMode === 'selected' && (
                  <div className="space-y-2 ml-6 max-h-40 overflow-y-auto">
                    {selectableChannels.map(c => {
                      const clientName = clients.find(cl => cl.id === c.client_id)?.company_name ?? '';
                      return (
                        <div key={c.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`ch-${c.id}`}
                            checked={selectedChannelIds.has(c.id)}
                            onCheckedChange={() => toggleChannel(c.id)}
                          />
                          <Label htmlFor={`ch-${c.id}`} className="font-normal cursor-pointer text-sm">
                            {clientName && <span className="text-muted-foreground">{clientName} — </span>}
                            {PLATFORM_LABELS[c.platform] ?? c.platform}
                            {c.account_name && <span className="text-muted-foreground"> ({c.account_name})</span>}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Time range ── */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{scope === 'channel' ? '2' : '3'}. Time range</Label>
              <RadioGroup value={timeMode} onValueChange={(v) => setTimeMode(v as TimeMode)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single_month" id="tm-single" />
                  <Label htmlFor="tm-single" className="font-normal cursor-pointer">Single month</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="date_range" id="tm-range" />
                  <Label htmlFor="tm-range" className="font-normal cursor-pointer">Date range</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="full" id="tm-full" />
                  <Label htmlFor="tm-full" className="font-normal cursor-pointer">Full history (24 months)</Label>
                </div>
              </RadioGroup>

              {timeMode === 'single_month' && (
                <div className="flex gap-2 ml-6">
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
              )}

              {timeMode === 'date_range' && (
                <div className="ml-6 space-y-2">
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
              )}

              {timeMode === 'full' && (
                <p className="text-xs text-muted-foreground ml-6">
                  Pinterest connections will be capped to 3 months automatically.
                </p>
              )}
            </div>

            {/* ── Summary ── */}
            {isReady() && targetCount > 0 && (
              <p className="text-xs text-muted-foreground border-t pt-3">
                Will sync <strong>{targetCount}</strong> connection{targetCount !== 1 ? 's' : ''} ×{' '}
                {timeMode === 'single_month'
                  ? '1 month'
                  : timeMode === 'full'
                  ? '24 months'
                  : 'date range'}{' '}
                — runs server-side
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleSync} disabled={!isReady() || targetCount === 0 || isSyncing} className="gap-2">
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Start Sync
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
