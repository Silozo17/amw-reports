import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const PLACES_BASE = "https://places.googleapis.com/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "google-places-lookup", method: req.method }));

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Unauthorized", 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user?.id) return jsonError("Unauthorized", 401);

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) return jsonError("GOOGLE_API_KEY is not configured", 500);

    const body = await req.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const placeId = typeof body?.place_id === "string" ? body.place_id.trim() : "";

    // ── Mode B: resolve a single place by id ──
    if (placeId) {
      const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": GOOGLE_API_KEY,
          "X-Goog-FieldMask":
            "id,displayName,formattedAddress,websiteUri,nationalPhoneNumber,internationalPhoneNumber",
        },
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("Place Details error:", res.status, errText);
        return jsonError(`Place Details error [${res.status}]`, 502);
      }
      const place = await res.json();
      return json({
        result: {
          place_id: place.id || placeId,
          name: place.displayName?.text || "",
          address: place.formattedAddress || "",
          website: place.websiteUri || "",
          phone: place.nationalPhoneNumber || place.internationalPhoneNumber || "",
        },
      });
    }

    // ── Mode A: typeahead autocomplete ──
    if (!query) return jsonError("Missing 'query' or 'place_id'", 400);

    const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        input: query,
        // "establishment" covers brick-and-mortar AND service-area businesses,
        // brands, chains — same index Google Maps' search box uses.
        includedPrimaryTypes: ["establishment"],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Places Autocomplete error:", res.status, errText);
      return jsonError(`Places Autocomplete error [${res.status}]`, 502);
    }

    const data = await res.json();
    const results = (data.suggestions || [])
      .map((s: any) => s.placePrediction)
      .filter(Boolean)
      .map((p: any) => ({
        place_id: p.placeId || "",
        name: p.structuredFormat?.mainText?.text || p.text?.text || "",
        address: p.structuredFormat?.secondaryText?.text || "",
        website: "", // resolved on click via Place Details
      }));

    return json({ results });
  } catch (err) {
    console.error("Error:", err);
    return jsonError(String(err), 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jsonError(message: string, status: number) {
  return json({ error: message }, status);
}
