import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download, RotateCw, Send } from 'lucide-react';

interface ReportWithClient {
  id: string;
  report_month: number;
  report_year: number;
  status: string;
  pdf_storage_path: string | null;
  generated_at: string | null;
  client_id: string;
  clients: { company_name: string; full_name: string } | null;
}

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  success: 'default',
  pending: 'secondary',
  running: 'secondary',
  failed: 'destructive',
  partial: 'outline',
};

const Reports = () => {
  const [reports, setReports] = useState<ReportWithClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      const { data } = await supabase
        .from('reports')
        .select('*, clients(company_name, full_name)')
        .order('report_year', { ascending: false })
        .order('report_month', { ascending: false });
      setReports((data as ReportWithClient[]) ?? []);
      setIsLoading(false);
    };
    fetchReports();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display">Reports</h1>
          <p className="text-muted-foreground font-body mt-1">Monthly client reports</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading reports...</div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">No reports generated yet</p>
              <p className="text-xs text-muted-foreground mt-1">Reports are auto-generated on the 6th of each month</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map(report => (
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
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={STATUS_VARIANT[report.status] ?? 'secondary'}>{report.status}</Badge>
                    <Button size="sm" variant="ghost" disabled={!report.pdf_storage_path}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <RotateCw className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Reports;
