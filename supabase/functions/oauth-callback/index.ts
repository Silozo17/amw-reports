import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Frontend redirect base - use the origin from state or fallback
  let frontendUrl = "https://amw-reports.lovable.app";
  let connectionId = "";
  let platform = "";

  try {
    if (state) {
      const stateData = JSON.parse(atob(state));
      connectionId = stateData.connection_id || "";
      platform = stateData.platform || "";
      frontendUrl = stateData.redirect_url || frontendUrl;
    }
  } catch {
    // Invalid state
  }

  if (error || !code) {
    const errorMsg = error || "no_code";
    return Response.redirect(
      `${frontendUrl}/clients?oauth_error=${encodeURIComponent(errorMsg)}`,
      302
    );
  }

  if (!connectionId) {
    return Response.redirect(
      `${frontendUrl}/clients?oauth_error=invalid_state`,
      302
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (platform === "google_ads") {
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
      const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        throw new Error(tokenData.error_description || tokenData.error);
      }

      const expiresAt = new Date(
        Date.now() + (tokenData.expires_in || 3600) * 1000
      ).toISOString();

      let accountName = null;
      let accountId = null;
      const devToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");

      try {
        const customerRes = await fetch(
          "https://googleads.googleapis.com/v20/customers:listAccessibleCustomers",
          {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              "developer-token": devToken || "",
            },
          }
        );
        const customerData = await customerRes.json();
        console.log("Google Ads customer discovery response:", JSON.stringify(customerData));
        if (customerData.resourceNames && customerData.resourceNames.length > 0) {
          accountId = customerData.resourceNames[0].replace("customers/", "");
          accountName = `Google Ads (${accountId})`;
        } else {
          console.warn("No accessible Google Ads customers found:", JSON.stringify(customerData));
        }
      } catch (e) {
        console.error("Could not fetch customer info:", e);
      }

      const { error: updateError } = await supabase
        .from("platform_connections")
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          token_expires_at: expiresAt,
          is_connected: true,
          last_error: null,
          account_name: accountName,
          account_id: accountId,
          metadata: {
            scope: tokenData.scope,
            token_type: tokenData.token_type,
          },
        })
        .eq("id", connectionId);

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`);
      }
    } else if (platform === "meta_ads") {
      const appId = "1473709394207184";
      const appSecret = Deno.env.get("META_APP_SECRET")!;
      const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

      // Exchange code for short-lived token
      const tokenRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?` +
          new URLSearchParams({
            client_id: appId,
            client_secret: appSecret,
            redirect_uri: redirectUri,
            code,
          })
      );

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        throw new Error(tokenData.error.message || tokenData.error);
      }

      // Exchange for long-lived token
      let accessToken = tokenData.access_token;
      let expiresIn = tokenData.expires_in || 3600;

      try {
        const longRes = await fetch(
          `https://graph.facebook.com/v21.0/oauth/access_token?` +
            new URLSearchParams({
              grant_type: "fb_exchange_token",
              client_id: appId,
              client_secret: appSecret,
              fb_exchange_token: accessToken,
            })
        );
        const longData = await longRes.json();
        if (longData.access_token) {
          accessToken = longData.access_token;
          expiresIn = longData.expires_in || 5184000; // ~60 days
        }
      } catch (e) {
        console.warn("Could not exchange for long-lived token:", e);
      }

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // Discover ad accounts
      let accountName = null;
      let accountId = null;
      try {
        const acctRes = await fetch(
          `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
        );
        const acctData = await acctRes.json();
        if (acctData.data && acctData.data.length > 0) {
          const active = acctData.data.find((a: any) => a.account_status === 1) || acctData.data[0];
          accountId = active.id;
          accountName = active.name || `Meta Ads (${accountId})`;
        }
      } catch (e) {
        console.warn("Could not discover ad accounts:", e);
      }

      const { error: updateError } = await supabase
        .from("platform_connections")
        .update({
          access_token: accessToken,
          refresh_token: null, // Meta uses long-lived tokens, no refresh token
          token_expires_at: expiresAt,
          is_connected: true,
          last_error: null,
          account_name: accountName,
          account_id: accountId,
          metadata: {
            token_type: "bearer",
            long_lived: true,
          },
        })
        .eq("id", connectionId);

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`);
      }
    }

    // Extract client_id from the connection to redirect to the right page
    const { data: connData } = await supabase
      .from("platform_connections")
      .select("client_id")
      .eq("id", connectionId)
      .single();

    const clientPath = connData?.client_id
      ? `/clients/${connData.client_id}`
      : "/clients";

    return Response.redirect(
      `${frontendUrl}${clientPath}?oauth_success=${platform}`,
      302
    );
  } catch (e) {
    console.error("OAuth callback error:", e);

    // Update connection with error
    await supabase
      .from("platform_connections")
      .update({
        is_connected: false,
        last_error: e instanceof Error ? e.message : "Unknown error",
      })
      .eq("id", connectionId);

    return Response.redirect(
      `${frontendUrl}/clients?oauth_error=${encodeURIComponent(
        e instanceof Error ? e.message : "Unknown error"
      )}`,
      302
    );
  }
});
