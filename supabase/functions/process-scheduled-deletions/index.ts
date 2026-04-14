import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cron-only function — no CORS needed

Deno.serve(async (req) => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "process-scheduled-deletions", method: req.method, connection_id: null }));
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find clients whose scheduled deletion time has passed
    const { data: clients, error: fetchError } = await supabase
      .from("clients")
      .select("id, company_name")
      .not("scheduled_deletion_at", "is", null)
      .lte("scheduled_deletion_at", new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ deleted: 0, message: "No clients to delete" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const results: { id: string; name: string; success: boolean; error?: string }[] = [];

    for (const client of clients) {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.id);

      results.push({
        id: client.id,
        name: client.company_name,
        success: !error,
        error: error?.message,
      });
    }

    return new Response(
      JSON.stringify({ deleted: results.filter((r) => r.success).length, results }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
