import { supabase } from '@/integrations/supabase/client';
import type { EmailTemplateType } from '@/types/database';

interface SendBrandedEmailParams {
  templateName: EmailTemplateType;
  recipientEmail: string;
  recipientName?: string;
  orgId: string;
  data?: Record<string, unknown>;
  clientId?: string;
  reportId?: string;
}

/**
 * Sends a branded email via the centralised send-branded-email edge function.
 * All 26 templates are available through this single entry point.
 */
export const sendBrandedEmail = async ({
  templateName,
  recipientEmail,
  recipientName,
  orgId,
  data = {},
  clientId,
  reportId,
}: SendBrandedEmailParams) => {
  const { data: result, error } = await supabase.functions.invoke('send-branded-email', {
    body: {
      template_name: templateName,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      org_id: orgId,
      data,
      client_id: clientId,
      report_id: reportId,
    },
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  if (result?.error) {
    throw new Error(result.error);
  }

  return result;
};
