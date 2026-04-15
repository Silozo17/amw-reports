import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

interface ConnectionTarget {
  id: string;
  platform: string;
}

interface SyncPayload {
  connections: ConnectionTarget[];
  mode?: "single_month" | "date_range" | "full";
  month?: number;
  year?: number;
  start_month?: number;
  start_year?: number;
  end_month?: number;
  end_year?: number;
  months?: number;
}

function computeTargetMonths(payload: SyncPayload): { month: number; year: number }[] | null {
  const { mode } = payload;

  if (mode === "single_month" && payload.month && payload.year) {
    return [{ month: payload.month, year: payload.year }];
  }

  if (mode === "date_range" && payload.start_month && payload.start_year && payload.end_month && payload.end_year) {
    const months: { month: number; year: number }[] = [];
    let m = payload.start_month;
    let y = payload.start_year;
    const endKey = payload.end_year * 12 + payload.end_month;
    while (y * 12 + m <= endKey) {
      months.push({ month: m, year: y });
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return months;
  }

  // "full" mode or no mode specified — return null to use the months count approach
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      fn: "admin-sync",
      method: req.method,
    })
  );

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate caller is a platform admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const userId = userData.user.id;

    const { data: isAdmin } = await supabase.rpc("is_platform_admin", {
      _user_id: userId,
    });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden — platform admin required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: SyncPayload = await req.json();
    const { connections, months = 24 } = body;

    if (
      !connections ||
      !Array.isArray(connections) ||
      connections.length === 0
    ) {
      return new Response(
        JSON.stringify({ error: "connections array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Compute target months from the time mode
    const targetMonths = computeTargetMonths(body);

    // Look up client_id and org_id for each connection
    const connIds = connections.map((c) => c.id);
    const { data: connRows } = await supabase
      .from("platform_connections")
      .select("id, platform, client_id, clients!inner(org_id)")
      .in("id", connIds);

    if (!connRows || connRows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid connections found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert sync jobs for each connection
    const jobsToInsert = connRows.map((row) => {
      const clientData = (row as Record<string, unknown>).clients as {
        org_id: string;
      };
      return {
        connection_id: row.id,
        client_id: row.client_id,
        org_id: clientData.org_id,
        platform: row.platform,
        months,
        priority: 10, // Admin jobs get high priority
        force_resync: true, // Admin syncs always overwrite existing data
        target_months: targetMonths,
      };
    });

    const { error: insertErr } = await supabase
      .from("sync_jobs")
      .insert(jobsToInsert);

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: `Failed to enqueue jobs: ${insertErr.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Trigger the queue processor (fire-and-forget)
    supabase.functions
      .invoke("process-sync-queue")
      .catch((err: unknown) => {
        console.warn("Failed to trigger process-sync-queue:", err);
      });

    console.log(
      `Admin sync: enqueued ${jobsToInsert.length} job(s) for ${connections.length} connection(s), mode=${body.mode ?? "full"}`
    );

    return new Response(
      JSON.stringify({
        message: `Enqueued ${jobsToInsert.length} sync job(s)`,
        jobs_enqueued: jobsToInsert.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Admin sync error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
