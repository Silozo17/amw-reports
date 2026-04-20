import { createClient } from "@supabase/supabase-js";

/* ═══════════════════════════════════════════════════════════
   SEND-BRANDED-EMAIL — centralised, white-labelled email sender
   26 templates across 7 categories, all using org branding.
   ═══════════════════════════════════════════════════════════ */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

// ─── Colour helpers ──────────────────────────────────────

function hslToHex(hsl: string | null, fallback = "#b32fbf"): string {
  if (!hsl) return fallback;
  const parts = hsl.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return fallback;
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const colour = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * colour)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function contrastText(hsl: string | null): string {
  if (!hsl) return "#ffffff";
  const parts = hsl.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return "#ffffff";
  const lightness = parseFloat(parts[2]);
  return lightness >= 55 ? "#241f21" : "#ffffff";
}

// ─── Org branding type ───────────────────────────────────

interface OrgBrand {
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  heading_font: string | null;
  body_font: string | null;
  primaryHex: string;
  primaryFg: string;
  secondaryHex: string;
  accentHex: string;
  darkBg: string;
  lightBg: string;
  mutedText: string;
}

function buildOrgBrand(org: Record<string, unknown> | null): OrgBrand {
  const name = (org?.name as string) ?? "AMW Media";
  const logo_url = (org?.logo_url as string) ?? null;
  const primary_color = (org?.primary_color as string) ?? null;
  const secondary_color = (org?.secondary_color as string) ?? null;
  const accent_color = (org?.accent_color as string) ?? null;
  const heading_font = (org?.heading_font as string) ?? null;
  const body_font = (org?.body_font as string) ?? null;

  return {
    name,
    logo_url,
    primary_color,
    secondary_color,
    accent_color,
    heading_font,
    body_font,
    primaryHex: hslToHex(primary_color, "#b32fbf"),
    primaryFg: contrastText(primary_color),
    secondaryHex: hslToHex(secondary_color, "#4a90d9"),
    accentHex: hslToHex(accent_color, "#50c878"),
    darkBg: "#241f21",
    lightBg: "#f4ede3",
    mutedText: "#787878",
  };
}

// ─── Shared HTML helpers ─────────────────────────────────

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildHeader(b: OrgBrand): string {
  const logoHtml = b.logo_url
    ? `<img src="${escapeHtml(b.logo_url)}" alt="${escapeHtml(b.name)}" style="max-height:48px;max-width:200px;margin-bottom:8px;" />`
    : `<span style="font-size:28px;font-weight:900;color:${b.primaryHex};letter-spacing:2px;font-family:${b.heading_font ?? "Arial"},sans-serif;">${escapeHtml(b.name)}</span>`;
  return `<tr><td style="background-color:${b.darkBg};padding:28px 40px;text-align:center;border-radius:12px 12px 0 0;">${logoHtml}</td></tr>`;
}

function buildFooter(b: OrgBrand): string {
  return `<tr><td style="background-color:${b.darkBg};padding:24px 40px;text-align:center;border-radius:0 0 12px 12px;">
    <p style="font-size:12px;color:${b.mutedText};margin:0 0 4px;">Sent by ${escapeHtml(b.name)}</p>
    <p style="font-size:11px;color:${b.mutedText};margin:0;">This email was sent to you because of your account activity.</p>
  </td></tr>`;
}

function buildButton(text: string, url: string, b: OrgBrand): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background-color:${b.primaryHex};border-radius:8px;text-align:center;">
      <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:14px 32px;color:${b.primaryFg};font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(text)}</a>
    </td></tr>
  </table>`;
}

function wrapEmail(b: OrgBrand, bodyContent: string): string {
  const fontFamily = `'${b.body_font ?? "Montserrat"}', Arial, sans-serif`;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${b.lightBg};font-family:${fontFamily};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${b.lightBg};padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
${buildHeader(b)}
<tr><td style="background-color:#ffffff;padding:40px;">
${bodyContent}
</td></tr>
${buildFooter(b)}
</table>
</td></tr>
</table>
</body>
</html>`;
}

function infoBox(text: string, b: OrgBrand): string {
  return `<div style="background-color:${b.lightBg};border-left:4px solid ${b.primaryHex};padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
    <p style="font-size:13px;color:#241f21;line-height:1.6;margin:0;">${text}</p>
  </div>`;
}

function heading(text: string): string {
  return `<h1 style="font-size:22px;color:#241f21;margin:0 0 8px;">${escapeHtml(text)}</h1>`;
}

function subtext(text: string): string {
  return `<p style="font-size:14px;color:#787878;margin:0 0 24px;">${text}</p>`;
}

function para(text: string): string {
  return `<p style="font-size:14px;color:#241f21;line-height:1.6;margin:0 0 16px;">${text}</p>`;
}

function smallNote(text: string): string {
  return `<p style="font-size:12px;color:#787878;line-height:1.5;margin:24px 0 0;text-align:center;">${text}</p>`;
}

// ─── Template type ───────────────────────────────────────

interface TemplateResult {
  subject: string;
  html: string;
}

type TemplateBuilder = (data: Record<string, unknown>, b: OrgBrand) => TemplateResult;

// ═══════════════════════════════════════════════════════════
// CATEGORY 1 — AUTHENTICATION
// ═══════════════════════════════════════════════════════════

const auth_magic_link: TemplateBuilder = (data, b) => ({
  subject: `Your login link for ${b.name}`,
  html: wrapEmail(b, [
    heading("Sign in to your account"),
    para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
    para("You requested a login link. Click below to sign in — this link expires in 10 minutes."),
    buildButton("Sign In", data.confirmation_url as string || "#", b),
    infoBox("If you didn't request this, you can safely ignore this email. Your account is secure.", b),
    smallNote(`Device: ${escapeHtml(data.device_info as string || "Unknown")} • ${new Date().toUTCString()}`),
  ].join("")),
});

const auth_welcome: TemplateBuilder = (data, b) => {
  const otpCode = data.otp_token as string || "";

  return {
    subject: `Verify your email for ${b.name}`,
    html: wrapEmail(b, [
      heading("Verify your email"),
      para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
      para("Enter this 6-digit code to verify your account:"),
      otpCode
        ? `<div style="text-align:center;margin:24px 0;">
            <span style="display:inline-block;font-size:36px;font-weight:700;letter-spacing:10px;font-family:'Courier New',monospace;color:${b.primaryHex};background-color:${b.lightBg};padding:16px 28px;border-radius:8px;border:2px solid ${b.primaryHex};">${escapeHtml(otpCode)}</span>
          </div>`
        : para("If you don't see a code above, please request a new one from the app."),
      infoBox("This code expires in 1 hour. If you didn't create an account, you can safely ignore this email.", b),
      smallNote(`Need help? Contact us at ${escapeHtml(data.support_email as string || "support@amwmedia.co.uk")}`),
    ].join("")),
  };
};

const auth_email_change: TemplateBuilder = (data, b) => ({
  subject: `Email address change — ${b.name}`,
  html: wrapEmail(b, [
    heading("Email Address Change"),
    para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
    para(data.is_old_email
      ? `We're writing to let you know that a request was made to change your email address from <strong>${escapeHtml(data.old_email as string || "")}</strong> to a new address.`
      : `Please confirm your new email address by clicking the button below.`),
    data.confirmation_url ? buildButton("Confirm Email Change", data.confirmation_url as string, b) : "",
    infoBox("If you didn't request this change, please secure your account immediately by resetting your password.", b),
  ].join("")),
});

const auth_recovery: TemplateBuilder = (data, b) => ({
  subject: `Reset your password — ${b.name}`,
  html: wrapEmail(b, [
    heading("Reset Your Password"),
    para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
    para("We received a request to reset your password. Click the button below — this link expires in 1 hour."),
    buildButton("Reset Password", data.confirmation_url as string || "#", b),
    infoBox("If you didn't request this, you can safely ignore this email. Your password won't change.", b),
  ].join("")),
});

const auth_deletion: TemplateBuilder = (data, b) => ({
  subject: `Account deleted — ${b.name}`,
  html: wrapEmail(b, [
    heading("Account Deleted"),
    para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
    para("Your account has been successfully deleted. Here's what was removed:"),
    `<ul style="font-size:14px;color:#241f21;line-height:1.8;margin:0 0 24px;padding-left:20px;">
      <li>Your profile and personal data</li>
      <li>All connected platform tokens</li>
      <li>Generated reports and analytics data</li>
    </ul>`,
    para("Your data will be permanently purged within 30 days. If this was a mistake, contact us as soon as possible."),
    smallNote(`Contact: ${escapeHtml(data.support_email as string || "support@amwmedia.co.uk")}`),
  ].join("")),
});

// ═══════════════════════════════════════════════════════════
// CATEGORY 2 — ORGANISATION & TEAM
// ═══════════════════════════════════════════════════════════

const team_invitation: TemplateBuilder = (data, b) => ({
  subject: `${escapeHtml(data.inviter_name as string || "Someone")} invited you to ${b.name}`,
  html: wrapEmail(b, [
    heading("You're Invited!"),
    para(`<strong>${escapeHtml(data.inviter_name as string || "A team member")}</strong> has invited you to join <strong>${escapeHtml(b.name)}</strong> as a <strong>${escapeHtml(data.role as string || "team member")}</strong>.`),
    para(`${escapeHtml(b.name)} is a marketing performance platform that helps agencies track, report, and optimise across all channels.`),
    buildButton("Accept Invitation", data.invite_url as string || "#", b),
    smallNote("This invitation expires in 7 days."),
  ].join("")),
});

const invitation_accepted: TemplateBuilder = (data, b) => ({
  subject: `${escapeHtml(data.member_name as string || "A team member")} joined ${b.name}`,
  html: wrapEmail(b, [
    heading("New Team Member"),
    para(`<strong>${escapeHtml(data.member_name as string || "A new member")}</strong> has accepted the invitation and joined <strong>${escapeHtml(b.name)}</strong> as a <strong>${escapeHtml(data.role as string || "team member")}</strong>.`),
    buildButton("Manage Team", data.team_url as string || "#", b),
  ].join("")),
});

const invitation_expiring: TemplateBuilder = (data, b) => ({
  subject: `Pending invite for ${escapeHtml(data.invited_email as string || "")} expires tomorrow`,
  html: wrapEmail(b, [
    heading("Invitation Expiring Soon"),
    para(`The invitation sent to <strong>${escapeHtml(data.invited_email as string || "")}</strong> hasn't been accepted yet and will expire tomorrow.`),
    buildButton("Resend Invitation", data.resend_url as string || "#", b),
  ].join("")),
});

const role_changed: TemplateBuilder = (data, b) => ({
  subject: `Your role in ${b.name} has changed`,
  html: wrapEmail(b, [
    heading("Role Updated"),
    para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
    para(`Your role in <strong>${escapeHtml(b.name)}</strong> has been changed from <strong>${escapeHtml(data.old_role as string || "")}</strong> to <strong>${escapeHtml(data.new_role as string || "")}</strong>.`),
    infoBox(`As a ${escapeHtml(data.new_role as string || "member")}, you ${escapeHtml(data.permissions_summary as string || "have updated permissions")}.`, b),
    para("If this change was unexpected, please contact your organisation owner."),
  ].join("")),
});

const member_removed: TemplateBuilder = (data, b) => ({
  subject: `You've been removed from ${b.name}`,
  html: wrapEmail(b, [
    heading("Removed from Organisation"),
    para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
    para(`You have been removed from <strong>${escapeHtml(b.name)}</strong>. Your access to all clients, reports, and platform data has been revoked.`),
    para("If you believe this was a mistake, please contact your organisation owner or our support team."),
    smallNote(`Support: ${escapeHtml(data.support_email as string || "support@amwmedia.co.uk")}`),
  ].join("")),
});

// ═══════════════════════════════════════════════════════════
// CATEGORY 3 — CLIENT REPORTS (fully white-labelled)
// ═══════════════════════════════════════════════════════════

const report_delivery: TemplateBuilder = (data, b) => {
  const month = MONTH_NAMES[(data.report_month as number) ?? 0] ?? "";
  const year = (data.report_year as number) ?? new Date().getFullYear();
  const summary = data.ai_executive_summary as string | null;

  return {
    subject: `${escapeHtml(data.company_name as string || "")} — ${month} ${year} Marketing Report`,
    html: wrapEmail(b, [
      heading("Monthly Marketing Report"),
      subtext(`${month} ${year}`),
      para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
      para(`Your monthly marketing performance report for <strong>${escapeHtml(data.company_name as string || "")}</strong> is ready. ${summary ? "Here's a quick overview:" : "Click the button below to download your full report."}`),
      summary ? infoBox(escapeHtml(summary), b) : "",
      buildButton("Download Report (PDF)", data.download_url as string || "#", b),
      smallNote("This link expires in 7 days. Contact your account manager if you need a new link."),
    ].join("")),
  };
};

const report_link_only: TemplateBuilder = (data, b) => {
  const month = MONTH_NAMES[(data.report_month as number) ?? 0] ?? "";
  const year = (data.report_year as number) ?? new Date().getFullYear();

  return {
    subject: `${escapeHtml(data.company_name as string || "")} — ${month} ${year} Marketing Report`,
    html: wrapEmail(b, [
      heading("Monthly Marketing Report"),
      subtext(`${month} ${year}`),
      para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
      para(`Your monthly marketing performance report for <strong>${escapeHtml(data.company_name as string || "")}</strong> is ready to view online.`),
      buildButton("View Your Report", data.report_url as string || "#", b),
      smallNote("This link expires in 7 days."),
    ].join("")),
  };
};

const report_reminder: TemplateBuilder = (data, b) => {
  const month = MONTH_NAMES[(data.report_month as number) ?? 0] ?? "";

  return {
    subject: `Your ${month} report is waiting — ${escapeHtml(data.company_name as string || "")}`,
    html: wrapEmail(b, [
      heading("Report Ready for Review"),
      para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
      para(`Just checking you received your <strong>${month}</strong> marketing report for <strong>${escapeHtml(data.company_name as string || "")}</strong>. Click below to view it.`),
      buildButton("View Report", data.report_url as string || "#", b),
      para("Would you like to schedule a call to walk through the results? Reply to this email and we'll set something up."),
    ].join("")),
  };
};

// ═══════════════════════════════════════════════════════════
// CATEGORY 4 — PLATFORM ALERTS
// ═══════════════════════════════════════════════════════════

const token_expiring: TemplateBuilder = (data, b) => ({
  subject: `${escapeHtml(data.platform as string || "")} connection expiring for ${escapeHtml(data.client_name as string || "")}`,
  html: wrapEmail(b, [
    heading("Connection Expiring Soon"),
    para(`The <strong>${escapeHtml(data.platform as string || "")}</strong> connection for <strong>${escapeHtml(data.client_name as string || "")}</strong> will expire in <strong>${data.days_remaining ?? "a few"} days</strong>.`),
    infoBox("When a connection expires, data syncs will stop and new report data won't be available until the connection is renewed.", b),
    buildButton("Reconnect Now", data.reconnect_url as string || "#", b),
  ].join("")),
});

const token_expired: TemplateBuilder = (data, b) => ({
  subject: `Action required: ${escapeHtml(data.platform as string || "")} disconnected — ${escapeHtml(data.client_name as string || "")}`,
  html: wrapEmail(b, [
    heading("Connection Expired"),
    para(`The <strong>${escapeHtml(data.platform as string || "")}</strong> connection for <strong>${escapeHtml(data.client_name as string || "")}</strong> has expired and is now disconnected.`),
    para(`Last successful sync: <strong>${escapeHtml(data.last_sync_date as string || "Unknown")}</strong>`),
    infoBox("Data is no longer being collected. Reports generated without reconnecting will have incomplete data.", b),
    buildButton("Reconnect Now", data.reconnect_url as string || "#", b),
  ].join("")),
});

const sync_failed: TemplateBuilder = (data, b) => ({
  subject: `${escapeHtml(data.platform as string || "")} sync failed for ${escapeHtml(data.client_name as string || "")}`,
  html: wrapEmail(b, [
    heading("Sync Failed"),
    para(`A data sync for <strong>${escapeHtml(data.platform as string || "")}</strong> on <strong>${escapeHtml(data.client_name as string || "")}</strong> has failed.`),
    infoBox(`Reason: ${escapeHtml(data.error_message as string || "An unexpected error occurred")}`, b),
    para(`This happened at ${escapeHtml(data.failed_at as string || new Date().toUTCString())}.`),
    buildButton("Retry Sync", data.retry_url as string || "#", b),
    smallNote(`If the issue persists, contact support at ${escapeHtml(data.support_email as string || "support@amwmedia.co.uk")}`),
  ].join("")),
});

const report_generation_failed: TemplateBuilder = (data, b) => {
  const month = MONTH_NAMES[(data.report_month as number) ?? 0] ?? "";
  const year = (data.report_year as number) ?? new Date().getFullYear();

  return {
    subject: `Report failed for ${escapeHtml(data.client_name as string || "")}`,
    html: wrapEmail(b, [
      heading("Report Generation Failed"),
      para(`We weren't able to generate the report for <strong>${escapeHtml(data.client_name as string || "")}</strong> (${month} ${year}).`),
      infoBox(`Reason: ${escapeHtml(data.error_message as string || "An unexpected error occurred during generation")}`, b),
      buildButton("Try Again", data.retry_url as string || "#", b),
      smallNote(`If the issue persists, contact support at ${escapeHtml(data.support_email as string || "support@amwmedia.co.uk")}`),
    ].join("")),
  };
};

// ═══════════════════════════════════════════════════════════
// CATEGORY 5 — SUBSCRIPTION & BILLING
// ═══════════════════════════════════════════════════════════

const subscription_activated: TemplateBuilder = (data, b) => ({
  subject: `Welcome to ${escapeHtml(data.plan_name as string || "your new plan")}`,
  html: wrapEmail(b, [
    heading(`Welcome to ${escapeHtml(data.plan_name as string || "Your Plan")}!`),
    para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
    para(`Your subscription to <strong>${escapeHtml(data.plan_name as string || "")}</strong> is now active.`),
    `<ul style="font-size:14px;color:#241f21;line-height:1.8;margin:0 0 24px;padding-left:20px;">
      <li>Client limit: ${escapeHtml(String(data.client_limit ?? "Unlimited"))}</li>
      <li>Connection limit: ${escapeHtml(String(data.connection_limit ?? "Unlimited"))}</li>
      <li>Next billing date: ${escapeHtml(data.billing_date as string || "N/A")}</li>
    </ul>`,
    buildButton("Go to Dashboard", data.dashboard_url as string || "#", b),
  ].join("")),
});

const subscription_upgraded: TemplateBuilder = (data, b) => ({
  subject: `Plan upgraded to ${escapeHtml(data.new_plan as string || "")}`,
  html: wrapEmail(b, [
    heading("Plan Upgraded 🎉"),
    para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
    para(`Your plan has been upgraded from <strong>${escapeHtml(data.old_plan as string || "")}</strong> to <strong>${escapeHtml(data.new_plan as string || "")}</strong>.`),
    para(`Your new limits and features are effective immediately.${data.prorated_amount ? ` A prorated charge of <strong>${escapeHtml(String(data.prorated_amount))}</strong> has been applied.` : ""}`),
    buildButton("Explore Your New Plan", data.dashboard_url as string || "#", b),
  ].join("")),
});

const subscription_downgraded: TemplateBuilder = (data, b) => ({
  subject: `Plan changed to ${escapeHtml(data.new_plan as string || "")}`,
  html: wrapEmail(b, [
    heading("Plan Changed"),
    para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
    para(`Your plan has been changed from <strong>${escapeHtml(data.old_plan as string || "")}</strong> to <strong>${escapeHtml(data.new_plan as string || "")}</strong>.`),
    para(`New limits: <strong>${escapeHtml(String(data.new_client_limit ?? ""))}</strong> clients, <strong>${escapeHtml(String(data.new_connection_limit ?? ""))}</strong> connections.`),
    para(`This change takes effect on <strong>${escapeHtml(data.effective_date as string || "your next billing cycle")}</strong>.`),
    buildButton("Upgrade Again", data.upgrade_url as string || "#", b),
  ].join("")),
});

const payment_failed: TemplateBuilder = (data, b) => ({
  subject: "Payment failed — action required",
  html: wrapEmail(b, [
    heading("Payment Failed"),
    para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
    para(`Your payment of <strong>${escapeHtml(data.amount as string || "")}</strong> was declined.`),
    para(`We'll retry automatically on <strong>${escapeHtml(data.retry_date as string || "the next business day")}</strong>. If the payment continues to fail, your account may be suspended.`),
    buildButton("Update Payment Method", data.billing_url as string || "#", b),
    infoBox("To avoid service interruption, please update your payment method as soon as possible.", b),
  ].join("")),
});

const trial_ending: TemplateBuilder = (data, b) => ({
  subject: "Your trial ends in 3 days",
  html: wrapEmail(b, [
    heading("Trial Ending Soon"),
    para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
    para("Your free trial ends in <strong>3 days</strong>. Here's what you've built so far:"),
    `<ul style="font-size:14px;color:#241f21;line-height:1.8;margin:0 0 24px;padding-left:20px;">
      <li>${escapeHtml(String(data.client_count ?? 0))} client(s) configured</li>
      <li>${escapeHtml(String(data.connection_count ?? 0))} platform connection(s) active</li>
    </ul>`,
    para("Upgrade now to keep your data and continue generating reports."),
    buildButton("Upgrade Now", data.upgrade_url as string || "#", b),
    smallNote("If you don't upgrade, your data will be preserved for 14 days."),
  ].join("")),
});

const trial_expired: TemplateBuilder = (data, b) => ({
  subject: "Your trial has ended",
  html: wrapEmail(b, [
    heading("Trial Expired"),
    para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
    para("Your free trial has ended. Don't worry — your data is preserved for <strong>14 days</strong>."),
    para("Upgrade to a paid plan to regain access to your clients, reports, and analytics."),
    buildButton("Upgrade Now", data.upgrade_url as string || "#", b),
    smallNote(`Questions? Contact us at ${escapeHtml(data.support_email as string || "support@amwmedia.co.uk")}`),
  ].join("")),
});

// ═══════════════════════════════════════════════════════════
// CATEGORY 6 — MONTHLY DIGEST
// ═══════════════════════════════════════════════════════════

const monthly_digest: TemplateBuilder = (data, b) => {
  const month = MONTH_NAMES[(data.report_month as number) ?? 0] ?? "";

  return {
    subject: `${b.name} — ${month} Platform Summary`,
    html: wrapEmail(b, [
      heading(`${month} Platform Summary`),
      para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
      para("Here's your monthly overview:"),
      `<ul style="font-size:14px;color:#241f21;line-height:1.8;margin:0 0 24px;padding-left:20px;">
        <li><strong>${escapeHtml(String(data.reports_sent ?? 0))}</strong> reports sent</li>
        <li><strong>${escapeHtml(String(data.syncs_run ?? 0))}</strong> data syncs completed</li>
        <li><strong>${escapeHtml(String(data.failed_connections ?? 0))}</strong> connection(s) need attention</li>
      </ul>`,
      data.top_performer ? para(`🏆 Strongest performer: <strong>${escapeHtml(data.top_performer as string)}</strong>`) : "",
      data.upsell_opportunities ? para(`💡 Upsell opportunities flagged: <strong>${escapeHtml(String(data.upsell_opportunities))}</strong>`) : "",
      buildButton("View Dashboard", data.dashboard_url as string || "#", b),
    ].join("")),
  };
};

// ═══════════════════════════════════════════════════════════
// CATEGORY 7 — SECURITY
// ═══════════════════════════════════════════════════════════

const new_device_login: TemplateBuilder = (data, b) => ({
  subject: `New sign-in detected — ${b.name}`,
  html: wrapEmail(b, [
    heading("New Sign-In Detected"),
    para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
    para("We detected a new sign-in to your account:"),
    infoBox(`Device: ${escapeHtml(data.device as string || "Unknown")}<br/>Location: ${escapeHtml(data.location as string || "Unknown")}<br/>Time: ${escapeHtml(data.login_time as string || new Date().toUTCString())}`, b),
    para("If this was you, no action is needed."),
    buildButton("Secure My Account", data.security_url as string || "#", b),
    smallNote("If you don't recognise this activity, please change your password immediately."),
  ].join("")),
});

const failed_login_attempts: TemplateBuilder = (data, b) => ({
  subject: `Unusual login activity — ${b.name}`,
  html: wrapEmail(b, [
    heading("Unusual Login Activity"),
    para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
    para(`We detected <strong>${escapeHtml(String(data.attempt_count ?? "multiple"))}</strong> failed login attempts on your account in the last 15 minutes.`),
    para("Your account has been temporarily locked for security."),
    buildButton("Unlock My Account", data.unlock_url as string || "#", b),
    smallNote(`If you need help, contact support at ${escapeHtml(data.support_email as string || "support@amwmedia.co.uk")}`),
  ].join("")),
});

// ═══════════════════════════════════════════════════════════
// CATEGORY 8 — CLIENT PORTAL
// ═══════════════════════════════════════════════════════════

const client_invite: TemplateBuilder = (data, b) => ({
  subject: `You've been invited to manage your accounts for ${escapeHtml(data.client_name as string || "")}`,
  html: wrapEmail(b, [
    heading("You're Invited!"),
    para(`You've been invited to connect and manage your own marketing accounts for <strong>${escapeHtml(data.client_name as string || "your company")}</strong>.`),
    para("By accepting this invitation, you'll be able to:"),
    `<ul style="font-size:14px;color:#241f21;line-height:1.8;margin:0 0 24px;padding-left:20px;">
      <li>Connect your social media and ad platform accounts</li>
      <li>View your marketing performance dashboard</li>
      <li>Review monthly reports</li>
    </ul>`,
    buildButton("Accept Invitation", data.magic_link as string || "#", b),
    smallNote("This link will sign you in automatically. If you didn't expect this invitation, you can safely ignore it."),
  ].join("")),
});

// ═══════════════════════════════════════════════════════════
// CATEGORY 8 — CONTENT LAB
// ═══════════════════════════════════════════════════════════

const content_lab_run_complete: TemplateBuilder = (data, b) => {
  const niche = escapeHtml((data.niche_label as string) || "your niche");
  const ideaCount = Number(data.idea_count ?? 0);
  const reportUrl = String(data.report_url ?? "#");
  const recipient = escapeHtml((data.recipient_name as string) || "there");
  return {
    subject: `Your Content Lab ideas are ready ✨`,
    html: wrapEmail(b, [
      heading("Your content plan is ready"),
      para(`Hi ${recipient},`),
      para(`We've finished generating <strong>${ideaCount} fresh content ideas</strong> for <strong>${niche}</strong>, with hooks, scripts, and platform-specific guidance.`),
      infoBox(
        `Each idea includes 3 hook variants, a full script, filming checklist, hashtags, and a "why it works" breakdown — reverse-engineered from the top-performing posts in your niche this month.`,
        b,
      ),
      buildButton("View your ideas", reportUrl, b),
      smallNote("Ideas remain available in your Content Lab dashboard. Generate a new plan any time."),
    ].join("")),
  };
};

// ═══════════════════════════════════════════════════════════
// TEMPLATE REGISTRY
// ═══════════════════════════════════════════════════════════

const TEMPLATES: Record<string, TemplateBuilder> = {
  // Auth
  auth_magic_link,
  auth_welcome,
  auth_email_change,
  auth_recovery,
  auth_deletion,
  // Org & Team
  team_invitation,
  invitation_accepted,
  invitation_expiring,
  role_changed,
  member_removed,
  // Client Reports
  report_delivery,
  report_link_only,
  report_reminder,
  // Platform Alerts
  token_expiring,
  token_expired,
  sync_failed,
  report_generation_failed,
  // Billing
  subscription_activated,
  subscription_upgraded,
  subscription_downgraded,
  payment_failed,
  trial_ending,
  trial_expired,
  // Digest
  monthly_digest,
  // Security
  new_device_login,
  failed_login_attempts,
  // Client Portal
  client_invite,
  // Content Lab
  content_lab_run_complete,
};

// ═══════════════════════════════════════════════════════════
// REQUEST HANDLER
// ═══════════════════════════════════════════════════════════

interface SendRequest {
  template_name: string;
  recipient_email: string;
  recipient_name?: string;
  org_id: string;
  data?: Record<string, unknown>;
  client_id?: string;
  report_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "send-branded-email", method: req.method, connection_id: null }));

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json()) as SendRequest;
    const { template_name, recipient_email, recipient_name, org_id, data = {}, client_id, report_id } = body;

    if (!template_name || !recipient_email || !org_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: template_name, recipient_email, org_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hard validation: team_invitation MUST have a valid absolute invite_url
    if (template_name === "team_invitation") {
      const inviteUrl = String(data?.invite_url ?? "").trim();
      if (!/^https?:\/\/\S+$/i.test(inviteUrl)) {
        return new Response(
          JSON.stringify({ error: "team_invitation requires a valid absolute invite_url in data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const templateFn = TEMPLATES[template_name];
    if (!templateFn) {
      return new Response(
        JSON.stringify({ error: `Unknown template: ${template_name}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch org branding
    const { data: org } = await supabase
      .from("organisations")
      .select("name, logo_url, primary_color, secondary_color, accent_color, heading_font, body_font")
      .eq("id", org_id)
      .single();

    const brand = buildOrgBrand(org);

    // Merge recipient info into data
    const mergedData = { ...data, recipient_name: recipient_name ?? data.recipient_name ?? "" };

    // Render template
    const { subject, html } = templateFn(mergedData, brand);

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${brand.name} <reports@amwmedia.co.uk>`,
        to: [recipient_email],
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    // Log to email_logs
    const logEntry: Record<string, unknown> = {
      recipient_email,
      org_id,
      email_type: template_name,
      status: resendRes.ok ? "sent" : "failed",
      sent_at: resendRes.ok ? new Date().toISOString() : null,
      error_message: resendRes.ok ? null : (resendData?.message ?? JSON.stringify(resendData)),
    };

    if (client_id) logEntry.client_id = client_id;
    if (report_id) logEntry.report_id = report_id;

    // client_id is nullable — only set if provided

    await supabase.from("email_logs").insert(logEntry);

    if (!resendRes.ok) {
      return new Response(
        JSON.stringify({ error: resendData?.message ?? "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Email sent to ${recipient_email}`, template: template_name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-branded-email error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
