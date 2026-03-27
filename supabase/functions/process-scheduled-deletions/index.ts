import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
