import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cron-only function — no CORS needed (never called from browser)

/** Platforms that use permanent page tokens — never expire */
const PERMANENT_TOKEN_PLATFORMS = ["facebook", "instagram", "tiktok_ads"];

/** Platforms that have refresh_token auto-refresh in their sync functions */
const AUTO_REFRESH_PLATFORMS = [
  "google_ads", "google_search_console", "google_analytics",
  "google_business_profile", "youtube", "pinterest", "tiktok", "linkedin",
];

Deno.serve(async (req) => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "check-expiring-tokens", method: req.method, connection_id: null }));
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const sixDaysAgoStart = new Date(sixDaysAgo.getFullYear(), sixDaysAgo.getMonth(), sixDaysAgo.getDate());
    const sixDaysAgoEnd = new Date(sixDaysAgoStart.getTime() + 24 * 60 * 60 * 1000);

    const results: Array<{ type: string; success: boolean; error?: string }> = [];

    // ─── 1. Token Expiring (within 7 days) ───
    // Only alert for connections that CANNOT auto-refresh (meta_ads user tokens)
    const { data: expiringConns } = await supabase
      .from("platform_connections")
      .select("id, platform, account_name, client_id, refresh_token, clients!inner(company_name, org_id)")
      .eq("is_connected", true)
      .gt("token_expires_at", now.toISOString())
      .lt("token_expires_at", sevenDaysFromNow.toISOString());

    for (const conn of expiringConns ?? []) {
      const clientData = (conn as Record<string, unknown>).clients as { company_name: string; org_id: string };
      // Skip platforms with permanent page tokens
      if (PERMANENT_TOKEN_PLATFORMS.includes(conn.platform)) continue;
      // Skip platforms that auto-refresh via refresh_token
      if (conn.refresh_token && AUTO_REFRESH_PLATFORMS.includes(conn.platform)) continue;

      const { data: existing } = await supabase
        .from("notification_tracking")
        .select("id")
        .eq("notification_type", "token_expiring")
        .eq("reference_id", conn.id)
        .maybeSingle();

      if (existing) continue;

      const orgId = clientData.org_id;
      const ownerEmail = await getOrgOwnerEmail(supabase, orgId);
      if (!ownerEmail) continue;

      try {
        await supabase.functions.invoke("send-branded-email", {
          body: {
            template_name: "token_expiring",
            recipient_email: ownerEmail,
            org_id: orgId,
            data: {
              platform: conn.platform,
              account_name: conn.account_name ?? conn.platform,
              client_name: clientData.company_name,
            },
          },
        });

        await supabase.from("notification_tracking").insert({
          notification_type: "token_expiring",
          reference_id: conn.id,
        });

        results.push({ type: "token_expiring", success: true });
      } catch (e) {
        results.push({ type: "token_expiring", success: false, error: String(e) });
      }
    }

    // ─── 2. Token Expired (past due, still connected) ───
    // Only alert for connections that genuinely cannot auto-refresh
    const { data: expiredConns } = await supabase
      .from("platform_connections")
      .select("id, platform, account_name, client_id, refresh_token, clients!inner(company_name, org_id)")
      .eq("is_connected", true)
      .lt("token_expires_at", now.toISOString())
      .not("token_expires_at", "is", null);

    for (const conn of expiredConns ?? []) {
      const clientData = (conn as Record<string, unknown>).clients as { company_name: string; org_id: string };
      // Skip platforms with permanent page tokens
      if (PERMANENT_TOKEN_PLATFORMS.includes(conn.platform)) continue;
      // Skip platforms that auto-refresh via refresh_token
      if (conn.refresh_token && AUTO_REFRESH_PLATFORMS.includes(conn.platform)) continue;

      const { data: existing } = await supabase
        .from("notification_tracking")
        .select("id")
        .eq("notification_type", "token_expired")
        .eq("reference_id", conn.id)
        .maybeSingle();

      if (existing) continue;

      const orgId = clientData.org_id;
      const ownerEmail = await getOrgOwnerEmail(supabase, orgId);
      if (!ownerEmail) continue;

      try {
        await supabase.functions.invoke("send-branded-email", {
          body: {
            template_name: "token_expired",
            recipient_email: ownerEmail,
            org_id: orgId,
            data: {
              platform: conn.platform,
              account_name: conn.account_name ?? conn.platform,
              client_name: clientData.company_name,
            },
          },
        });

        await supabase.from("notification_tracking").insert({
          notification_type: "token_expired",
          reference_id: conn.id,
        });

        results.push({ type: "token_expired", success: true });
      } catch (e) {
        results.push({ type: "token_expired", success: false, error: String(e) });
      }
    }

    // ─── 3. Invitation Expiring (day 6 of 7 pending invites) ───
    const { data: expiringInvites } = await supabase
      .from("org_members")
      .select("id, org_id, invited_email")
      .is("accepted_at", null)
      .is("user_id", null)
      .gte("invited_at", sixDaysAgoStart.toISOString())
      .lt("invited_at", sixDaysAgoEnd.toISOString());

    for (const invite of expiringInvites ?? []) {
      const { data: existing } = await supabase
        .from("notification_tracking")
        .select("id")
        .eq("notification_type", "invitation_expiring")
        .eq("reference_id", invite.id)
        .maybeSingle();

      if (existing) continue;

      const ownerEmail = await getOrgOwnerEmail(supabase, invite.org_id);
      if (!ownerEmail) continue;

      try {
        await supabase.functions.invoke("send-branded-email", {
          body: {
            template_name: "invitation_expiring",
            recipient_email: ownerEmail,
            org_id: invite.org_id,
            data: {
              invited_email: invite.invited_email,
            },
          },
        });

        await supabase.from("notification_tracking").insert({
          notification_type: "invitation_expiring",
          reference_id: invite.id,
        });

        results.push({ type: "invitation_expiring", success: true });
      } catch (e) {
        results.push({ type: "invitation_expiring", success: false, error: String(e) });
      }
    }

    return new Response(
      JSON.stringify({ message: `Processed ${results.length} notifications`, results }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-expiring-tokens error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function getOrgOwnerEmail(supabase: any, orgId: string): Promise<string | null> {
  const { data: owner } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (!owner?.user_id) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("user_id", owner.user_id)
    .maybeSingle();

  return profile?.email ?? null;
}
