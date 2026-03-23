import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import StatusCard from '@/components/dashboard/StatusCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  FileText,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Mail,
  Plug,
  Clock,
} from 'lucide-react';

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

  useEffect(() => {
    const fetchStats = async () => {
      const [clientsRes, reportsRes, syncsRes, emailsRes, connectionsRes] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('reports').select('id, status', { count: 'exact' }),
        supabase.from('sync_logs').select('id', { count: 'exact' }).eq('status', 'failed'),
        supabase.from('email_logs').select('id', { count: 'exact' }).eq('status', 'failed'),
        supabase.from('platform_connections').select('id', { count: 'exact' }).eq('is_connected', false),
      ]);

      setStats({
        activeClients: clientsRes.count ?? 0,
        totalReports: reportsRes.count ?? 0,
        failedSyncs: syncsRes.count ?? 0,
        pendingReports: 0,
        failedEmails: emailsRes.count ?? 0,
        disconnected: connectionsRes.count ?? 0,
      });
    };

    fetchStats();
  }, []);

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

        <div className="grid gap-6 lg:grid-cols-2">
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
    </AppLayout>
  );
};

export default Dashboard;
