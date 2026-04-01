import { useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { FileText, Download, RotateCw, Send, ExternalLink, Loader2, CalendarIcon } from 'lucide-react';
import { generateReport, downloadReport, getReportPreviewUrl, sendReportEmail } from '@/lib/reports';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ReportRow {
  id: string;
  report_month: number;
  report_year: number;
  status: string;
  pdf_storage_path: string | null;
  generated_at: string | null;
  date_from: string | null;
  date_to: string | null;
  emailStatus?: string;
  emailSentAt?: string;
  emailError?: string;
}

type ReportMode = 'monthly' | 'custom';

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

interface Props {
  clientId: string;
  clientName: string;
  orgId: string;
  reportMonth: number | null;
  reportYear: number | null;
  setReportMonth: (m: number) => void;
  setReportYear: (y: number) => void;
}

const formatReportLabel = (report: ReportRow): string => {
  if (report.date_from && report.date_to) {
    const from = new Date(report.date_from + 'T00:00:00');
    const to = new Date(report.date_to + 'T00:00:00');
    return `${format(from, 'd MMM yyyy')} – ${format(to, 'd MMM yyyy')}`;
  }
  return `${MONTH_NAMES[report.report_month]} ${report.report_year}`;
};

const ClientReportsTab = ({ clientId, clientName, orgId, reportMonth, reportYear, setReportMonth, setReportYear }: Props) => {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [isGeneratingNew, setIsGeneratingNew] = useState(false);
  const [mode, setMode] = useState<ReportMode>('monthly');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReports = async () => {
    const [reportsRes, emailLogsRes] = await Promise.all([
      supabase
        .from('reports')
        .select('id, report_month, report_year, status, pdf_storage_path, generated_at, date_from, date_to')
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

  // Poll while any report is pending or running
  useEffect(() => {
    const hasActive = reports.some(r => r.status === 'pending' || r.status === 'running');
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(fetchReports, 3000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [reports]);

  const handleGenerateNew = async () => {
    if (mode === 'custom') {
      if (!dateFrom || !dateTo) {
        toast.error('Select both start and end dates');
        return;
      }
      if (dateFrom >= dateTo) {
        toast.error('Start date must be before end date');
        return;
      }
      setIsGeneratingNew(true);
      const endMonth = dateTo.getMonth() + 1;
      const endYear = dateTo.getFullYear();
      await generateReport(clientId, endMonth, endYear, {
        dateFrom: format(dateFrom, 'yyyy-MM-dd'),
        dateTo: format(dateTo, 'yyyy-MM-dd'),
      });
      await fetchReports();
      setIsGeneratingNew(false);
    } else {
      if (!reportMonth || !reportYear) {
        toast.error('Select a month and year');
        return;
      }
      setIsGeneratingNew(true);
      await generateReport(clientId, reportMonth, reportYear);
      await fetchReports();
      setIsGeneratingNew(false);
    }
  };

  const handleRegenerate = async (report: ReportRow) => {
    setGeneratingIds(prev => new Set(prev).add(report.id));
    const dateRange = report.date_from && report.date_to
      ? { dateFrom: report.date_from, dateTo: report.date_to }
      : undefined;
    await generateReport(clientId, report.report_month, report.report_year, dateRange);
    await fetchReports();
    setGeneratingIds(prev => { const n = new Set(prev); n.delete(report.id); return n; });
  };

  const handleDownload = async (report: ReportRow) => {
    if (!report.pdf_storage_path) { toast.error('No PDF available'); return; }
    const label = report.date_from && report.date_to
      ? `${report.date_from}_${report.date_to}`
      : `${MONTH_NAMES[report.report_month]}_${report.report_year}`;
    const filename = `${clientName}_${label}.pdf`;
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

  const isGenerateDisabled = mode === 'monthly'
    ? isGeneratingNew || !reportMonth || !reportYear
    : isGeneratingNew || !dateFrom || !dateTo;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg">Reports</h3>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 w-fit">
          <Button
            size="sm"
            variant={mode === 'monthly' ? 'default' : 'ghost'}
            className="h-7 text-xs px-3"
            onClick={() => setMode('monthly')}
          >
            Monthly
          </Button>
          <Button
            size="sm"
            variant={mode === 'custom' ? 'default' : 'ghost'}
            className="h-7 text-xs px-3"
            onClick={() => setMode('custom')}
          >
            Custom Range
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'monthly' ? (
            <>
              <Select value={reportMonth?.toString() ?? ''} onValueChange={v => setReportMonth(Number(v))}>
                <SelectTrigger className="w-24 sm:w-28 h-8 text-xs"><SelectValue placeholder="Month" /></SelectTrigger>
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
            </>
          ) : (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-8 text-xs w-32 justify-start", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {dateFrom ? format(dateFrom, 'd MMM yyyy') : 'Start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-8 text-xs w-32 justify-start", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {dateTo ? format(dateTo, 'd MMM yyyy') : 'End date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    disabled={(date) => date > new Date() || (dateFrom ? date < dateFrom : false)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </>
          )}
          <Button size="sm" className="gap-2" onClick={handleGenerateNew} disabled={isGenerateDisabled}>
            {isGeneratingNew ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Generate
          </Button>
        </div>

        {mode === 'custom' && (
          <p className="text-xs text-muted-foreground">
            Custom range reports aggregate full calendar months that fall within the selected dates.
          </p>
        )}
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
            const isActive = report.status === 'pending' || report.status === 'running';
            const isCustomRange = !!(report.date_from && report.date_to);
            return (
              <Card key={report.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        {isActive ? (
                          <Loader2 className="h-4 w-4 text-primary animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-body font-semibold text-sm">
                          {formatReportLabel(report)}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            {report.generated_at && `${new Date(report.generated_at).toLocaleDateString()}`}
                            {isActive && 'Generating...'}
                          </p>
                          {isCustomRange && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Custom</Badge>
                          )}
                        </div>
                        {report.emailStatus && (
                          <p className={`text-xs mt-0.5 ${report.emailStatus === 'sent' ? 'text-accent' : report.emailStatus === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {report.emailStatus === 'sent' ? '✓ Emailed' :
                             report.emailStatus === 'failed' ? '✗ Failed' :
                             '○ Pending'}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={STATUS_VARIANT[report.status] ?? 'secondary'} className="text-xs shrink-0">
                      {isActive && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      {STATUS_LABEL[report.status] ?? report.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!report.pdf_storage_path || isActive} onClick={() => handlePreview(report)} aria-label="Preview">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!report.pdf_storage_path || isActive} onClick={() => handleDownload(report)} aria-label="Download">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={isRegenerating || isActive} onClick={() => handleRegenerate(report)} aria-label="Regenerate">
                      {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!report.pdf_storage_path || sendingIds.has(report.id) || isActive} onClick={() => handleSendEmail(report)} aria-label="Send email">
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
