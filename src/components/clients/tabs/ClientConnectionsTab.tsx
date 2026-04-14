import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import type { PlatformConnection, PlatformType } from '@/types/database';
import { PLATFORM_LABELS, PLATFORM_LOGOS } from '@/types/database';
import ConnectionDialog from '@/components/clients/ConnectionDialog';
import ConnectionDisclaimer from '@/components/clients/ConnectionDisclaimer';

const CONNECTION_CATEGORIES: Array<{ label: string; platforms: PlatformType[] }> = [
  { label: 'Organic Social', platforms: ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads'] },
  { label: 'Paid Advertising', platforms: ['google_ads', 'meta_ads', 'tiktok_ads', 'linkedin_ads'] },
  { label: 'SEO & Web Analytics', platforms: ['google_search_console', 'google_analytics', 'google_business_profile'] },
];

interface ClientConnectionsTabProps {
  clientId: string;
  connections: PlatformConnection[];
  onUpdate: () => void;
  onOpenPicker: (conn: PlatformConnection) => void;
  onRemoveConnection: (conn: PlatformConnection) => void;
}

const ConnectionRow = ({ conn, onOpenPicker, onRemoveConnection }: { conn: PlatformConnection; onOpenPicker: (c: PlatformConnection) => void; onRemoveConnection: (c: PlatformConnection) => void }) => {
  const needsSelection = conn.is_connected && !conn.account_id;
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
        {needsSelection && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenPicker(conn)}>
            Select Account
          </Button>
        )}
        {conn.is_connected && conn.account_id && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpenPicker(conn)}>
            Change
          </Button>
        )}
        <Badge variant={conn.is_connected && conn.account_id ? 'default' : needsSelection ? 'secondary' : 'destructive'}>
          {conn.is_connected && conn.account_id ? 'Connected' : needsSelection ? 'Select Account' : 'Disconnected'}
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

const ClientConnectionsTab = ({ clientId, connections, onUpdate, onOpenPicker, onRemoveConnection }: ClientConnectionsTabProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-lg">Platform Connections</CardTitle>
        <ConnectionDialog clientId={clientId} connections={connections} onUpdate={onUpdate} />
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
                      <ConnectionRow key={conn.id} conn={conn} onOpenPicker={onOpenPicker} onRemoveConnection={onRemoveConnection} />
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
