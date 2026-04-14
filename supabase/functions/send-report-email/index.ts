import { createClient } from "@supabase/supabase-js";

/* ═══════════════════════════════════════════════════════════
   SEND-REPORT-EMAIL — sends monthly reports via the
   centralised send-branded-email function. Fully white-labelled.
   ═══════════════════════════════════════════════════════════ */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface SendRequest {
  report_id: string;
  link_only?: boolean;
}

Deno.serve(async (req) => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "send-report-email", method: req.method, connection_id: null }));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { report_id, link_only = false } = (await req.json()) as SendRequest;

    if (!report_id) {
      return new Response(
        JSON.stringify({ error: "Missing report_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch report
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

    const results: { email: string; status: string; error?: string }[] = [];

    // Choose template based on link_only flag
    const templateName = link_only ? "report_link_only" : "report_delivery";

    // Send to each recipient via send-branded-email
    for (const recipient of recipients) {
      try {
        const { data: sendResult, error: sendError } = await supabase.functions.invoke(
          "send-branded-email",
          {
            body: {
              template_name: templateName,
              recipient_email: recipient.email,
              recipient_name: recipient.name,
              org_id: client.org_id,
              client_id: client.id,
              report_id: report.id,
              data: {
                company_name: client.company_name,
                report_month: report.report_month,
                report_year: report.report_year,
                download_url: signedUrlData.signedUrl,
                ai_executive_summary: report.ai_executive_summary,
              },
            },
          }
        );

        if (sendError) {
          const errMsg = sendError.message ?? String(sendError);
          results.push({ email: recipient.email, status: "failed", error: errMsg });
        } else {
          results.push({ email: recipient.email, status: "sent" });
        }
      } catch (sendErr) {
        const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        results.push({ email: recipient.email, status: "failed", error: errMsg });
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
