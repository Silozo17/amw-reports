import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import StatusCard from '@/components/dashboard/StatusCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  FileText,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Mail,
  Plug,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';

interface ClientHealth {
  id: string;
  company_name: string;
  logo_url: string | null;
  is_active: boolean;
  failedSyncs: number;
  disconnected: number;
  lastSyncAt: string | null;
  platformCount: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeClients: 0,
    totalReports: 0,
    failedSyncs: 0,
    pendingReports: 0,
    failedEmails: 0,
    disconnected: 0,
  });
  const [clientHealth, setClientHealth] = useState<ClientHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [clientsRes, reportsRes, syncsRes, emailsRes, connectionsRes, allClientsRes, allConnectionsRes, allSyncLogsRes] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('reports').select('id, status', { count: 'exact' }),
        supabase.from('sync_logs').select('id', { count: 'exact' }).eq('status', 'failed'),
        supabase.from('email_logs').select('id', { count: 'exact' }).eq('status', 'failed'),
        supabase.from('platform_connections').select('id', { count: 'exact' }).eq('is_connected', false),
        supabase.from('clients').select('id, company_name, logo_url, is_active').eq('is_active', true).order('company_name'),
        supabase.from('platform_connections').select('client_id, is_connected, last_sync_at, platform'),
        supabase.from('sync_logs').select('client_id, status').eq('status', 'failed'),
      ]);

      setStats({
        activeClients: clientsRes.count ?? 0,
        totalReports: reportsRes.count ?? 0,
        failedSyncs: syncsRes.count ?? 0,
        pendingReports: 0,
        failedEmails: emailsRes.count ?? 0,
        disconnected: connectionsRes.count ?? 0,
      });

      // Build client health data
      const clients = (allClientsRes.data ?? []) as Array<{ id: string; company_name: string; logo_url: string | null; is_active: boolean }>;
      const allConns = (allConnectionsRes.data ?? []) as Array<{ client_id: string; is_connected: boolean; last_sync_at: string | null; platform: string }>;
      const failedLogs = (allSyncLogsRes.data ?? []) as Array<{ client_id: string; status: string }>;

      const health: ClientHealth[] = clients.map(client => {
        const clientConns = allConns.filter(c => c.client_id === client.id);
        const clientFailed = failedLogs.filter(l => l.client_id === client.id).length;
        const clientDisconnected = clientConns.filter(c => !c.is_connected).length;
        const lastSync = clientConns
          .filter(c => c.last_sync_at)
          .map(c => c.last_sync_at!)
          .sort()
          .pop() ?? null;

        return {
          ...client,
          failedSyncs: clientFailed,
          disconnected: clientDisconnected,
          lastSyncAt: lastSync,
          platformCount: clientConns.filter(c => c.is_connected).length,
        };
      });

      setClientHealth(health);
      setIsLoading(false);
    };

    fetchStats();
  }, []);

  const needsAttention = clientHealth.filter(c => c.failedSyncs > 0 || c.disconnected > 0);

  const getHealthBadge = (client: ClientHealth) => {
    if (client.failedSyncs > 0) return <Badge variant="destructive" className="text-[10px]">Issues</Badge>;
    if (client.disconnected > 0) return <Badge variant="secondary" className="text-[10px]">Warning</Badge>;
    return <Badge variant="default" className="text-[10px]">Healthy</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display">Dashboard</h1>
          <p className="text-muted-foreground font-body mt-1">Overview of your reporting platform</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatusCard
            title="Active Clients"
            value={stats.activeClients}
            icon={<Users className="h-5 w-5" />}
            variant="default"
          />
          <StatusCard
            title="Reports Generated"
            value={stats.totalReports}
            icon={<FileText className="h-5 w-5" />}
            variant="success"
          />
          <StatusCard
            title="Failed Syncs"
            value={stats.failedSyncs}
            icon={<AlertTriangle className="h-5 w-5" />}
            variant={stats.failedSyncs > 0 ? 'destructive' : 'success'}
          />
          <StatusCard
            title="Failed Emails"
            value={stats.failedEmails}
            icon={<Mail className="h-5 w-5" />}
            variant={stats.failedEmails > 0 ? 'warning' : 'success'}
          />
          <StatusCard
            title="Disconnected"
            value={stats.disconnected}
            icon={<Plug className="h-5 w-5" />}
            variant={stats.disconnected > 0 ? 'warning' : 'success'}
          />
          <StatusCard
            title="Next Sync"
            value="5th"
            icon={<Clock className="h-5 w-5" />}
            description="Auto-sync on 5th of each month"
          />
        </div>

        {/* Clients Needing Attention */}
        {needsAttention.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Clients Needing Attention ({needsAttention.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {needsAttention.map(client => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 rounded-md bg-background/80 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <div className="flex items-center gap-3">
                    {client.logo_url ? (
                      <img src={client.logo_url} alt="" className="h-8 w-8 rounded object-contain border bg-muted" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs font-bold">
                        {client.company_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{client.company_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.failedSyncs > 0 && `${client.failedSyncs} failed sync(s)`}
                        {client.failedSyncs > 0 && client.disconnected > 0 && ' · '}
                        {client.disconnected > 0 && `${client.disconnected} disconnected`}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* All Clients Overview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-display">Client Overview</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/clients')}>View All</Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
              ) : clientHealth.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active clients</p>
              ) : (
                <div className="space-y-2">
                  {clientHealth.slice(0, 8).map(client => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-2.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/clients/${client.id}`)}
                    >
                      <div className="flex items-center gap-2.5">
                        {client.logo_url ? (
                          <img src={client.logo_url} alt="" className="h-7 w-7 rounded object-contain border bg-muted" />
                        ) : (
                          <div className="h-7 w-7 rounded bg-muted flex items-center justify-center text-[10px] font-bold">
                            {client.company_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{client.company_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {client.platformCount} platform{client.platformCount !== 1 ? 's' : ''}
                            {client.lastSyncAt && ` · Synced ${new Date(client.lastSyncAt).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      {getHealthBadge(client)}
                    </div>
                  ))}
                  {clientHealth.length > 8 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      +{clientHealth.length - 8} more client{clientHealth.length - 8 !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions + Monthly Workflow */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/clients')}>
                  <Users className="h-4 w-4" />
                  Manage Clients
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/reports')}>
                  <FileText className="h-4 w-4" />
                  View Reports
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/connections')}>
                  <Plug className="h-4 w-4" />
                  Platform Connections
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/logs')}>
                  <RefreshCw className="h-4 w-4" />
                  Sync & Activity Logs
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display">Monthly Workflow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-body font-bold">1</div>
                  <div>
                    <p className="text-sm font-body font-medium">5th — Auto Sync</p>
                    <p className="text-xs text-muted-foreground">Data pulled from all connected platforms</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-body font-bold">2</div>
                  <div>
                    <p className="text-sm font-body font-medium">6th — Reports Generated</p>
                    <p className="text-xs text-muted-foreground">Branded PDFs with AI insights created</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-body font-bold">3</div>
                  <div>
                    <p className="text-sm font-body font-medium">6th 10:00 AM — Emailed</p>
                    <p className="text-xs text-muted-foreground">Reports sent to all client recipients</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
