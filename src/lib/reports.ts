import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sendBrandedEmail } from '@/lib/sendBrandedEmail';

interface GenerateReportOptions {
  clientId: string;
  month: number;
  year: number;
  dateFrom?: string; // ISO date e.g. "2026-01-01"
  dateTo?: string;   // ISO date e.g. "2026-03-15"
}

export const generateReport = async (
  clientId: string,
  month: number,
  year: number,
  dateRange?: { dateFrom: string; dateTo: string }
) => {
  // Insert a pending report record immediately so the UI can show it
  const { data: clientData } = await supabase
    .from('clients')
    .select('org_id')
    .eq('id', clientId)
    .single();

  if (clientData?.org_id) {
    const reportRow: Record<string, unknown> = {
      client_id: clientId,
      report_month: month,
      report_year: year,
      org_id: clientData.org_id,
      status: 'pending' as const,
    };

    if (dateRange) {
      reportRow.date_from = dateRange.dateFrom;
      reportRow.date_to = dateRange.dateTo;
    }

    // For custom range reports, we can't use the monthly unique constraint
    if (dateRange) {
      // Check if a report with this exact date range already exists
      const { data: existing } = await supabase
        .from('reports')
        .select('id')
        .eq('client_id', clientId)
        .eq('date_from', dateRange.dateFrom)
        .eq('date_to', dateRange.dateTo)
        .maybeSingle();

      if (existing) {
        await supabase.from('reports').update({ status: 'pending' as const }).eq('id', existing.id);
      } else {
        await supabase.from('reports').insert({
          client_id: clientId,
          report_month: month,
          report_year: year,
          org_id: clientData.org_id,
          status: 'pending' as const,
          date_from: dateRange.dateFrom,
          date_to: dateRange.dateTo,
        });
      }
    } else {
      await supabase.from('reports').upsert(
        reportRow as {
          client_id: string;
          report_month: number;
          report_year: number;
          org_id: string;
          status: 'pending';
        },
        { onConflict: 'client_id,report_month,report_year', ignoreDuplicates: false }
      );
    }
  }

  // Invoke the edge function
  const body: Record<string, unknown> = { client_id: clientId, report_month: month, report_year: year };
  if (dateRange) {
    body.date_from = dateRange.dateFrom;
    body.date_to = dateRange.dateTo;
  }

  const { data, error } = await supabase.functions.invoke('generate-report', { body });

  if (error) {
    toast.error(`Report generation failed: ${error.message}`);
    notifyReportFailure(clientId, month, year, error.message);
    return null;
  }

  if (data?.error) {
    toast.error(`Report error: ${data.error}`);
    notifyReportFailure(clientId, month, year, data.error);
    return null;
  }

  toast.success(data.message ?? 'Report generated successfully');
  return data;
};

/** Fire-and-forget email notification when report generation fails */
const notifyReportFailure = async (clientId: string, month: number, year: number, errorMessage: string) => {
  try {
    // Get client + org info for the email
    const { data: client } = await supabase
      .from('clients')
      .select('company_name, org_id')
      .eq('id', clientId)
      .single();

    if (!client) return;

    sendBrandedEmail({
      templateName: 'report_generation_failed',
      recipientEmail: '', // edge function resolves org owner email
      orgId: client.org_id,
      clientId,
      data: {
        client_name: client.company_name,
        report_month: month,
        report_year: year,
        error_message: errorMessage,
      },
    }).catch(err => console.error('Failed to send report failure email:', err));
  } catch (err) {
    console.error('Failed to notify report failure:', err);
  }
};

export const downloadReport = async (pdfPath: string, filename: string) => {
  const { data, error } = await supabase.storage.from('reports').download(pdfPath);
  if (error || !data) {
    toast.error('Failed to download report');
    return;
  }

  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const getReportPreviewUrl = async (pdfPath: string): Promise<string | null> => {
  const { data } = await supabase.storage.from('reports').createSignedUrl(pdfPath, 3600);
  return data?.signedUrl ?? null;
};

export const sendReportEmail = async (reportId: string) => {
  const { data, error } = await supabase.functions.invoke('send-report-email', {
    body: { report_id: reportId },
  });

  if (error) {
    toast.error(`Failed to send email: ${error.message}`);
    return null;
  }

  if (data?.error) {
    toast.error(`Email error: ${data.error}`);
    return null;
  }

  toast.success(data.message ?? 'Report emailed successfully');
  return data;
};

export const getCurrentReportPeriod = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return { month, year };
};
