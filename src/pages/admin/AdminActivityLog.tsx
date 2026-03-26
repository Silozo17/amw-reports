import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText, AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-green-500' },
  failed: { icon: AlertCircle, className: 'text-destructive' },
  running: { icon: Loader2, className: 'text-blue-500 animate-spin' },
  pending: { icon: Clock, className: 'text-muted-foreground' },
  partial: { icon: AlertCircle, className: 'text-yellow-500' },
};

const AdminActivityLog = () => {
  const { data: syncLogs = [], isLoading: syncLoading } = useQuery({
    queryKey: ['admin-sync-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sync_logs')
        .select('*, clients!sync_logs_client_id_fkey(company_name, org_id), organisations:clients!sync_logs_client_id_fkey(org_id)')
        .order('started_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: reportLogs = [], isLoading: reportLoading } = useQuery({
    queryKey: ['admin-report-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('report_logs')
        .select('*, clients!report_logs_client_id_fkey(company_name)')
        .order('created_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: orgs = [] } = useQuery({
    queryKey: ['admin-orgs-map'],
    queryFn: async () => {
      const { data } = await supabase.from('organisations').select('id, name');
      return data ?? [];
    },
  });

  const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
  const isLoading = syncLoading || reportLoading;

  const allActivity = [
    ...syncLogs.map((l: any) => ({
      type: 'sync' as const,
      timestamp: l.started_at,
      status: l.status,
      platform: l.platform,
      clientName: l.clients?.company_name ?? 'Unknown',
      orgName: orgMap[l.org_id] ?? 'Unknown',
      error: l.error_message,
    })),
    ...reportLogs.map((l: any) => ({
      type: 'report' as const,
      timestamp: l.created_at,
      status: l.status,
      platform: null,
      clientName: l.clients?.company_name ?? 'Unknown',
      orgName: orgMap[l.org_id] ?? 'Unknown',
      error: l.error_message,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 100);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display">Activity Log</h1>
          <p className="text-muted-foreground font-body mt-1">Platform-wide sync and report activity</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-muted-foreground text-sm py-8 text-center">Loading activity...</div>
            ) : allActivity.length === 0 ? (
              <div className="text-muted-foreground text-sm py-8 text-center">No activity yet</div>
            ) : (
              <div className="space-y-3">
                {allActivity.map((item, i) => {
                  const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
                  const Icon = config.icon;
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.className}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.type === 'sync' ? 'default' : 'secondary'} className="text-[10px]">
                            {item.type === 'sync' ? 'Sync' : 'Report'}
                          </Badge>
                          {item.platform && (
                            <span className="text-xs text-muted-foreground font-mono">{item.platform.replace(/_/g, ' ')}</span>
                          )}
                          <Badge variant="outline" className="text-[10px]">{item.status}</Badge>
                        </div>
                        <p className="text-sm font-body mt-1">
                          <span className="font-medium">{item.clientName}</span>
                          <span className="text-muted-foreground"> · {item.orgName}</span>
                        </p>
                        {item.error && (
                          <p className="text-xs text-destructive mt-1 truncate">{item.error}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(item.timestamp), 'dd MMM HH:mm')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminActivityLog;
