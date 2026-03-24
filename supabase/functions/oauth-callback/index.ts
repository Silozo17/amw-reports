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

  // TikTok uses "auth_code" param
  const authCode = code || url.searchParams.get("auth_code");

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

  if (error || !authCode) {
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
      await handleGoogleAds(supabase, authCode, connectionId, supabaseUrl);
    } else if (platform === "meta_ads") {
      await handleMetaAds(supabase, authCode, connectionId, supabaseUrl);
    } else if (platform === "tiktok") {
      await handleTikTok(supabase, authCode, connectionId);
    } else if (platform === "linkedin") {
      await handleLinkedIn(supabase, authCode, connectionId, supabaseUrl);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // Redirect to client page with pending selection flag
    const { data: connData } = await supabase
      .from("platform_connections")
      .select("client_id")
      .eq("id", connectionId)
      .single();

    const clientPath = connData?.client_id
      ? `/clients/${connData.client_id}`
      : "/clients";

    return Response.redirect(
      `${frontendUrl}${clientPath}?oauth_pending_selection=${connectionId}`,
      302
    );
  } catch (e) {
    console.error("OAuth callback error:", e);

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

// ── Google Ads ──
async function handleGoogleAds(supabase: any, code: string, connectionId: string, supabaseUrl: string) {
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

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  // Discover ALL accessible customer accounts
  const customers: Array<{ id: string; name: string }> = [];
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
    console.log("Google Ads customer discovery:", JSON.stringify(customerData));
    if (customerData.resourceNames?.length > 0) {
      // Fetch descriptive names for each customer
      for (const rn of customerData.resourceNames) {
        const custId = rn.replace("customers/", "");
        let descriptiveName = `Google Ads (${custId})`;
        try {
          const nameRes = await fetch(
            `https://googleads.googleapis.com/v20/customers/${custId}`,
            {
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                "developer-token": devToken || "",
                "login-customer-id": custId,
              },
            }
          );
          if (nameRes.ok) {
            const nameData = await nameRes.json();
            if (nameData.descriptiveName) {
              descriptiveName = nameData.descriptiveName;
            }
          }
        } catch (e) {
          console.warn(`Could not fetch name for customer ${custId}:`, e);
        }
        customers.push({ id: custId, name: descriptiveName });
      }
    }
  } catch (e) {
    console.error("Could not fetch customer info:", e);
  }

  // Store all accounts but do NOT auto-select
  const { error: updateError } = await supabase
    .from("platform_connections")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      token_expires_at: expiresAt,
      is_connected: true,
      last_error: null,
      account_name: null,
      account_id: null,
      metadata: { scope: tokenData.scope, token_type: tokenData.token_type, customers },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}

// ── Meta Ads (Facebook/Instagram) ──
async function handleMetaAds(supabase: any, code: string, connectionId: string, supabaseUrl: string) {
  const appId = "1473709394207184";
  const appSecret = Deno.env.get("META_APP_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

  // Exchange code for short-lived token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v25.0/oauth/access_token?` +
      new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code })
  );
  const tokenData = await tokenRes.json();
  if (tokenData.error) throw new Error(tokenData.error.message || tokenData.error);

  // Exchange for long-lived token
  let accessToken = tokenData.access_token;
  let expiresIn = tokenData.expires_in || 3600;

  try {
    const longRes = await fetch(
      `https://graph.facebook.com/v25.0/oauth/access_token?` +
        new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: accessToken })
    );
    const longData = await longRes.json();
    if (longData.access_token) {
      accessToken = longData.access_token;
      expiresIn = longData.expires_in || 5184000;
    }
  } catch (e) {
    console.warn("Could not exchange for long-lived token:", e);
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Discover ALL ad accounts
  const adAccounts: Array<{ id: string; name: string }> = [];
  try {
    const acctRes = await fetch(
      `https://graph.facebook.com/v25.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
    );
    const acctData = await acctRes.json();
    if (acctData.data?.length > 0) {
      for (const a of acctData.data) {
        adAccounts.push({ id: a.id, name: a.name || a.id });
      }
    }
  } catch (e) {
    console.warn("Could not discover ad accounts:", e);
  }

  // Discover ALL Facebook Pages and linked Instagram accounts
  const pages: Array<{ id: string; name: string; access_token?: string; instagram?: { id: string; username: string } }> = [];
  try {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();
    console.log("Meta pages discovery:", JSON.stringify(pagesData));
    if (pagesData.data?.length > 0) {
      for (const page of pagesData.data) {
        const entry: any = { id: page.id, name: page.name || page.id };
        if (page.access_token) entry.access_token = page.access_token;
        if (page.instagram_business_account) {
          entry.instagram = {
            id: page.instagram_business_account.id,
            username: page.instagram_business_account.username || "",
          };
        }
        pages.push(entry);
      }
    }
  } catch (e) {
    console.warn("Could not discover pages:", e);
  }

  // Store all discovered assets but do NOT auto-select
  const { error: updateError } = await supabase
    .from("platform_connections")
    .update({
      access_token: accessToken,
      refresh_token: null,
      token_expires_at: expiresAt,
      is_connected: true,
      last_error: null,
      account_name: null,
      account_id: null,
      metadata: { token_type: "bearer", long_lived: true, ad_accounts: adAccounts, pages },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}

// ── TikTok ──
async function handleTikTok(supabase: any, authCode: string, connectionId: string) {
  const appId = Deno.env.get("TIKTOK_APP_ID")!;
  const appSecret = Deno.env.get("TIKTOK_APP_SECRET")!;

  const tokenRes = await fetch(
    "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, secret: appSecret, auth_code: authCode }),
    }
  );
  const tokenData = await tokenRes.json();
  console.log("TikTok token response:", JSON.stringify(tokenData));

  if (tokenData.code !== 0) {
    throw new Error(tokenData.message || "TikTok token exchange failed");
  }

  const accessToken = tokenData.data.access_token;
  const advertiserIds = tokenData.data.advertiser_ids || [];

  // Discover ALL advertiser accounts
  const advertisers: Array<{ id: string; name: string }> = [];

  if (advertiserIds.length > 0) {
    try {
      const infoRes = await fetch(
        `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=["${advertiserIds.join('","')}"]`,
        { headers: { "Access-Token": accessToken } }
      );
      const infoData = await infoRes.json();
      if (infoData.code === 0 && infoData.data?.list) {
        for (const adv of infoData.data.list) {
          advertisers.push({ id: String(adv.advertiser_id), name: adv.advertiser_name || String(adv.advertiser_id) });
        }
      }
    } catch (e) {
      console.warn("Could not fetch TikTok advertiser info:", e);
      for (const id of advertiserIds) {
        advertisers.push({ id: String(id), name: `TikTok Ads (${id})` });
      }
    }
  }

  // Store all but do NOT auto-select
  const { error: updateError } = await supabase
    .from("platform_connections")
    .update({
      access_token: accessToken,
      refresh_token: null,
      token_expires_at: new Date(Date.now() + 86400 * 1000).toISOString(),
      is_connected: true,
      last_error: null,
      account_name: null,
      account_id: null,
      metadata: { advertisers, token_type: "bearer" },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}

// ── LinkedIn ──
async function handleLinkedIn(supabase: any, code: string, connectionId: string, supabaseUrl: string) {
  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID")!;
  const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error);
  }

  const accessToken = tokenData.access_token;
  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  // Discover ALL ad accounts
  const adAccounts: Array<{ id: string; name: string }> = [];

  try {
    const adRes = await fetch(
      "https://api.linkedin.com/rest/adAccounts?q=search&search=(status:(values:List(ACTIVE)))&count=50",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": "202401",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );
    const adData = await adRes.json();
    console.log("LinkedIn ad accounts:", JSON.stringify(adData));
    if (adData.elements?.length > 0) {
      for (const el of adData.elements) {
        const adId = String(el.id);
        adAccounts.push({ id: adId, name: el.name || adId });
      }
    }
  } catch (e) {
    console.warn("Could not discover LinkedIn ad accounts:", e);
  }

  // Discover ALL organization pages
  const organizations: Array<{ id: string; name: string }> = [];
  try {
    const orgRes = await fetch(
      "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,localizedName)))",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": "202401",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );
    const orgData = await orgRes.json();
    console.log("LinkedIn organizations:", JSON.stringify(orgData));
    if (orgData.elements?.length > 0) {
      for (const el of orgData.elements) {
        const org = el["organization~"];
        if (org) {
          organizations.push({ id: String(org.id), name: org.localizedName || String(org.id) });
        }
      }
    }
  } catch (e) {
    console.warn("Could not discover LinkedIn organizations:", e);
  }

  // Store all but do NOT auto-select
  const { error: updateError } = await supabase
    .from("platform_connections")
    .update({
      access_token: accessToken,
      refresh_token: tokenData.refresh_token || null,
      token_expires_at: expiresAt,
      is_connected: true,
      last_error: null,
      account_name: null,
      account_id: null,
      metadata: { ad_accounts: adAccounts, organizations, token_type: "bearer" },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}
