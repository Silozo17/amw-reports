import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const generateReport = async (clientId: string, month: number, year: number) => {
  const { data, error } = await supabase.functions.invoke('generate-report', {
    body: { client_id: clientId, report_month: month, report_year: year },
  });

  if (error) {
    toast.error(`Report generation failed: ${error.message}`);
    return null;
  }

  if (data?.error) {
    toast.error(`Report error: ${data.error}`);
    return null;
  }

  toast.success(data.message ?? 'Report generated successfully');
  return data;
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

export const getCurrentReportPeriod = () => {
  const now = new Date();
  // If before the 5th, report for previous month
  const month = now.getDate() < 5
    ? (now.getMonth() === 0 ? 12 : now.getMonth())
    : now.getMonth() + 1;
  const year = now.getDate() < 5 && now.getMonth() === 0
    ? now.getFullYear() - 1
    : now.getFullYear();
  return { month, year };
};
