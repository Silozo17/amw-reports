import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken } from "../_shared/tokenCrypto.ts";

const ENCRYPTION_PREFIX = "enc:";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify TOKEN_ENCRYPTION_KEY is set
    const keyHex = Deno.env.get("TOKEN_ENCRYPTION_KEY");
    if (!keyHex || keyHex.length !== 64) {
      return new Response(
        JSON.stringify({ error: "TOKEN_ENCRYPTION_KEY is not configured or invalid (must be 64 hex chars)" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Fetch all connections with tokens
    const { data: connections, error } = await supabase
      .from("platform_connections")
      .select("id, access_token, refresh_token")
      .or("access_token.not.is.null,refresh_token.not.is.null");

    if (error) throw new Error(`Failed to fetch connections: ${error.message}`);

    let encrypted = 0;
    let skipped = 0;
    let errors = 0;

    for (const conn of connections || []) {
      try {
        const updates: Record<string, string> = {};

        if (conn.access_token && !conn.access_token.startsWith(ENCRYPTION_PREFIX)) {
          updates.access_token = await encryptToken(conn.access_token);
        }
        if (conn.refresh_token && !conn.refresh_token.startsWith(ENCRYPTION_PREFIX)) {
          updates.refresh_token = await encryptToken(conn.refresh_token);
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from("platform_connections")
            .update(updates)
            .eq("id", conn.id);
          if (updateError) {
            console.error(`Failed to encrypt tokens for ${conn.id}:`, updateError.message);
            errors++;
          } else {
            encrypted++;
          }
        } else {
          skipped++;
        }
      } catch (e) {
        console.error(`Error processing connection ${conn.id}:`, e);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: (connections || []).length,
        encrypted,
        skipped,
        errors,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Migration error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
