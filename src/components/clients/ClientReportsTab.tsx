import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, RotateCw, Send, ExternalLink, Loader2 } from 'lucide-react';
import { generateReport, downloadReport, getReportPreviewUrl, sendReportEmail } from '@/lib/reports';
import { toast } from 'sonner';

interface ReportRow {
  id: string;
  report_month: number;
  report_year: number;
  status: string;
  pdf_storage_path: string | null;
  generated_at: string | null;
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

interface Props {
  clientId: string;
  clientName: string;
  orgId: string;
  reportMonth: number | null;
  reportYear: number | null;
  setReportMonth: (m: number) => void;
  setReportYear: (y: number) => void;
}

const ClientReportsTab = ({ clientId, clientName, orgId, reportMonth, reportYear, setReportMonth, setReportYear }: Props) => {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [isGeneratingNew, setIsGeneratingNew] = useState(false);

  const fetchReports = async () => {
    const [reportsRes, emailLogsRes] = await Promise.all([
      supabase
        .from('reports')
        .select('id, report_month, report_year, status, pdf_storage_path, generated_at')
        .eq('client_id', clientId)
        .order('report_year', { ascending: false })
        .order('report_month', { ascending: false }),
      supabase
        .from('email_logs')
        .select('report_id, status, sent_at, error_message')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false }),
    ]);

    const emailMap = new Map<string, { status: string; sent_at: string | null; error_message: string | null }>();
    for (const log of emailLogsRes.data ?? []) {
      if (log.report_id && !emailMap.has(log.report_id)) {
        emailMap.set(log.report_id, log);
      }
    }

    const enriched = (reportsRes.data ?? []).map(r => {
      const emailLog = emailMap.get(r.id);
      return {
        ...r,
        emailStatus: emailLog?.status,
        emailSentAt: emailLog?.sent_at ?? undefined,
        emailError: emailLog?.error_message ?? undefined,
      };
    });

    setReports(enriched);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [clientId]);

  const handleGenerateNew = async () => {
    if (!reportMonth || !reportYear) {
      toast.error('Select a month and year');
      return;
    }
    setIsGeneratingNew(true);
    await generateReport(clientId, reportMonth, reportYear);
    await fetchReports();
    setIsGeneratingNew(false);
  };

  const handleRegenerate = async (report: ReportRow) => {
    setGeneratingIds(prev => new Set(prev).add(report.id));
    await generateReport(clientId, report.report_month, report.report_year);
    await fetchReports();
    setGeneratingIds(prev => { const n = new Set(prev); n.delete(report.id); return n; });
  };

  const handleDownload = async (report: ReportRow) => {
    if (!report.pdf_storage_path) { toast.error('No PDF available'); return; }
    const filename = `${clientName}_${MONTH_NAMES[report.report_month]}_${report.report_year}.pdf`;
    await downloadReport(report.pdf_storage_path, filename);
  };

  const handlePreview = async (report: ReportRow) => {
    if (!report.pdf_storage_path) { toast.error('No PDF available'); return; }
    const url = await getReportPreviewUrl(report.pdf_storage_path);
    if (url) window.open(url, '_blank');
  };

  const handleSendEmail = async (report: ReportRow) => {
    setSendingIds(prev => new Set(prev).add(report.id));
    await sendReportEmail(report.id);
    await fetchReports();
    setSendingIds(prev => { const n = new Set(prev); n.delete(report.id); return n; });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">Reports</h3>
        <div className="flex items-center gap-2">
          <Select value={reportMonth?.toString() ?? ''} onValueChange={v => setReportMonth(Number(v))}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={reportYear?.toString() ?? ''} onValueChange={v => setReportYear(Number(v))}>
            <SelectTrigger className="w-20 h-8 text-xs"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>
              {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(yr => (
                <SelectItem key={yr} value={String(yr)}>{yr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-2" onClick={handleGenerateNew} disabled={isGeneratingNew || !reportMonth || !reportYear}>
            {isGeneratingNew ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Generate
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading reports...</div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">No reports generated for this client yet</p>
            <p className="text-xs text-muted-foreground mt-1">Select a month above to generate your first report</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map(report => {
            const isRegenerating = generatingIds.has(report.id);
            return (
              <Card key={report.id}>
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-body font-semibold text-sm">
                        {MONTH_NAMES[report.report_month]} {report.report_year}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {report.generated_at && `Generated ${new Date(report.generated_at).toLocaleDateString()}`}
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
                  <div className="flex items-center gap-1.5">
                    <Badge variant={STATUS_VARIANT[report.status] ?? 'secondary'} className="text-xs">{report.status}</Badge>
                    <Button size="sm" variant="ghost" disabled={!report.pdf_storage_path} onClick={() => handlePreview(report)} title="Preview">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!report.pdf_storage_path} onClick={() => handleDownload(report)} title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={isRegenerating} onClick={() => handleRegenerate(report)} title="Regenerate">
                      {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!report.pdf_storage_path || sendingIds.has(report.id)} onClick={() => handleSendEmail(report)} title="Send email">
                      {sendingIds.has(report.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClientReportsTab;
