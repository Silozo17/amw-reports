import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Trash2, RefreshCw } from 'lucide-react';
import type { PlatformConnection, PlatformType } from '@/types/database';
import { PLATFORM_LABELS, PLATFORM_LOGOS } from '@/types/database';
import ConnectionDialog from '@/components/clients/ConnectionDialog';
import ConnectionDisclaimer from '@/components/clients/ConnectionDisclaimer';
import { useSyncJobs } from '@/hooks/useSyncJobs';
import { toast } from 'sonner';

const CONNECTION_CATEGORIES: Array<{ label: string; platforms: PlatformType[] }> = [
  { label: 'Organic Social', platforms: ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads'] },
  { label: 'Paid Advertising', platforms: ['google_ads', 'meta_ads', 'tiktok_ads', 'linkedin_ads'] },
  { label: 'SEO & Web Analytics', platforms: ['google_search_console', 'google_analytics', 'google_business_profile'] },
];

const COOLDOWN_MS_DAILY = 24 * 60 * 60 * 1000;
const COOLDOWN_MS_WEEKLY = 7 * 24 * 60 * 60 * 1000;

function getCooldownMs(planSlug: string | undefined): number {
  return planSlug === 'creator' ? COOLDOWN_MS_WEEKLY : COOLDOWN_MS_DAILY;
}

function getSyncCooldownInfo(lastSyncAt: string | null, planSlug: string | undefined, isPlatformAdmin = false): { canSync: boolean; nextAvailable: Date | null } {
  if (isPlatformAdmin) return { canSync: true, nextAvailable: null };
  if (!lastSyncAt) return { canSync: true, nextAvailable: null };
  const cooldown = getCooldownMs(planSlug);
  const lastSync = new Date(lastSyncAt);
  const nextAvailable = new Date(lastSync.getTime() + cooldown);
  return { canSync: nextAvailable <= new Date(), nextAvailable };
}

interface ClientConnectionsTabProps {
  clientId: string;
  connections: PlatformConnection[];
  onUpdate: () => void;
  onOpenPicker: (conn: PlatformConnection) => void;
  onRemoveConnection: (conn: PlatformConnection) => void;
  orgId?: string;
  planSlug?: string;
  isOrgMember?: boolean;
  isPlatformAdmin?: boolean;
}

interface ConnectionRowProps {
  conn: PlatformConnection;
  onOpenPicker: (c: PlatformConnection) => void;
  onRemoveConnection: (c: PlatformConnection) => void;
  isOrgMember: boolean;
  isPlatformAdmin: boolean;
  planSlug: string | undefined;
  orgId: string | undefined;
  isSyncing: boolean;
  onSync: (conn: PlatformConnection) => void;
}

const ConnectionRow = ({ conn, onOpenPicker, onRemoveConnection, isOrgMember, isPlatformAdmin, planSlug, isSyncing, onSync }: ConnectionRowProps) => {
  const needsSelection = conn.is_connected && !conn.account_id;
  const isFullyConnected = conn.is_connected && !!conn.account_id;
  const { canSync, nextAvailable } = getSyncCooldownInfo(conn.last_sync_at, planSlug, isPlatformAdmin);
  const showSyncButton = (isOrgMember || isPlatformAdmin) && isFullyConnected;

  return (
    <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
      <div>
        <div className="flex items-center gap-2">
          {PLATFORM_LOGOS[conn.platform] && <img src={PLATFORM_LOGOS[conn.platform]} alt="" className="h-5 w-5 object-contain" />}
          <p className="text-sm font-body font-medium">{PLATFORM_LABELS[conn.platform]}</p>
        </div>
        <p className="text-xs text-muted-foreground ml-7">
          {conn.account_name ?? conn.account_id ?? 'No account selected'}
          {conn.last_sync_at && ` · Last sync: ${new Date(conn.last_sync_at).toLocaleDateString()}`}
        </p>
        {conn.last_error && <p className="text-xs text-destructive mt-1">{conn.last_error}</p>}
      </div>
      <div className="flex items-center gap-2">
        {showSyncButton && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={!canSync || isSyncing}
                    onClick={() => onSync(conn)}
                    aria-label={`Sync ${PLATFORM_LABELS[conn.platform]}`}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {isSyncing
                  ? 'Syncing…'
                  : canSync
                    ? 'Sync now'
                    : `Next sync: ${nextAvailable?.toLocaleDateString()} ${nextAvailable?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {needsSelection && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenPicker(conn)}>
            Select Account
          </Button>
        )}
        {isFullyConnected && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpenPicker(conn)}>
            Change
          </Button>
        )}
        <Badge variant={isFullyConnected ? 'default' : needsSelection ? 'secondary' : 'destructive'}>
          {isFullyConnected ? 'Connected' : needsSelection ? 'Select Account' : 'Disconnected'}
        </Badge>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {PLATFORM_LABELS[conn.platform]}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the connection and delete all associated data (snapshots, sync history, and metric configuration) for this platform.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onRemoveConnection(conn)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Remove & Delete Data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

const ClientConnectionsTab = ({ clientId, connections, onUpdate, onOpenPicker, onRemoveConnection, orgId, planSlug, isOrgMember = false }: ClientConnectionsTabProps) => {
  const { activeJobs, enqueueSync } = useSyncJobs(clientId);
  const [syncingConnectionIds, setSyncingConnectionIds] = useState<Set<string>>(new Set());
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const fullyConnected = connections.filter(c => c.is_connected && !!c.account_id);
  const syncableConnections = fullyConnected.filter(c => getSyncCooldownInfo(c.last_sync_at, planSlug).canSync);

  const handleSyncAll = async () => {
    if (!orgId || syncableConnections.length === 0) return;
    setIsSyncingAll(true);
    let queued = 0;
    try {
      for (const conn of syncableConnections) {
        if (isConnectionSyncing(conn.id)) continue;
        try {
          await enqueueSync({
            connectionId: conn.id,
            clientId: conn.client_id,
            orgId,
            platform: conn.platform,
            months: 1,
            priority: 3,
          });
          queued++;
        } catch {
          console.error(`Failed to enqueue sync for ${conn.platform}`);
        }
      }
      if (queued > 0) {
        toast.success(`Sync started for ${queued} platform${queued > 1 ? 's' : ''}`);
      } else {
        toast.info('All platforms are already syncing or on cooldown');
      }
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSync = async (conn: PlatformConnection) => {
    if (!orgId) return;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    setSyncingConnectionIds(prev => new Set(prev).add(conn.id));
    try {
      await enqueueSync({
        connectionId: conn.id,
        clientId: conn.client_id,
        orgId,
        platform: conn.platform,
        months: 1,
        priority: 3,
      });
      toast.success(`Sync started for ${PLATFORM_LABELS[conn.platform]}`);
    } catch {
      toast.error(`Failed to sync ${PLATFORM_LABELS[conn.platform]}`);
    } finally {
      setSyncingConnectionIds(prev => {
        const next = new Set(prev);
        next.delete(conn.id);
        return next;
      });
    }
  };

  const isConnectionSyncing = (connId: string) =>
    syncingConnectionIds.has(connId) || activeJobs.some(j => j.connection_id === connId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-lg">Platform Connections</CardTitle>
        <div className="flex items-center gap-2">
          {isOrgMember && fullyConnected.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5"
                      disabled={syncableConnections.length === 0 || isSyncingAll}
                      onClick={handleSyncAll}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                      Sync All
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {isSyncingAll
                    ? 'Syncing all platforms…'
                    : syncableConnections.length === 0
                      ? 'All connections are on cooldown'
                      : `Sync ${syncableConnections.length} eligible connection${syncableConnections.length > 1 ? 's' : ''}`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <ConnectionDialog clientId={clientId} connections={connections} onUpdate={onUpdate} />
        </div>
      </CardHeader>
      <CardContent>
        {connections.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No platforms connected yet</p>
        ) : (
          <div className="space-y-5">
            {CONNECTION_CATEGORIES.map((category, catIdx) => {
              const catConnections = category.platforms
                .map(p => connections.find(c => c.platform === p))
                .filter((c): c is PlatformConnection => !!c);
              if (catConnections.length === 0) return null;
              return (
                <div key={category.label}>
                  {catIdx > 0 && <div className="h-px bg-border mb-4" />}
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{category.label}</p>
                  <div className="space-y-3">
                    {catConnections.map(conn => (
                      <ConnectionRow
                        key={conn.id}
                        conn={conn}
                        onOpenPicker={onOpenPicker}
                        onRemoveConnection={onRemoveConnection}
                        isOrgMember={isOrgMember}
                        planSlug={planSlug}
                        orgId={orgId}
                        isSyncing={isConnectionSyncing(conn.id)}
                        onSync={handleSync}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <div className="px-6 pb-4">
        <ConnectionDisclaimer />
      </div>
    </Card>
  );
};

export default ClientConnectionsTab;
