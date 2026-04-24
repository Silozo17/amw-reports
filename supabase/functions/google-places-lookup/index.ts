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
        // No `includedPrimaryTypes` filter: 'establishment' is a category root,
        // not a valid primary type, and restricting to it drops service-area
        // businesses, agencies and brands. Defaulting (no filter) returns the
        // same broad index Google Maps' search box uses (POIs + services + brands).
        // `includeQueryPredictions` ensures generic queries still surface results
        // (returned without a placeId; we add those by name only).
        includeQueryPredictions: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Places Autocomplete error:", res.status, errText);
      return jsonError(`Places Autocomplete error [${res.status}]`, 502);
    }

    const data = await res.json();
    const suggestions = (data.suggestions ?? []) as any[];

    const results = suggestions
      .map((s) => {
        // Place predictions (real businesses/POIs) — have placeId.
        if (s.placePrediction) {
          const p = s.placePrediction;
          return {
            place_id: p.placeId || "",
            name: p.structuredFormat?.mainText?.text || p.text?.text || "",
            address: p.structuredFormat?.secondaryText?.text || "",
            website: "",
          };
        }
        // Query predictions (generic search terms) — no placeId; add by name only.
        if (s.queryPrediction) {
          const q = s.queryPrediction;
          return {
            place_id: "",
            name: q.text?.text || "",
            address: "",
            website: "",
          };
        }
        return null;
      })
      .filter((r): r is { place_id: string; name: string; address: string; website: string } =>
        Boolean(r && r.name),
      );

    if (results.length === 0) {
      console.log("Autocomplete returned 0 results. Raw payload:", JSON.stringify(data).slice(0, 500));
    }

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
