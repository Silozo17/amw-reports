import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, RotateCw, Send, ExternalLink, Loader2, Filter } from 'lucide-react';
import { generateReport, downloadReport, getReportPreviewUrl, getCurrentReportPeriod, sendReportEmail } from '@/lib/reports';
import { toast } from 'sonner';
import { useOrg } from '@/contexts/OrgContext';

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

const STATUS_LABEL: Record<string, string> = {
  pending: 'QUEUED',
  running: 'GENERATING',
  success: 'SUCCESS',
  failed: 'FAILED',
  partial: 'PARTIAL',
};

interface ClientOption {
  id: string;
  company_name: string;
  reportCount: number;
}

const Reports = () => {
  const { orgId } = useOrg();
  const [reports, setReports] = useState<ReportWithClient[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [isGeneratingNew, setIsGeneratingNew] = useState(false);

  // Filters
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Generate form
  const [selectedClient, setSelectedClient] = useState<string>('');
  const { month: defaultMonth, year: defaultYear } = getCurrentReportPeriod();
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultMonth);
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);

  const fetchReports = async () => {
    if (!orgId) return;
    const [reportsRes, clientsRes, emailLogsRes] = await Promise.all([
      supabase
        .from('reports')
        .select('*, clients(company_name, full_name)')
        .eq('org_id', orgId)
        .order('report_year', { ascending: false })
        .order('report_month', { ascending: false }),
      supabase.from('clients').select('id, company_name').eq('is_active', true).eq('org_id', orgId).order('company_name'),
      supabase.from('email_logs').select('report_id, status, sent_at, error_message').eq('org_id', orgId).order('created_at', { ascending: false }),
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

    // Count reports per client
    const countMap = new Map<string, number>();
    for (const r of enrichedReports) {
      countMap.set(r.client_id, (countMap.get(r.client_id) ?? 0) + 1);
    }

    const clientsWithCounts = ((clientsRes.data ?? []) as { id: string; company_name: string }[]).map(c => ({
      ...c,
      reportCount: countMap.get(c.id) ?? 0,
    }));

    setReports(enrichedReports);
    setClients(clientsWithCounts);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [orgId]);

  // When filterClient changes, also set the generate form client
  useEffect(() => {
    if (filterClient !== 'all') {
      setSelectedClient(filterClient);
    }
  }, [filterClient]);

  const filteredReports = reports.filter(r => {
    if (filterClient !== 'all' && r.client_id !== filterClient) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  // Group by client when showing all
  const groupedReports = filterClient === 'all'
    ? filteredReports.reduce<Record<string, ReportWithClient[]>>((acc, r) => {
        const key = r.clients?.company_name ?? 'Unknown';
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
      }, {})
    : null;

  const handleRegenerate = async (report: ReportWithClient) => {
    setGeneratingIds(prev => new Set(prev).add(report.id));
    await generateReport(report.client_id, report.report_month, report.report_year);
    await fetchReports();
    setGeneratingIds(prev => { const next = new Set(prev); next.delete(report.id); return next; });
  };

  const handleDownload = async (report: ReportWithClient) => {
    if (!report.pdf_storage_path) { toast.error('No PDF available'); return; }
    const filename = `${report.clients?.company_name ?? 'report'}_${MONTH_NAMES[report.report_month]}_${report.report_year}.pdf`;
    await downloadReport(report.pdf_storage_path, filename);
  };

  const handlePreview = async (report: ReportWithClient) => {
    if (!report.pdf_storage_path) { toast.error('No PDF available'); return; }
    const url = await getReportPreviewUrl(report.pdf_storage_path);
    if (url) window.open(url, '_blank');
  };

  const handleSendEmail = async (report: ReportWithClient) => {
    setSendingIds(prev => new Set(prev).add(report.id));
    await sendReportEmail(report.id);
    await fetchReports();
    setSendingIds(prev => { const next = new Set(prev); next.delete(report.id); return next; });
  };

  const handleGenerateNew = async () => {
    if (!selectedClient) { toast.error('Select a client first'); return; }
    setIsGeneratingNew(true);
    await generateReport(selectedClient, selectedMonth, selectedYear);
    await fetchReports();
    setIsGeneratingNew(false);
  };

  const renderReportRow = (report: ReportWithClient, showClientName = true) => {
    const isRegenerating = generatingIds.has(report.id);
    return (
      <Card key={report.id}>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              {showClientName && (
                <p className="font-body font-semibold">{report.clients?.company_name ?? 'Unknown'}</p>
              )}
              <p className={`text-sm text-muted-foreground ${!showClientName ? 'font-semibold text-foreground' : ''}`}>
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
            <Button size="sm" variant="ghost" disabled={!report.pdf_storage_path} onClick={() => handlePreview(report)} title="Preview">
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" disabled={!report.pdf_storage_path} onClick={() => handleDownload(report)} title="Download">
              <Download className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" disabled={isRegenerating} onClick={() => handleRegenerate(report)} title="Regenerate">
              {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" disabled={!report.pdf_storage_path || sendingIds.has(report.id)} onClick={() => handleSendEmail(report)} title="Send email">
              {sendingIds.has(report.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display">Reports</h1>
            <p className="text-muted-foreground font-body mt-1">Monthly client reports</p>
          </div>
        </div>

        {/* Generate report bar */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-sm font-medium text-muted-foreground">Generate:</span>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name} {c.reportCount > 0 && `(${c.reportCount})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                  <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(yr => (
                  <SelectItem key={yr} value={String(yr)}>{yr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleGenerateNew} disabled={isGeneratingNew || !selectedClient} className="gap-2">
              {isGeneratingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {isGeneratingNew ? 'Generating...' : 'Generate Report'}
            </Button>
          </CardContent>
        </Card>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name} {c.reportCount > 0 && `(${c.reportCount})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="running">Running</SelectItem>
            </SelectContent>
          </Select>
          {(filterClient !== 'all' || filterStatus !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterClient('all'); setFilterStatus('all'); }}>
              Clear filters
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Reports list */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading reports...</div>
        ) : filteredReports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">
                {reports.length === 0 ? 'No reports generated yet' : 'No reports match your filters'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {reports.length === 0 ? 'Select a client above to generate your first report' : 'Try adjusting the filters'}
              </p>
            </CardContent>
          </Card>
        ) : groupedReports ? (
          // Grouped by client
          <div className="space-y-6">
            {Object.entries(groupedReports).map(([clientName, clientReports]) => (
              <div key={clientName} className="space-y-2">
                <h3 className="font-display text-lg flex items-center gap-2">
                  {clientName}
                  <Badge variant="outline" className="text-xs font-normal">{clientReports.length}</Badge>
                </h3>
                {clientReports.map(r => renderReportRow(r, false))}
              </div>
            ))}
          </div>
        ) : (
          // Single client - flat list
          <div className="space-y-3">
            {filteredReports.map(r => renderReportRow(r, false))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Reports;
