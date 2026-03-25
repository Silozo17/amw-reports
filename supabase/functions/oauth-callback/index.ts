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

// ── Meta Ads (Ads only) ──
async function handleMetaAds(supabase: any, code: string, connectionId: string, supabaseUrl: string) {
  const appId = "1473709394207184";
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

  // Discover ad accounts only
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
  const appId = "1473709394207184";
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

  // Discover pages with page-level access tokens
  const pages: Array<{ id: string; name: string; access_token?: string }> = [];
  try {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();
    console.log("Facebook pages discovery:", JSON.stringify(pagesData));
    if (pagesData.data?.length > 0) {
      for (const page of pagesData.data) {
        pages.push({ id: page.id, name: page.name || page.id, access_token: page.access_token });
      }
    }
  } catch (e) {
    console.warn("Could not discover pages:", e);
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
      metadata: { token_type: "bearer", long_lived: true, pages },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}

// ── Instagram (IG Business accounts via Facebook Pages) ──
async function handleInstagram(supabase: any, code: string, connectionId: string, supabaseUrl: string) {
  const appId = "1473709394207184";
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

  // Discover pages with linked Instagram Business accounts
  const igAccounts: Array<{ id: string; username: string; page_id: string; page_name: string; page_token: string }> = [];
  try {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${accessToken}`
    );
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
  } catch (e) {
    console.warn("Could not discover Instagram accounts:", e);
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

  // Discover ALL organization pages (NO ad accounts — pages only)
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
  try {
    const acctRes = await fetch("https://analyticsadmin.googleapis.com/v1beta/accounts", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const acctData = await acctRes.json();
    console.log("GA4 accounts:", JSON.stringify(acctData));
    if (acctData.accounts?.length > 0) {
      for (const acct of acctData.accounts) {
        const accountName = acct.name; // e.g. "accounts/123456"
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
      metadata: { scope: tokenData.scope, token_type: tokenData.token_type, properties },
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
  try {
    const acctRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const acctData = await acctRes.json();
    console.log("GBP accounts:", JSON.stringify(acctData));
    if (acctData.accounts?.length > 0) {
      for (const acct of acctData.accounts) {
        const locRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${acct.name}/locations?readMask=name,title`,
          { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
        );
        const locData = await locRes.json();
        if (locData.locations?.length > 0) {
          for (const loc of locData.locations) {
            const locId = loc.name; // e.g. "locations/123"
            locations.push({ id: locId, name: loc.title || locId });
          }
        }
      }
    }
  } catch (e) {
    console.error("Could not discover GBP locations:", e);
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
      metadata: { scope: tokenData.scope, token_type: tokenData.token_type, locations },
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
  try {
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const channelData = await channelRes.json();
    console.log("YouTube channels discovery:", JSON.stringify(channelData));
    if (channelData.items?.length > 0) {
      for (const ch of channelData.items) {
        channels.push({ id: ch.id, name: ch.snippet?.title || ch.id });
      }
    }
  } catch (e) {
    console.error("Could not discover YouTube channels:", e);
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
      is_connected: true,
      last_error: null,
      account_name: autoName,
      account_id: autoId,
      metadata: { scope: tokenData.scope, token_type: tokenData.token_type, channels },
    })
    .eq("id", connectionId);

  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
}
