

# Fix: Use Client Name Slugs for Share Links

The previous plan was approved but the code change was never applied. The `createToken` function in `ShareDialog.tsx` still inserts without providing a `token` value, so the database default (`encode(gen_random_bytes(32), 'hex')`) generates the long random strings you're seeing.

## Change

**File:** `src/components/clients/ShareDialog.tsx`

1. Add a `generateSlugToken` helper that converts `clientName` to a URL-safe slug and appends a random 4-digit number:
   - Lowercase, replace non-alphanumeric with hyphens, trim edges, cap at 40 chars
   - Append `-NNNN` (1000–9999)
   - Example: `"Black Steel Doors"` → `black-steel-doors-4829`

2. In the `createToken` function (line 71), pass the generated slug as `token` in the insert:
```typescript
const token = generateSlugToken(clientName);
const { error } = await supabase.from('client_share_tokens').insert({
  client_id: clientId,
  org_id: orgId,
  created_by: user?.id ?? null,
  token,
});
```

No database migration needed — the `token` column is `text` and the default is only used when no value is provided. Existing links continue to work.

