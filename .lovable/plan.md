

# Prettier Share Link Tokens

## What Changes

Currently, share tokens are random UUIDs like `a3f8b2c1-5d9e-4a7b-b2e1-9c3f4d5a6e7b`, producing URLs like:
```
https://amw-reports.lovable.app/portal/a3f8b2c1-5d9e-4a7b-b2e1-9c3f4d5a6e7b
```

After this change, tokens will look like:
```
https://amw-reports.lovable.app/portal/black-steel-doors-4829
```

If a second link is created for the same client, it gets a different random suffix:
```
https://amw-reports.lovable.app/portal/black-steel-doors-7156
```

## Implementation

### 1. Update `ShareDialog.tsx` — generate slug-based token on the frontend

In the `createToken` function, before inserting:
- Take `clientName`, lowercase it, replace non-alphanumeric chars with hyphens, trim leading/trailing hyphens, truncate to ~40 chars
- Append a random 4-digit number (1000–9999)
- Pass this as the `token` value in the insert instead of relying on the database default

### 2. Update `validate_share_token` database function

No changes needed — it already matches on the `token` text column regardless of format.

### 3. No migration needed

The `token` column is already `text` with a UUID default. Providing an explicit value on insert overrides the default. Existing UUID-based tokens continue to work.

## Files Modified

| File | Change |
|---|---|
| `src/components/clients/ShareDialog.tsx` | Generate slug from `clientName` + 4-digit random suffix, pass as `token` on insert |

