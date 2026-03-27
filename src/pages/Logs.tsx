import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollText, RefreshCw, FileText, Mail } from 'lucide-react';
import { PLATFORM_LABELS } from '@/types/database';
import { useOrg } from '@/hooks/useOrg';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  success: 'default',
  sent: 'default',
  pending: 'secondary',
  running: 'secondary',
  failed: 'destructive',
  partial: 'outline',
};

const Logs = () => {
  const { orgId } = useOrg();
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [reportLogs, setReportLogs] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    const fetch = async () => {
      const [s, r, e] = await Promise.all([
        supabase.from('sync_logs').select('*, clients(company_name)').eq('org_id', orgId).order('started_at', { ascending: false }).limit(50),
        supabase.from('report_logs').select('*, clients(company_name)').eq('org_id', orgId).order('created_at', { ascending: false }).limit(50),
        supabase.from('email_logs').select('*, clients(company_name)').eq('org_id', orgId).order('created_at', { ascending: false }).limit(50),
      ]);
      setSyncLogs(s.data ?? []);
      setReportLogs(r.data ?? []);
      setEmailLogs(e.data ?? []);
      setIsLoading(false);
    };
    fetch();
  }, [orgId]);

  const EmptyState = ({ icon: Icon, message }: { icon: any; message: string }) => (
    <div className="py-12 text-center">
      <Icon className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display">Activity Logs</h1>
          <p className="text-muted-foreground font-body mt-1">Sync, report, and email history</p>
        </div>

        <Tabs defaultValue="sync">
          <TabsList>
            <TabsTrigger value="sync">Sync Logs</TabsTrigger>
            <TabsTrigger value="reports">Report Logs</TabsTrigger>
            <TabsTrigger value="emails">Email Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="sync" className="mt-4 space-y-2">
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> :
              syncLogs.length === 0 ? <EmptyState icon={RefreshCw} message="No sync logs yet" /> :
                syncLogs.map(log => (
                  <Card key={log.id}>
                    <CardContent className="flex items-center justify-between p-3">
                      <div>
                        <p className="text-sm font-body font-medium">{log.clients?.company_name} — {PLATFORM_LABELS[log.platform as keyof typeof PLATFORM_LABELS]}</p>
                        <p className="text-xs text-muted-foreground">{new Date(log.started_at).toLocaleString()}</p>
                        {log.error_message && <p className="text-xs text-destructive mt-1">{log.error_message}</p>}
                      </div>
                      <Badge variant={STATUS_VARIANT[log.status] ?? 'secondary'}>{log.status}</Badge>
                    </CardContent>
                  </Card>
                ))
            }
          </TabsContent>

          <TabsContent value="reports" className="mt-4 space-y-2">
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> :
              reportLogs.length === 0 ? <EmptyState icon={FileText} message="No report logs yet" /> :
                reportLogs.map(log => (
                  <Card key={log.id}>
                    <CardContent className="flex items-center justify-between p-3">
                      <div>
                        <p className="text-sm font-body font-medium">{log.clients?.company_name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                        {log.error_message && <p className="text-xs text-destructive mt-1">{log.error_message}</p>}
                      </div>
                      <Badge variant={STATUS_VARIANT[log.status] ?? 'secondary'}>{log.status}</Badge>
                    </CardContent>
                  </Card>
                ))
            }
          </TabsContent>

          <TabsContent value="emails" className="mt-4 space-y-2">
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> :
              emailLogs.length === 0 ? <EmptyState icon={Mail} message="No email logs yet" /> :
                emailLogs.map(log => (
                  <Card key={log.id}>
                    <CardContent className="flex items-center justify-between p-3">
                      <div>
                        <p className="text-sm font-body font-medium">{log.clients?.company_name} → {log.recipient_email}</p>
                        <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                        {log.error_message && <p className="text-xs text-destructive mt-1">{log.error_message}</p>}
                      </div>
                      <Badge variant={STATUS_VARIANT[log.status] ?? 'secondary'}>{log.status}</Badge>
                    </CardContent>
                  </Card>
                ))
            }
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Logs;
