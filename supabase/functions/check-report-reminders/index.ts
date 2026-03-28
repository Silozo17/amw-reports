import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cron-only function — no CORS needed

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const results: Array<{ report_id: string; success: boolean; error?: string }> = [];

    // Find report_delivery emails sent 3-7 days ago
    const { data: deliveredEmails } = await supabase
      .from("email_logs")
      .select("report_id, recipient_email, org_id, client_id")
      .eq("email_type", "report_delivery")
      .eq("status", "sent")
      .lte("sent_at", threeDaysAgo)
      .gte("sent_at", sevenDaysAgo)
      .not("report_id", "is", null);

    if (!deliveredEmails || deliveredEmails.length === 0) {
      return new Response(
        JSON.stringify({ message: "No reports to remind about", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group by report_id to avoid duplicate reminders
    const reportGroups: Record<string, typeof deliveredEmails> = {};
    for (const email of deliveredEmails) {
      if (!email.report_id) continue;
      if (!reportGroups[email.report_id]) reportGroups[email.report_id] = [];
      reportGroups[email.report_id].push(email);
    }

    for (const [reportId, emails] of Object.entries(reportGroups)) {
      // Check if a reminder was already sent for this report
      const { data: existingReminder } = await supabase
        .from("email_logs")
        .select("id")
        .eq("report_id", reportId)
        .eq("email_type", "report_reminder")
        .limit(1)
        .maybeSingle();

      if (existingReminder) continue; // Already reminded

      // Get report details
      const { data: report } = await supabase
        .from("reports")
        .select("id, client_id, org_id, report_month, report_year, pdf_storage_path")
        .eq("id", reportId)
        .maybeSingle();

      if (!report || !report.pdf_storage_path) continue;

      // Get client name
      const { data: client } = await supabase
        .from("clients")
        .select("company_name")
        .eq("id", report.client_id)
        .maybeSingle();

      // Generate a fresh signed URL
      const { data: signedUrlData } = await supabase.storage
        .from("reports")
        .createSignedUrl(report.pdf_storage_path, 60 * 60 * 24 * 7);

      if (!signedUrlData?.signedUrl) continue;

      // Send reminder to each original recipient
      for (const email of emails) {
        try {
          await supabase.functions.invoke("send-branded-email", {
            body: {
              template_name: "report_reminder",
              recipient_email: email.recipient_email,
              org_id: report.org_id,
              client_id: report.client_id,
              report_id: reportId,
              data: {
                company_name: client?.company_name ?? "Your company",
                report_month: report.report_month,
                report_year: report.report_year,
                download_url: signedUrlData.signedUrl,
              },
            },
          });

          results.push({ report_id: reportId, success: true });
        } catch (e) {
          results.push({ report_id: reportId, success: false, error: String(e) });
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: `Sent ${results.filter(r => r.success).length} reminders`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-report-reminders error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
