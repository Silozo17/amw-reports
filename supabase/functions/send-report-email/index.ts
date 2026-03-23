import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface SendRequest {
  report_id: string;
}

function buildEmailHtml(
  clientName: string,
  companyName: string,
  month: string,
  year: number,
  downloadUrl: string,
  summary: string | null
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4ede3;font-family:'Montserrat',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4ede3;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background-color:#241f21;padding:30px 40px;text-align:center;border-radius:12px 12px 0 0;">
    <span style="font-size:36px;font-weight:900;color:#b32fbf;letter-spacing:2px;">AMW</span>
    <span style="display:block;font-size:12px;color:#f4ede3;letter-spacing:6px;margin-top:4px;">M E D I A</span>
  </td></tr>

  <!-- Body -->
  <tr><td style="background-color:#ffffff;padding:40px;">
    <h1 style="font-size:22px;color:#241f21;margin:0 0 8px;">Monthly Marketing Report</h1>
    <p style="font-size:14px;color:#787878;margin:0 0 24px;">${month} ${year}</p>

    <p style="font-size:14px;color:#241f21;line-height:1.6;margin:0 0 16px;">
      Hi ${clientName},
    </p>
    <p style="font-size:14px;color:#241f21;line-height:1.6;margin:0 0 24px;">
      Your monthly marketing performance report for <strong>${companyName}</strong> is ready.
      ${summary ? "Here's a quick overview:" : "Click the button below to download your full report."}
    </p>

    ${
      summary
        ? `<div style="background-color:#f4ede3;border-left:4px solid #b32fbf;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="font-size:13px;color:#241f21;line-height:1.6;margin:0;">${summary}</p>
    </div>`
        : ""
    }

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr><td style="background-color:#b32fbf;border-radius:8px;text-align:center;">
        <a href="${downloadUrl}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
          Download Report (PDF)
        </a>
      </td></tr>
    </table>

    <p style="font-size:12px;color:#787878;line-height:1.5;margin:24px 0 0;text-align:center;">
      This link expires in 7 days. Contact your account manager if you need a new link.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background-color:#241f21;padding:24px 40px;text-align:center;border-radius:0 0 12px 12px;">
    <p style="font-size:12px;color:#787878;margin:0 0 4px;">Prepared by AMW Media</p>
    <p style="font-size:12px;color:#b32fbf;margin:0;">amwmedia.co.uk</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { report_id } = (await req.json()) as SendRequest;

    if (!report_id) {
      return new Response(
        JSON.stringify({ error: "Missing report_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch report with client
    const { data: report, error: reportErr } = await supabase
      .from("reports")
      .select("*")
      .eq("id", report_id)
      .single();

    if (reportErr || !report) {
      return new Response(
        JSON.stringify({ error: "Report not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!report.pdf_storage_path) {
      return new Response(
        JSON.stringify({ error: "Report PDF not generated yet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch client and recipients in parallel
    const [clientRes, recipientsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", report.client_id).single(),
      supabase.from("client_recipients").select("*").eq("client_id", report.client_id),
    ]);

    const client = clientRes.data;
    if (!client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipients = recipientsRes.data ?? [];
    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients configured for this client" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a signed URL for the PDF (7 days)
    const { data: signedUrlData } = await supabase.storage
      .from("reports")
      .createSignedUrl(report.pdf_storage_path, 60 * 60 * 24 * 7);

    if (!signedUrlData?.signedUrl) {
      return new Response(
        JSON.stringify({ error: "Failed to generate download link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const monthName = MONTH_NAMES[report.report_month] ?? "";
    const results: { email: string; status: string; error?: string }[] = [];

    // Send to each recipient
    for (const recipient of recipients) {
      const html = buildEmailHtml(
        recipient.name,
        client.company_name,
        monthName,
        report.report_year,
        signedUrlData.signedUrl,
        report.ai_executive_summary
      );

      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: `AMW Media <reports@amwmedia.co.uk>`,
            to: [recipient.email],
            subject: `${client.company_name} — ${monthName} ${report.report_year} Marketing Report`,
            html,
          }),
        });

        const resendData = await resendRes.json();

        if (!resendRes.ok) {
          const errMsg = resendData?.message ?? JSON.stringify(resendData);
          results.push({ email: recipient.email, status: "failed", error: errMsg });

          await supabase.from("email_logs").insert({
            client_id: client.id,
            report_id: report.id,
            recipient_email: recipient.email,
            status: "failed",
            error_message: errMsg,
          });
        } else {
          results.push({ email: recipient.email, status: "sent" });

          await supabase.from("email_logs").insert({
            client_id: client.id,
            report_id: report.id,
            recipient_email: recipient.email,
            status: "sent",
            sent_at: new Date().toISOString(),
          });
        }
      } catch (sendErr) {
        const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        results.push({ email: recipient.email, status: "failed", error: errMsg });

        await supabase.from("email_logs").insert({
          client_id: client.id,
          report_id: report.id,
          recipient_email: recipient.email,
          status: "failed",
          error_message: errMsg,
        });
      }
    }

    const allSent = results.every((r) => r.status === "sent");

    return new Response(
      JSON.stringify({
        success: allSent,
        message: allSent
          ? `Report emailed to ${results.length} recipient(s)`
          : `Sent to ${results.filter((r) => r.status === "sent").length}/${results.length} recipients`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Email send error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
