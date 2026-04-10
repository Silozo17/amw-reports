

# Fix: LinkedIn Organization Discovery in OAuth Callback

## Root Cause
The edge function logs show the exact error:
```
LinkedIn organizations: {"status":400,"code":"ILLEGAL_ARGUMENT","message":"projection parameter is not allowed for this endpoint"}
```

Two issues in `supabase/functions/oauth-callback/index.ts` (lines 680-704):

1. **`projection` parameter is not allowed** on the `organizationAcls` endpoint in newer API versions. The `organization~` decoration syntax is rejected.
2. **API version is `202503`** (line 687) — should be `202603`.

## Fix (single file: `supabase/functions/oauth-callback/index.ts`)

Replace lines 680-704 with a two-step approach:

**Step 1** — Call `organizationAcls?q=roleAssignee&role=ADMINISTRATOR` WITHOUT projection. This returns elements containing `organization` URNs like `urn:li:organization:12345`.

**Step 2** — Extract the org ID from each URN, then fetch `/rest/organizations/{id}` individually to get the `localizedName`.

**Also**: Update `LinkedIn-Version` from `202503` to `202603`.

```typescript
// Step 1: Get org URNs the user administers
const orgRes = await fetch(
  "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR",
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": "202603",
      "X-Restli-Protocol-Version": "2.0.0",
    },
  }
);
const orgData = await orgRes.json();

// Step 2: Fetch each org's name
for (const el of orgData.elements || []) {
  const orgUrn = el.organization; // "urn:li:organization:12345"
  if (!orgUrn) continue;
  const orgId = orgUrn.split(":").pop();
  let name = orgId;
  try {
    const detailRes = await fetch(
      `https://api.linkedin.com/rest/organizations/${orgId}`,
      { headers: { Authorization: `Bearer ${accessToken}`, "LinkedIn-Version": "202603", "X-Restli-Protocol-Version": "2.0.0" } }
    );
    if (detailRes.ok) {
      const detail = await detailRes.json();
      name = detail.localizedName || orgId;
    }
  } catch {}
  organizations.push({ id: orgId, name });
}
```

No other files need changes. After deploy, users reconnect LinkedIn and their organisations will appear in the account picker.

