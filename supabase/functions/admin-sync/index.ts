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
    const { data: claimsData, error: claimsError } =
      await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const userId = claimsData.claims.sub as string;

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

    const body = await req.json();
    const { connections, months = 24 } = body as {
      connections: ConnectionTarget[];
      months?: number;
    };

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
      `Admin sync: enqueued ${jobsToInsert.length} job(s) for ${connections.length} connection(s)`
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
