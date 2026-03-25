import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, RotateCw, Send, ExternalLink, Loader2 } from 'lucide-react';
import { generateReport, downloadReport, getReportPreviewUrl, getCurrentReportPeriod, sendReportEmail } from '@/lib/reports';
import { toast } from 'sonner';

interface ReportWithClient {
  id: string;
  report_month: number;
  report_year: number;
  status: string;
  pdf_storage_path: string | null;
  generated_at: string | null;
  client_id: string;
  clients: { company_name: string; full_name: string } | null;
  emailStatus?: string;
  emailSentAt?: string;
  emailError?: string;
}

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  success: 'default',
  pending: 'secondary',
  running: 'secondary',
  failed: 'destructive',
  partial: 'outline',
};

interface ClientOption {
  id: string;
  company_name: string;
}

const Reports = () => {
  const [reports, setReports] = useState<ReportWithClient[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [isGeneratingNew, setIsGeneratingNew] = useState(false);

  const fetchReports = async () => {
    const [reportsRes, clientsRes, emailLogsRes] = await Promise.all([
      supabase
        .from('reports')
        .select('*, clients(company_name, full_name)')
        .order('report_year', { ascending: false })
        .order('report_month', { ascending: false }),
      supabase.from('clients').select('id, company_name').eq('is_active', true).order('company_name'),
      supabase.from('email_logs').select('report_id, status, sent_at, error_message').order('created_at', { ascending: false }),
    ]);

    const emailMap = new Map<string, { status: string; sent_at: string | null; error_message: string | null }>();
    for (const log of emailLogsRes.data ?? []) {
      if (log.report_id && !emailMap.has(log.report_id)) {
        emailMap.set(log.report_id, log);
      }
    }

    const enrichedReports = ((reportsRes.data ?? []) as ReportWithClient[]).map(r => {
      const emailLog = emailMap.get(r.id);
      return {
        ...r,
        emailStatus: emailLog?.status,
        emailSentAt: emailLog?.sent_at ?? undefined,
        emailError: emailLog?.error_message ?? undefined,
      };
    });

    setReports(enrichedReports);
    setClients((clientsRes.data as ClientOption[]) ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleRegenerate = async (report: ReportWithClient) => {
    setGeneratingIds(prev => new Set(prev).add(report.id));
    await generateReport(report.client_id, report.report_month, report.report_year);
    await fetchReports();
    setGeneratingIds(prev => {
      const next = new Set(prev);
      next.delete(report.id);
      return next;
    });
  };

  const handleDownload = async (report: ReportWithClient) => {
    if (!report.pdf_storage_path) {
      toast.error('No PDF available');
      return;
    }
    const filename = `${report.clients?.company_name ?? 'report'}_${MONTH_NAMES[report.report_month]}_${report.report_year}.pdf`;
    await downloadReport(report.pdf_storage_path, filename);
  };

  const handlePreview = async (report: ReportWithClient) => {
    if (!report.pdf_storage_path) {
      toast.error('No PDF available');
      return;
    }
    const url = await getReportPreviewUrl(report.pdf_storage_path);
    if (url) window.open(url, '_blank');
  };

  const handleGenerateNew = async () => {
    if (!selectedClient) {
      toast.error('Select a client first');
      return;
    }
    setIsGeneratingNew(true);
    const { month, year } = getCurrentReportPeriod();
    await generateReport(selectedClient, month, year);
    await fetchReports();
    setIsGeneratingNew(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display">Reports</h1>
            <p className="text-muted-foreground font-body mt-1">Monthly client reports</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleGenerateNew} disabled={isGeneratingNew || !selectedClient} className="gap-2">
              {isGeneratingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {isGeneratingNew ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading reports...</div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">No reports generated yet</p>
              <p className="text-xs text-muted-foreground mt-1">Select a client above to generate your first report</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map(report => {
              const isRegenerating = generatingIds.has(report.id);
              return (
                <Card key={report.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-body font-semibold">{report.clients?.company_name ?? 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          {MONTH_NAMES[report.report_month]} {report.report_year}
                          {report.generated_at && ` · Generated ${new Date(report.generated_at).toLocaleDateString()}`}
                        </p>
                        {report.emailStatus && (
                          <p className={`text-xs mt-0.5 ${report.emailStatus === 'sent' ? 'text-accent' : report.emailStatus === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {report.emailStatus === 'sent' ? `✓ Emailed${report.emailSentAt ? ` on ${new Date(report.emailSentAt).toLocaleDateString()}` : ''}` :
                             report.emailStatus === 'failed' ? `✗ Email failed${report.emailError ? `: ${report.emailError}` : ''}` :
                             '○ Email pending'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[report.status] ?? 'secondary'}>{report.status}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!report.pdf_storage_path}
                        onClick={() => handlePreview(report)}
                        title="Preview"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!report.pdf_storage_path}
                        onClick={() => handleDownload(report)}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isRegenerating}
                        onClick={() => handleRegenerate(report)}
                        title="Regenerate"
                      >
                        {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!report.pdf_storage_path || sendingIds.has(report.id)}
                        onClick={async () => {
                          setSendingIds(prev => new Set(prev).add(report.id));
                          await sendReportEmail(report.id);
                          await fetchReports();
                          setSendingIds(prev => {
                            const next = new Set(prev);
                            next.delete(report.id);
                            return next;
                          });
                        }}
                        title="Send email"
                      >
                        {sendingIds.has(report.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Reports;
