import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SYNC_FUNCTION_MAP } from '@/lib/platformRouting';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type SyncScope = 'channel' | 'client' | 'organisation' | 'platform';

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

const MONTH_NAMES_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  tiktok_ads: 'TikTok Ads',
  linkedin: 'LinkedIn',
  google_search_console: 'Google Search Console',
  google_analytics: 'Google Analytics',
  google_business_profile: 'Google Business Profile',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
};

export default function AdminSyncDialog({ clients, connections, onComplete }: AdminSyncDialogProps) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<SyncScope>('organisation');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState('');

  const activeConnections = connections.filter(c => c.is_connected && c.account_id);

  const clientConnections = selectedClientId
    ? activeConnections.filter(c => c.client_id === selectedClientId)
    : [];

  const distinctPlatforms = [...new Set(activeConnections.map(c => c.platform))].sort();

  const resetSelections = () => {
    setSelectedClientId('');
    setSelectedConnectionId('');
    setSelectedPlatform('');
  };

  const getTargetConnections = (): Connection[] => {
    switch (scope) {
      case 'channel':
        return activeConnections.filter(c => c.id === selectedConnectionId);
      case 'client':
        return activeConnections.filter(c => c.client_id === selectedClientId);
      case 'organisation':
        return activeConnections;
      case 'platform':
        return activeConnections.filter(c => c.platform === selectedPlatform);
    }
  };

  const isReady = (): boolean => {
    if (isSyncing) return false;
    switch (scope) {
      case 'channel': return !!selectedConnectionId;
      case 'client': return !!selectedClientId;
      case 'organisation': return activeConnections.length > 0;
      case 'platform': return !!selectedPlatform;
    }
  };

  const handleSync = async () => {
    const targets = getTargetConnections();
    if (targets.length === 0) {
      toast.info('No active connections to sync');
      return;
    }

    setIsSyncing(true);
    const now = new Date();
    let m = now.getMonth() + 1;
    let y = now.getFullYear();
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < 12; i++) {
      setProgress(`${MONTH_NAMES_SHORT[m]} ${y} (${i + 1}/12) — ${targets.length} connection${targets.length > 1 ? 's' : ''}`);
      for (const conn of targets) {
        const fn = SYNC_FUNCTION_MAP[conn.platform];
        if (!fn) continue;
        try {
          const { data, error } = await supabase.functions.invoke(fn, {
            body: { connection_id: conn.id, month: m, year: y },
          });
          if (error || data?.error) failCount++;
          else successCount++;
        } catch {
          failCount++;
        }
      }
      m--;
      if (m === 0) { m = 12; y--; }
    }

    if (failCount > 0) {
      toast.error(`Sync done: ${successCount} ok, ${failCount} failed`);
    } else {
      toast.success(`Sync complete: ${successCount} syncs across 24 months`);
    }

    setProgress('');
    setIsSyncing(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { resetSelections(); setScope('organisation'); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Sync (24 months)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Sync Data (24 months)</DialogTitle>
          <DialogDescription>Choose what to sync. Data will be fetched for the last 24 months.</DialogDescription>
        </DialogHeader>

        {isSyncing ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{progress}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Scope selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Sync scope</Label>
              <RadioGroup value={scope} onValueChange={(v) => { setScope(v as SyncScope); resetSelections(); }}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="channel" id="scope-channel" />
                  <Label htmlFor="scope-channel" className="font-normal cursor-pointer">Single Channel</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="client" id="scope-client" />
                  <Label htmlFor="scope-client" className="font-normal cursor-pointer">Single Client (all channels)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="organisation" id="scope-org" />
                  <Label htmlFor="scope-org" className="font-normal cursor-pointer">Whole Organisation</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="platform" id="scope-platform" />
                  <Label htmlFor="scope-platform" className="font-normal cursor-pointer">Whole Platform (across all clients)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Conditional selects */}
            {(scope === 'channel' || scope === 'client') && (
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={selectedClientId} onValueChange={(v) => { setSelectedClientId(v); setSelectedConnectionId(''); }}>
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
                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                  <SelectTrigger><SelectValue placeholder="Select a platform" /></SelectTrigger>
                  <SelectContent>
                    {distinctPlatforms.map(p => (
                      <SelectItem key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Summary */}
            {isReady() && (
              <p className="text-xs text-muted-foreground">
                Will sync <strong>{getTargetConnections().length}</strong> connection{getTargetConnections().length !== 1 ? 's' : ''} × 12 months
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {!isSyncing && (
            <Button onClick={handleSync} disabled={!isReady()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Start Sync
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
