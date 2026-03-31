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
    } else if (platform === "facebook") {
      await handleFacebook(supabase, authCode, connectionId, supabaseUrl);
    } else if (platform === "instagram") {
      await handleInstagram(supabase, authCode, connectionId, supabaseUrl);
    } else if (platform === "tiktok") {
      await handleTikTok(supabase, authCode, connectionId);
    } else if (platform === "tiktok_ads") {
      await handleTikTokAds(supabase, authCode, connectionId);
    } else if (platform === "linkedin") {
      await handleLinkedIn(supabase, authCode, connectionId, supabaseUrl);
    } else if (platform === "google_search_console") {
      await handleGoogleSearchConsole(supabase, authCode, connectionId, supabaseUrl);
    } else if (platform === "google_analytics") {
      await handleGoogleAnalytics(supabase, authCode, connectionId, supabaseUrl);
    } else if (platform === "google_business_profile") {
      await handleGoogleBusinessProfile(supabase, authCode, connectionId, supabaseUrl);
    } else if (platform === "youtube") {
      await handleYouTube(supabase, authCode, connectionId, supabaseUrl);
    } else if (platform === "pinterest") {
      await handlePinterest(supabase, authCode, connectionId, supabaseUrl);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // Re-fetch the connection to determine redirect behaviour
    const { data: connData } = await supabase
      .from("platform_connections")
      .select("client_id, account_id, last_error, metadata")
      .eq("id", connectionId)
      .single();

    const clientPath = connData?.client_id
      ? `/clients/${connData.client_id}`
      : "/clients";

    // If auto-selected (account_id set), redirect with success flag
    if (connData?.account_id) {
      return Response.redirect(
        `${frontendUrl}${clientPath}?oauth_connected=${connectionId}`,
        302
      );
    }

    // If discovery failed, redirect with error
    if (connData?.last_error) {
      return Response.redirect(
        `${frontendUrl}${clientPath}?oauth_error=${encodeURIComponent(connData.last_error)}`,
        302
      );
    }

    // Otherwise open the picker (multiple assets to choose from)
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
      const allCustIds = customerData.resourceNames.map((rn: string) => rn.replace("customers/", ""));

      // Step 1: Find manager accounts by trying to query customer_client from each
      // A manager account can list its sub-accounts via GAQL
      const managerIds: string[] = [];
      const resolvedNames = new Map<string, string>();

      for (const custId of allCustIds) {
        try {
          const gaqlRes = await fetch(
            `https://googleads.googleapis.com/v20/customers/${custId}/googleAds:searchStream`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                "developer-token": devToken || "",
                "login-customer-id": custId,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                query: "SELECT customer_client.client_customer, customer_client.descriptive_name, customer_client.manager, customer_client.level FROM customer_client WHERE customer_client.level <= 1",
              }),
            }
          );

          if (gaqlRes.ok) {
            const gaqlData = await gaqlRes.json();
            // This is a manager account
            managerIds.push(custId);

            // Extract names for all sub-accounts (and the manager itself at level 0)
            if (Array.isArray(gaqlData) && gaqlData.length > 0) {
              for (const batch of gaqlData) {
                if (batch.results) {
                  for (const row of batch.results) {
                    const cc = row.customerClient;
                    if (cc?.clientCustomer) {
                      const subId = cc.clientCustomer.replace("customers/", "");
                      if (cc.descriptiveName) {
                        resolvedNames.set(subId, cc.descriptiveName);
                      }
                    }
                  }
                }
              }
            }
          } else {
            // Not a manager — try direct fetch for its own name
            try {
              const directRes = await fetch(
                `https://googleads.googleapis.com/v20/customers/${custId}`,
                {
                  headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                    "developer-token": devToken || "",
                    "login-customer-id": custId,
                  },
                }
              );
              if (directRes.ok) {
                const directData = await directRes.json();
                if (directData.descriptiveName) {
                  resolvedNames.set(custId, directData.descriptiveName);
                }
              }
            } catch (e) {
              console.warn(`Direct fetch failed for ${custId}:`, e);
            }
          }
        } catch (e) {
          console.warn(`GAQL query failed for ${custId}:`, e);
        }
      }

      // Build the final list — skip manager accounts, show only leaf/client accounts
      for (const custId of allCustIds) {
        // If this ID was identified as a manager, still include it but mark it
        const name = resolvedNames.get(custId) || `Google Ads (${custId})`;
        customers.push({ id: custId, name });
      }

      console.log("Resolved Google Ads customers:", JSON.stringify(customers));
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

// ── Meta Ads (Ads only) ──
async function handleMetaAds(supabase: any, code: string, connectionId: string, supabaseUrl: string) {
  const appId = Deno.env.get("META_APP_ID")!;
  const appSecret = Deno.env.get("META_APP_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

  const tokenRes = await fetch(
    `https://graph.facebook.com/v25.0/oauth/access_token?` +
      new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code })
  );
  const tokenData = await tokenRes.json();
  if (tokenData.error) throw new Error(tokenData.error.message || tokenData.error);

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

  // Discover ad accounts only (with pagination)
  const adAccounts: Array<{ id: string; name: string }> = [];
  try {
    let nextUrl: string | null = `https://graph.facebook.com/v25.0/me/adaccounts?fields=id,name,account_status&limit=100&access_token=${accessToken}`;
    while (nextUrl) {
      const acctRes = await fetch(nextUrl);
      const acctData = await acctRes.json();
      if (acctData.data?.length > 0) {
        for (const a of acctData.data) {
          adAccounts.push({ id: a.id, name: a.name || a.id });
        }
      }
      nextUrl = acctData.paging?.next || null;
    }
  } catch (e) {
    console.warn("Could not discover ad accounts:", e);
  }

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
      metadata: { token_type: "bearer", long_lived: true, ad_accounts: adAccounts },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}

// ── Facebook (Pages only) ──
async function handleFacebook(supabase: any, code: string, connectionId: string, supabaseUrl: string) {
  const appId = Deno.env.get("META_APP_ID") || "1473709394207184";
  const appSecret = Deno.env.get("META_APP_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

  const tokenRes = await fetch(
    `https://graph.facebook.com/v25.0/oauth/access_token?` +
      new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code })
  );
  const tokenData = await tokenRes.json();
  if (tokenData.error) throw new Error(tokenData.error.message || tokenData.error);

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

  // Discover pages with page-level access tokens (with pagination)
  const pages: Array<{ id: string; name: string; access_token?: string }> = [];
  try {
    let nextUrl: string | null = `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token&limit=100&access_token=${accessToken}`;
    while (nextUrl) {
      const pagesRes = await fetch(nextUrl);
      const pagesData = await pagesRes.json();
      console.log("Facebook pages discovery:", JSON.stringify(pagesData));
      if (pagesData.data?.length > 0) {
        for (const page of pagesData.data) {
          pages.push({ id: page.id, name: page.name || page.id, access_token: page.access_token });
        }
      }
      nextUrl = pagesData.paging?.next || null;
    }
  } catch (e) {
    console.warn("Could not discover pages:", e);
  }

  // Page-level tokens are permanent — set token_expires_at to null
  const { error: updateError } = await supabase
    .from("platform_connections")
    .update({
      access_token: accessToken,
      refresh_token: null,
      token_expires_at: null,
      is_connected: true,
      last_error: null,
      account_name: null,
      account_id: null,
      metadata: { token_type: "bearer", long_lived: true, pages },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}

// ── Instagram (IG Business accounts via Facebook Pages) ──
async function handleInstagram(supabase: any, code: string, connectionId: string, supabaseUrl: string) {
  const appId = Deno.env.get("META_APP_ID") || "1473709394207184";
  const appSecret = Deno.env.get("META_APP_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

  const tokenRes = await fetch(
    `https://graph.facebook.com/v25.0/oauth/access_token?` +
      new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code })
  );
  const tokenData = await tokenRes.json();
  if (tokenData.error) throw new Error(tokenData.error.message || tokenData.error);

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

  // Discover pages with linked Instagram Business accounts (with pagination)
  const igAccounts: Array<{ id: string; username: string; page_id: string; page_name: string; page_token: string }> = [];
  try {
    let nextUrl: string | null = `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100&access_token=${accessToken}`;
    while (nextUrl) {
      const pagesRes = await fetch(nextUrl);
      const pagesData = await pagesRes.json();
      console.log("Instagram discovery via pages:", JSON.stringify(pagesData));
      if (pagesData.data?.length > 0) {
        for (const page of pagesData.data) {
          if (page.instagram_business_account) {
            igAccounts.push({
              id: page.instagram_business_account.id,
              username: page.instagram_business_account.username || "",
              page_id: page.id,
              page_name: page.name || page.id,
              page_token: page.access_token,
            });
          }
        }
      }
      nextUrl = pagesData.paging?.next || null;
    }
  } catch (e) {
    console.warn("Could not discover Instagram accounts:", e);
  }

  // Page-level tokens (used for IG) are permanent — set token_expires_at to null
  const { error: updateError } = await supabase
    .from("platform_connections")
    .update({
      access_token: accessToken,
      refresh_token: null,
      token_expires_at: null,
      is_connected: true,
      last_error: null,
      account_name: null,
      account_id: null,
      metadata: { token_type: "bearer", long_lived: true, ig_accounts: igAccounts },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}

// ── TikTok (Login Kit v2 — organic content) ──
async function handleTikTok(supabase: any, authCode: string, connectionId: string) {
  const clientKey = Deno.env.get("TIKTOK_APP_ID")!;
  const clientSecret = Deno.env.get("TIKTOK_APP_SECRET")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

  // Login Kit v2 token exchange
  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code: authCode,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();
  console.log("TikTok Login Kit v2 token response:", JSON.stringify(tokenData));

  if (tokenData.error || !tokenData.access_token) {
    throw new Error(
      tokenData.error_description || tokenData.error || "TikTok token exchange failed"
    );
  }

  const accessToken = tokenData.access_token;
  const openId = tokenData.open_id || "";
  const expiresIn = tokenData.expires_in || 86400;
  const refreshToken = tokenData.refresh_token || null;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Fetch user info to get display name
  let displayName = "TikTok User";
  try {
    const userRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count,avatar_url",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const userData = await userRes.json();
    console.log("TikTok user info:", JSON.stringify(userData));
    if (userData.data?.user?.display_name) {
      displayName = userData.data.user.display_name;
    }
  } catch (e) {
    console.warn("Could not fetch TikTok user info:", e);
  }

  // TikTok Login Kit returns a single user — auto-select as the account
  const { error: updateError } = await supabase
    .from("platform_connections")
    .update({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
      is_connected: true,
      last_error: null,
      account_id: openId,
      account_name: displayName,
      metadata: { open_id: openId, token_type: "bearer", accounts: [{ id: openId, name: displayName }] },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}

// ── TikTok Ads (Business API — long-lived tokens) ──
async function handleTikTokAds(supabase: any, authCode: string, connectionId: string) {
  const appId = Deno.env.get("TIKTOK_BUSINESS_APP_ID")!;
  const appSecret = Deno.env.get("TIKTOK_BUSINESS_APP_SECRET")!;

  // Exchange auth code for access token via Business API
  const tokenRes = await fetch("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: appId,
      secret: appSecret,
      auth_code: authCode,
    }),
  });

  const tokenData = await tokenRes.json();
  console.log("TikTok Business API token response:", JSON.stringify(tokenData));

  if (tokenData.code !== 0 || !tokenData.data?.access_token) {
    throw new Error(
      tokenData.message || "TikTok Business API token exchange failed"
    );
  }

  const accessToken = tokenData.data.access_token;
  const advertiserIds: string[] = tokenData.data.advertiser_ids || [];

  // Discover advertiser accounts with names
  const adAccounts: Array<{ id: string; name: string }> = [];
  if (advertiserIds.length > 0) {
    try {
      const advUrl = new URL("https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/");
      advUrl.searchParams.set("app_id", appId);
      advUrl.searchParams.set("secret", appSecret);
      advUrl.searchParams.set("access_token", accessToken);

      const advRes = await fetch(advUrl.toString(), {
        headers: { "Access-Token": accessToken },
      });
      const advData = await advRes.json();
      console.log("TikTok advertiser discovery:", JSON.stringify(advData));

      if (advData.code === 0 && advData.data?.list) {
        for (const adv of advData.data.list) {
          adAccounts.push({
            id: String(adv.advertiser_id),
            name: adv.advertiser_name || `TikTok Ads (${adv.advertiser_id})`,
          });
        }
      }
    } catch (e) {
      console.warn("Could not discover TikTok advertiser accounts:", e);
      // Fall back to raw IDs
      for (const id of advertiserIds) {
        adAccounts.push({ id: String(id), name: `TikTok Ads (${id})` });
      }
    }
  }

  // Auto-select if exactly one account
  const autoSelect = adAccounts.length === 1;

  const { error: updateError } = await supabase
    .from("platform_connections")
    .update({
      access_token: accessToken,
      refresh_token: null,
      token_expires_at: null, // Business API tokens are long-lived
      is_connected: true,
      last_error: null,
      account_name: autoSelect ? adAccounts[0].name : null,
      account_id: autoSelect ? adAccounts[0].id : null,
      metadata: { token_type: "bearer", long_lived: true, ad_accounts: adAccounts },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}

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

  // Discover ALL organization pages (NO ad accounts — pages only)
  const organizations: Array<{ id: string; name: string }> = [];
  try {
    const orgRes = await fetch(
      "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,localizedName)))",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": "202503",
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

  // Store organizations only — no ad accounts
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
      metadata: { organizations, token_type: "bearer" },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}

// ── Google Search Console ──
async function handleGoogleSearchConsole(supabase: any, code: string, connectionId: string, supabaseUrl: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json();
  if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  // Discover verified sites
  const sites: Array<{ id: string; name: string }> = [];
  try {
    const sitesRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const sitesData = await sitesRes.json();
    console.log("GSC sites discovery:", JSON.stringify(sitesData));
    if (sitesData.siteEntry?.length > 0) {
      for (const site of sitesData.siteEntry) {
        sites.push({ id: site.siteUrl, name: site.siteUrl });
      }
    }
  } catch (e) {
    console.error("Could not discover GSC sites:", e);
  }

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
      metadata: { scope: tokenData.scope, token_type: tokenData.token_type, sites },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}

// ── Google Analytics (GA4) ──
async function handleGoogleAnalytics(supabase: any, code: string, connectionId: string, supabaseUrl: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json();
  if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  // Discover GA4 properties
  const properties: Array<{ id: string; name: string }> = [];
  let discoveryError: string | null = null;
  try {
    const acctRes = await fetch("https://analyticsadmin.googleapis.com/v1beta/accounts", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const acctData = await acctRes.json();
    console.log("GA4 accounts:", JSON.stringify(acctData));

    if (!acctRes.ok) {
      if (acctData.error?.status === "PERMISSION_DENIED" || acctRes.status === 403) {
        discoveryError = "Google Analytics Admin API is not enabled. Please enable it in your Google Cloud Console and retry.";
      } else {
        discoveryError = `Google Analytics API error: ${acctData.error?.message || acctRes.statusText}`;
      }
      console.error("GA4 discovery error:", discoveryError);
    } else if (acctData.accounts?.length > 0) {
      for (const acct of acctData.accounts) {
        const accountName = acct.name;
        const propsRes = await fetch(
          `https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:${accountName}`,
          { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
        );
        const propsData = await propsRes.json();
        if (propsData.properties?.length > 0) {
          for (const prop of propsData.properties) {
            const propId = prop.name.replace("properties/", "");
            properties.push({ id: propId, name: prop.displayName || propId });
          }
        }
      }
    }
  } catch (e) {
    console.error("Could not discover GA4 properties:", e);
    discoveryError = e instanceof Error ? e.message : "Failed to discover GA4 properties";
  }

  // Auto-select if exactly one property
  const autoName = properties.length === 1 ? properties[0].name : null;
  const autoId = properties.length === 1 ? properties[0].id : null;

  const { error: updateError } = await supabase
    .from("platform_connections")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      token_expires_at: expiresAt,
      is_connected: discoveryError ? false : true,
      last_error: discoveryError,
      account_name: autoName,
      account_id: autoId,
      metadata: { scope: tokenData.scope, token_type: tokenData.token_type, properties, discovery_error: discoveryError },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}

// ── Google Business Profile ──
async function handleGoogleBusinessProfile(supabase: any, code: string, connectionId: string, supabaseUrl: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json();
  if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  // Discover business locations
  const locations: Array<{ id: string; name: string }> = [];
  let discoveryError: string | null = null;
  try {
    const acctRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const acctData = await acctRes.json();
    console.log("GBP accounts:", JSON.stringify(acctData));

    if (!acctRes.ok) {
      if (acctRes.status === 429) {
        discoveryError = "My Business Account Management API has 0 quota. Please request GBP API access from Google (https://docs.google.com/forms/d/e/1FAIpQLSf6sFkVvMHASmDgJlCQ4LmCTODMJkLOmBNfCtKNDm_4CanCRg/viewform) before connecting.";
      } else if (acctData.error?.status === "PERMISSION_DENIED" || acctRes.status === 403) {
        discoveryError = "My Business Account Management API is not enabled. Please enable it in your Google Cloud Console and retry.";
      } else {
        discoveryError = `Google Business Profile API error (${acctRes.status}): ${acctData.error?.message || acctRes.statusText}`;
      }
      console.error("GBP discovery error:", discoveryError);
    } else if (acctData.accounts?.length > 0) {
      for (const acct of acctData.accounts) {
        const locRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${acct.name}/locations?readMask=name,title`,
          { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
        );
        const locData = await locRes.json();
        console.log(`GBP locations for ${acct.name}:`, JSON.stringify(locData));

        if (!locRes.ok) {
          if (locRes.status === 403 || locData.error?.status === "PERMISSION_DENIED") {
            discoveryError = "My Business Business Information API is not enabled. Please enable it in your Google Cloud Console.";
          } else if (locRes.status === 429) {
            discoveryError = "Business Information API quota exceeded. Please request GBP API access from Google.";
          } else {
            discoveryError = `Failed to fetch locations (${locRes.status}): ${locData.error?.message || locRes.statusText}`;
          }
          console.error("GBP location discovery error:", discoveryError);
          break;
        }

        if (locData.locations?.length > 0) {
          for (const loc of locData.locations) {
            const locId = loc.name;
            locations.push({ id: locId, name: loc.title || locId });
          }
        }
      }
    }
  } catch (e) {
    console.error("Could not discover GBP locations:", e);
    discoveryError = e instanceof Error ? e.message : "Failed to discover GBP locations";
  }

  // Auto-select if exactly one location
  const autoName = locations.length === 1 ? locations[0].name : null;
  const autoId = locations.length === 1 ? locations[0].id : null;

  const { error: updateError } = await supabase
    .from("platform_connections")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      token_expires_at: expiresAt,
      is_connected: discoveryError ? false : true,
      last_error: discoveryError,
      account_name: autoName,
      account_id: autoId,
      metadata: { scope: tokenData.scope, token_type: tokenData.token_type, locations, discovery_error: discoveryError },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}

// ── YouTube ──
async function handleYouTube(supabase: any, code: string, connectionId: string, supabaseUrl: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json();
  if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  // Discover YouTube channels
  const channels: Array<{ id: string; name: string }> = [];
  let discoveryError: string | null = null;
  try {
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const channelData = await channelRes.json();
    console.log("YouTube channels discovery:", JSON.stringify(channelData));

    if (!channelRes.ok) {
      // Handle API errors explicitly (e.g. SERVICE_DISABLED / 403)
      if (channelData.error?.errors?.[0]?.reason === "accessNotConfigured") {
        discoveryError = "YouTube Data API v3 is not enabled. Please enable it in your Google Cloud Console and retry.";
      } else {
        discoveryError = `YouTube API error: ${channelData.error?.message || channelRes.statusText}`;
      }
      console.error("YouTube discovery error:", discoveryError);
    } else if (channelData.items?.length > 0) {
      for (const ch of channelData.items) {
        channels.push({ id: ch.id, name: ch.snippet?.title || ch.id });
      }
    }
  } catch (e) {
    console.error("Could not discover YouTube channels:", e);
    discoveryError = e instanceof Error ? e.message : "Failed to discover YouTube channels";
  }

  // Auto-select if exactly one channel (same pattern as TikTok)
  const autoName = channels.length === 1 ? channels[0].name : null;
  const autoId = channels.length === 1 ? channels[0].id : null;

  const { error: updateError } = await supabase
    .from("platform_connections")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      token_expires_at: expiresAt,
      is_connected: discoveryError ? false : true,
      last_error: discoveryError,
      account_name: autoName,
      account_id: autoId,
      metadata: { scope: tokenData.scope, token_type: tokenData.token_type, channels, discovery_error: discoveryError },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}

// ── Pinterest ──
async function handlePinterest(supabase: any, code: string, connectionId: string, supabaseUrl: string) {
  const appId = "1556588";
  const appSecret = Deno.env.get("PINTEREST_APP_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;
  const basicAuth = btoa(`${appId}:${appSecret}`);

  const tokenRes = await fetch("https://api.pinterest.com/v5/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();
  console.log("Pinterest token response:", JSON.stringify(tokenData));
  if (!tokenRes.ok || tokenData.code) {
    throw new Error(tokenData.message || `Pinterest token exchange failed (${tokenRes.status})`);
  }

  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token || null;
  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 2592000) * 1000).toISOString();

  // Fetch user account info
  let username = "Pinterest User";
  let accountId = "";
  try {
    const userRes = await fetch("https://api.pinterest.com/v5/user_account", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userRes.json();
    console.log("Pinterest user account:", JSON.stringify(userData));
    username = userData.username || userData.business_name || "Pinterest User";
    accountId = userData.username || "";
  } catch (e) {
    console.warn("Could not fetch Pinterest user info:", e);
  }

  // Pinterest returns a single user account — auto-select
  const { error: updateError } = await supabase
    .from("platform_connections")
    .update({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
      is_connected: true,
      last_error: null,
      account_id: accountId,
      account_name: username,
      metadata: { token_type: "bearer", accounts: [{ id: accountId, name: username }] },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}
