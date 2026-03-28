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

    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const results: Array<{ type: string; success: boolean; error?: string }> = [];

    // Get recent auth events via SECURITY DEFINER function
    const { data: events, error: eventsErr } = await supabase
      .rpc("get_recent_auth_events", { _since: fifteenMinAgo });

    if (eventsErr) {
      console.error("Failed to get auth events:", eventsErr);
      return new Response(
        JSON.stringify({ error: eventsErr.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recent auth events", results: [] }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // ─── 1. New Device Login Detection ───
    const loginEvents = events.filter((e: any) => e.factor_type === "login" && e.user_id);

    for (const evt of loginEvents) {
      if (!evt.user_id || !evt.ip) continue;

      // Hash IP and UA for comparison
      const ipHash = await hashString(evt.ip);
      const uaHash = await hashString(evt.payload?.traits?.user_agent ?? "unknown");

      // Check if this device is known
      const { data: known } = await supabase
        .from("known_devices")
        .select("id")
        .eq("user_id", evt.user_id)
        .eq("ip_hash", ipHash)
        .eq("ua_hash", uaHash)
        .maybeSingle();

      if (known) continue; // Known device, skip

      // Insert as new known device
      await supabase.from("known_devices").upsert({
        user_id: evt.user_id,
        ip_hash: ipHash,
        ua_hash: uaHash,
      }, { onConflict: "user_id,ip_hash,ua_hash" });

      // Check if user has ANY known devices before this (first login = don't alert)
      const { count } = await supabase
        .from("known_devices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", evt.user_id);

      if ((count ?? 0) <= 1) continue; // First device, no alert

      // Get user email and org
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, org_id")
        .eq("user_id", evt.user_id)
        .maybeSingle();

      if (!profile?.email || !profile?.org_id) continue;

      try {
        await supabase.functions.invoke("send-branded-email", {
          body: {
            template_name: "new_device_login",
            recipient_email: profile.email,
            org_id: profile.org_id,
            data: {
              ip_address: evt.ip,
              user_agent: evt.payload?.traits?.user_agent ?? "Unknown device",
              login_time: evt.created_at,
            },
          },
        });
        results.push({ type: "new_device_login", success: true });
      } catch (e) {
        results.push({ type: "new_device_login", success: false, error: String(e) });
      }
    }

    // ─── 2. Failed Login Attempts (5+ in 15 minutes) ───
    const failedEvents = events.filter((e: any) => e.factor_type === "login_failed");

    // Group by target email (from payload)
    const failedByEmail: Record<string, any[]> = {};
    for (const evt of failedEvents) {
      const targetEmail = evt.payload?.actor_username ?? evt.payload?.traits?.email ?? "unknown";
      if (!failedByEmail[targetEmail]) failedByEmail[targetEmail] = [];
      failedByEmail[targetEmail].push(evt);
    }

    for (const [targetEmail, attempts] of Object.entries(failedByEmail)) {
      if (attempts.length < 5) continue;
      if (targetEmail === "unknown") continue;

      // Deduplicate: check if we already notified
      const refId = await hashString(`failed_login_${targetEmail}_${fifteenMinAgo}`);
      const { data: existing } = await supabase
        .from("notification_tracking")
        .select("id")
        .eq("notification_type", "failed_login_attempts")
        .eq("reference_id", refId)
        .maybeSingle();

      if (existing) continue;

      // Find the user's profile and org
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, org_id, user_id")
        .eq("email", targetEmail)
        .maybeSingle();

      if (!profile?.org_id) continue;

      // Get org owner email to notify
      const { data: owner } = await supabase
        .from("org_members")
        .select("user_id")
        .eq("org_id", profile.org_id)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle();

      if (!owner?.user_id) continue;

      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", owner.user_id)
        .maybeSingle();

      if (!ownerProfile?.email) continue;

      try {
        await supabase.functions.invoke("send-branded-email", {
          body: {
            template_name: "failed_login_attempts",
            recipient_email: ownerProfile.email,
            org_id: profile.org_id,
            data: {
              target_email: targetEmail,
              attempt_count: attempts.length,
              time_window: "15 minutes",
              latest_ip: attempts[0]?.ip ?? "Unknown",
            },
          },
        });

        await supabase.from("notification_tracking").insert({
          notification_type: "failed_login_attempts",
          reference_id: refId,
        });

        results.push({ type: "failed_login_attempts", success: true });
      } catch (e) {
        results.push({ type: "failed_login_attempts", success: false, error: String(e) });
      }
    }

    return new Response(
      JSON.stringify({ message: `Processed ${results.length} security events`, results }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-security-events error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
