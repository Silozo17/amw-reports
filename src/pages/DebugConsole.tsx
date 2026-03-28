import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy, RefreshCw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_LABELS } from '@/types/database';
import type { PlatformType, PlatformConnection } from '@/types/database';

interface Client {
  id: string;
  company_name: string;
}


const maskToken = (token: string | null): string => {
  if (!token) return '—';
  if (token.length <= 8) return '••••';
  return token.slice(0, 4) + '••••' + token.slice(-4);
};

const JsonViewer = ({ data, label }: { data: unknown; label: string }) => {
  const json = JSON.stringify(data, null, 2);
  const handleCopy = () => {
    navigator.clipboard.writeText(json);
    toast.success(`${label} copied to clipboard`);
  };
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={handleCopy}>
          <Copy className="h-3 w-3 mr-1" /> Copy
        </Button>
      </div>
      <pre className="bg-muted rounded-md p-3 text-xs overflow-auto max-h-96 whitespace-pre-wrap break-all font-mono">
        {json}
      </pre>
    </div>
  );
};

const DebugConsole = () => {
  const { isPlatformAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState({ connections: false, syncLogs: false, snapshots: false });

  // Fetch clients on mount
  useEffect(() => {
    supabase.from('clients').select('id, company_name').order('company_name').then(({ data }) => {
      setClients(data ?? []);
    });
  }, []);

  // Fetch data when client changes
  useEffect(() => {
    if (!selectedClientId) return;
    fetchConnections();
    fetchSyncLogs();
    fetchSnapshots();
  }, [selectedClientId]);

  const fetchConnections = async () => {
    setLoading(l => ({ ...l, connections: true }));
    const { data } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('client_id', selectedClientId)
      .order('platform');
    setConnections((data as PlatformConnection[]) ?? []);
    setLoading(l => ({ ...l, connections: false }));
  };

  const fetchSyncLogs = async () => {
    setLoading(l => ({ ...l, syncLogs: true }));
    const { data } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('client_id', selectedClientId)
      .order('started_at', { ascending: false })
      .limit(50);
    setSyncLogs(data ?? []);
    setLoading(l => ({ ...l, syncLogs: false }));
  };

  const fetchSnapshots = async () => {
    setLoading(l => ({ ...l, snapshots: true }));
    const { data } = await supabase
      .from('monthly_snapshots')
      .select('*')
      .eq('client_id', selectedClientId)
      .order('report_year', { ascending: false })
      .order('report_month', { ascending: false })
      .limit(50);
    setSnapshots(data ?? []);
    setLoading(l => ({ ...l, snapshots: false }));
  };


  if (!isPlatformAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Shield className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">Platform admin access required</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display">Debug Console</h1>
          <p className="text-muted-foreground font-body mt-1">Inspect raw data pipeline: connections → sync → snapshots</p>
        </div>

        {/* Client Selector */}
        <div className="max-w-sm">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a client..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedClientId && (
          <Tabs defaultValue="connections" className="space-y-4">
            <TabsList>
              <TabsTrigger value="connections">Connections ({connections.length})</TabsTrigger>
              <TabsTrigger value="sync-logs">Sync Logs ({syncLogs.length})</TabsTrigger>
              <TabsTrigger value="snapshots">Snapshots ({snapshots.length})</TabsTrigger>
            </TabsList>

            {/* CONNECTIONS TAB */}
            <TabsContent value="connections" className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={fetchConnections} disabled={loading.connections}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading.connections ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>
              {connections.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No connections for this client.</p>
              ) : (
                connections.map(conn => (
                  <Card key={conn.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-body">
                          {PLATFORM_LABELS[conn.platform]}
                          <Badge variant={conn.is_connected ? 'default' : 'destructive'} className="ml-2">
                            {conn.is_connected ? 'Connected' : 'Disconnected'}
                          </Badge>
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">ID:</span> <code className="font-mono">{conn.id}</code></div>
                        <div><span className="text-muted-foreground">Account ID:</span> {conn.account_id ?? '—'}</div>
                        <div><span className="text-muted-foreground">Account Name:</span> {conn.account_name ?? '—'}</div>
                        <div><span className="text-muted-foreground">Last Sync:</span> {conn.last_sync_at ? new Date(conn.last_sync_at).toLocaleString() : '—'}</div>
                        <div><span className="text-muted-foreground">Sync Status:</span> {conn.last_sync_status ?? '—'}</div>
                        <div><span className="text-muted-foreground">Token Expires:</span> {conn.token_expires_at ? new Date(conn.token_expires_at).toLocaleString() : '—'}</div>
                        <div><span className="text-muted-foreground">Access Token:</span> <code className="font-mono">{maskToken(conn.access_token)}</code></div>
                        <div><span className="text-muted-foreground">Refresh Token:</span> <code className="font-mono">{maskToken(conn.refresh_token)}</code></div>
                      </div>
                      {conn.last_error && (
                        <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
                          <strong>Last Error:</strong> {conn.last_error}
                        </div>
                      )}
                      <JsonViewer data={conn.metadata} label="Metadata" />
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* SYNC LOGS TAB */}
            <TabsContent value="sync-logs" className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={fetchSyncLogs} disabled={loading.syncLogs}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading.syncLogs ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>
              {syncLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No sync logs for this client.</p>
              ) : (
                <div className="space-y-2">
                  {syncLogs.map(log => (
                    <Card key={log.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Badge variant={log.status === 'success' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}>
                              {log.status}
                            </Badge>
                            <span className="font-medium">{PLATFORM_LABELS[log.platform as PlatformType] ?? log.platform}</span>
                            <span className="text-muted-foreground">{log.report_month}/{log.report_year}</span>
                          </div>
                          <span className="text-muted-foreground">{new Date(log.started_at).toLocaleString()}</span>
                        </div>
                        {log.error_message && (
                          <p className="text-xs text-destructive mt-1">{log.error_message}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* SNAPSHOTS TAB */}
            <TabsContent value="snapshots" className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={fetchSnapshots} disabled={loading.snapshots}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading.snapshots ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>
              {snapshots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No snapshots for this client.</p>
              ) : (
                snapshots.map(snap => (
                  <Card key={snap.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-body">
                        {PLATFORM_LABELS[snap.platform as PlatformType] ?? snap.platform}
                        <span className="text-sm text-muted-foreground ml-2">{snap.report_month}/{snap.report_year}</span>
                        {snap.snapshot_locked && <Badge variant="secondary" className="ml-2">Locked</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <JsonViewer data={snap.metrics_data} label="metrics_data" />
                      <JsonViewer data={snap.top_content} label="top_content" />
                      <JsonViewer data={snap.raw_data} label="raw_data" />
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default DebugConsole;
