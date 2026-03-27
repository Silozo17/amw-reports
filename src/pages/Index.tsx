import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users, FileText, AlertTriangle, Plug, ArrowRight, RefreshCw,
  CheckCircle, XCircle, Mail, Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

interface ActivityItem {
  id: string;
  type: 'sync' | 'report' | 'email';
  label: string;
  status: string;
  created_at: string;
  clientName?: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeClients: 0,
    totalReports: 0,
    failedSyncs: 0,
    failedEmails: 0,
    disconnected: 0,
  });
  const [clientHealth, setClientHealth] = useState<ClientHealth[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Check org recovery + onboarding
  useEffect(() => {
    if (!user) return;
    const checkSetup = async () => {
      // 1. Check if user has an org — recover if missing
      const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!membership) {
        // Recovery: create org for existing users who slipped through
        const orgName =
          user.user_metadata?.company_name ||
          user.user_metadata?.full_name ||
          user.email ||
          'My Workspace';

        const { data: newOrg, error: orgError } = await supabase
          .from('organisations')
          .insert({
            name: orgName,
            slug: orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            created_by: user.id,
          })
          .select('id')
          .single();

        if (!orgError && newOrg) {
          await supabase.from('org_members').insert({
            org_id: newOrg.id,
            user_id: user.id,
            role: 'owner',
            accepted_at: new Date().toISOString(),
          });

          await supabase
            .from('profiles')
            .update({ org_id: newOrg.id })
            .eq('user_id', user.id);

          // Assign starter plan
          const { data: starterPlan } = await supabase
            .from('subscription_plans')
            .select('id')
            .eq('slug', 'starter')
            .single();

          if (starterPlan) {
            await supabase.from('org_subscriptions').insert({
              org_id: newOrg.id,
              plan_id: starterPlan.id,
              status: 'active',
            });
          }

          console.log('Recovered org for user', user.id);
        }
      }

      // 2. Check onboarding
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .single();
      if (profile && !profile.onboarding_completed) {
        navigate('/onboarding', { replace: true });
        return;
      }
      setOnboardingChecked(true);
    };
    checkSetup();
  }, [user, navigate]);

  useEffect(() => {
    if (!orgId) return;
    const fetchStats = async () => {
      const [clientsRes, reportsRes, syncsRes, emailsRes, connectionsRes, allClientsRes, allConnectionsRes, allSyncLogsRes, recentSyncsRes, recentReportsRes, recentEmailsRes] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact' }).eq('is_active', true).eq('org_id', orgId),
        supabase.from('reports').select('id, status', { count: 'exact' }).eq('org_id', orgId),
        supabase.from('sync_logs').select('id', { count: 'exact' }).eq('status', 'failed').eq('org_id', orgId),
        supabase.from('email_logs').select('id', { count: 'exact' }).eq('status', 'failed').eq('org_id', orgId),
        supabase.from('platform_connections').select('id, client_id, clients!inner(org_id)', { count: 'exact' }).eq('is_connected', false).eq('clients.org_id', orgId),
        supabase.from('clients').select('id, company_name, logo_url, is_active').eq('is_active', true).eq('org_id', orgId).order('company_name'),
        supabase.from('platform_connections').select('client_id, is_connected, last_sync_at, platform, clients!inner(org_id)').eq('clients.org_id', orgId),
        supabase.from('sync_logs').select('client_id, status').eq('status', 'failed').eq('org_id', orgId),
        supabase.from('sync_logs').select('id, client_id, platform, status, started_at').eq('org_id', orgId).order('started_at', { ascending: false }).limit(5),
        supabase.from('reports').select('id, client_id, status, created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(5),
        supabase.from('email_logs').select('id, client_id, status, created_at, recipient_email').eq('org_id', orgId).order('created_at', { ascending: false }).limit(5),
      ]);

      setStats({
        activeClients: clientsRes.count ?? 0,
        totalReports: reportsRes.count ?? 0,
        failedSyncs: syncsRes.count ?? 0,
        failedEmails: emailsRes.count ?? 0,
        disconnected: connectionsRes.count ?? 0,
      });

      // Build client health data
      const clients = (allClientsRes.data ?? []) as Array<{ id: string; company_name: string; logo_url: string | null; is_active: boolean }>;
      const allConns = (allConnectionsRes.data ?? []) as Array<{ client_id: string; is_connected: boolean; last_sync_at: string | null; platform: string }>;
      const failedLogs = (allSyncLogsRes.data ?? []) as Array<{ client_id: string; status: string }>;

      const clientMap = new Map(clients.map(c => [c.id, c.company_name]));

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

      // Build recent activity
      const items: ActivityItem[] = [];
      for (const s of (recentSyncsRes.data ?? []) as Array<{ id: string; client_id: string; platform: string; status: string; started_at: string }>) {
        items.push({ id: s.id, type: 'sync', label: `${s.platform.replace(/_/g, ' ')} sync`, status: s.status, created_at: s.started_at, clientName: clientMap.get(s.client_id) });
      }
      for (const r of (recentReportsRes.data ?? []) as Array<{ id: string; client_id: string; status: string; created_at: string }>) {
        items.push({ id: r.id, type: 'report', label: 'Report generated', status: r.status, created_at: r.created_at, clientName: clientMap.get(r.client_id) });
      }
      for (const e of (recentEmailsRes.data ?? []) as Array<{ id: string; client_id: string; status: string; created_at: string; recipient_email: string }>) {
        items.push({ id: e.id, type: 'email', label: `Email to ${e.recipient_email}`, status: e.status, created_at: e.created_at, clientName: clientMap.get(e.client_id) });
      }
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setClientHealth(health);
      setActivity(items.slice(0, 8));
      setIsLoading(false);
    };

    fetchStats();
  }, [orgId]);

  const needsAttention = clientHealth.filter(c => c.failedSyncs > 0 || c.disconnected > 0);

  const getStatusIcon = (status: string) => {
    if (status === 'success') return <CheckCircle className="h-3.5 w-3.5 text-accent" />;
    if (status === 'failed') return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const getActivityIcon = (type: string) => {
    if (type === 'sync') return <RefreshCw className="h-3.5 w-3.5" />;
    if (type === 'report') return <FileText className="h-3.5 w-3.5" />;
    return <Mail className="h-3.5 w-3.5" />;
  };

  if (!onboardingChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-display text-primary">AMW</h1>
          <p className="text-sm text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display">Dashboard</h1>
          <p className="text-muted-foreground font-body mt-1">Overview of your reporting platform</p>
        </div>

        {/* Status Cards — Actionable */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary"
            onClick={() => navigate('/clients')}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-body">Active Clients</p>
                  <p className="text-3xl font-bold font-body mt-1 tabular-nums">{stats.activeClients}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-accent"
            onClick={() => navigate('/reports')}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-body">Reports</p>
                  <p className="text-3xl font-bold font-body mt-1 tabular-nums">{stats.totalReports}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${stats.failedSyncs > 0 ? 'border-l-destructive' : 'border-l-accent'}`}
            onClick={() => navigate('/logs')}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-body">Failed Syncs</p>
                  <p className="text-3xl font-bold font-body mt-1 tabular-nums">{stats.failedSyncs}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${stats.failedSyncs > 0 ? 'bg-destructive/10' : 'bg-accent/10'}`}>
                  <AlertTriangle className={`h-5 w-5 ${stats.failedSyncs > 0 ? 'text-destructive' : 'text-accent'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${stats.disconnected > 0 ? 'border-l-warning' : 'border-l-accent'}`}
            onClick={() => navigate('/connections')}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-body">Disconnected</p>
                  <p className="text-3xl font-bold font-body mt-1 tabular-nums">{stats.disconnected}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${stats.disconnected > 0 ? 'bg-warning/10' : 'bg-accent/10'}`}>
                  <Plug className={`h-5 w-5 ${stats.disconnected > 0 ? 'text-warning' : 'text-accent'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients Needing Attention */}
        {needsAttention.length > 0 && (
          <Card className="border-warning/30 bg-warning/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold font-body flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Needs Attention ({needsAttention.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {needsAttention.map(client => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/80 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <div className="flex items-center gap-3">
                    {client.logo_url ? (
                      <img src={client.logo_url} alt="" className="h-8 w-8 rounded-lg object-contain border bg-muted" />
                    ) : (
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold font-body">
                        {client.company_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium font-body">{client.company_name}</p>
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
          {/* Client Overview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold font-body">Client Overview</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/clients')} className="text-xs gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
              ) : clientHealth.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active clients</p>
              ) : (
                <div className="space-y-1">
                  {clientHealth.slice(0, 8).map(client => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/clients/${client.id}`)}
                    >
                      <div className="flex items-center gap-2.5">
                        {client.logo_url ? (
                          <img src={client.logo_url} alt="" className="h-7 w-7 rounded-lg object-contain border bg-muted" />
                        ) : (
                          <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold font-body">
                            {client.company_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium font-body">{client.company_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {client.platformCount} platform{client.platformCount !== 1 ? 's' : ''}
                            {client.lastSyncAt && ` · Synced ${new Date(client.lastSyncAt).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={client.failedSyncs > 0 ? 'destructive' : client.disconnected > 0 ? 'secondary' : 'default'}
                        className="text-[10px]"
                      >
                        {client.failedSyncs > 0 ? 'Issues' : client.disconnected > 0 ? 'Warning' : 'Healthy'}
                      </Badge>
                    </div>
                  ))}
                  {clientHealth.length > 8 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      +{clientHealth.length - 8} more
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold font-body">Recent Activity</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/logs')} className="text-xs gap-1">
                View Logs <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              ) : (
                <div className="space-y-1">
                  {activity.map(item => (
                    <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                        {getActivityIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium font-body truncate">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.clientName && `${item.clientName} · `}
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {getStatusIcon(item.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
