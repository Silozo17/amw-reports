

## Fix: ConnectionDialog Insert Failing Due to Column-Level Grant

### Problem
The `ConnectionDialog.tsx` insert query uses `.select('*')` on line 54, which attempts to return all columns including `access_token` and `refresh_token` — columns revoked from the `authenticated` role in the earlier security migration. This causes the insert to fail silently.

### Solution
Replace `.select('*')` with the explicit safe column list, matching the pattern already applied to all other `platform_connections` queries.

### File to change

**`src/components/clients/ConnectionDialog.tsx`** — line 54:
```
.select('*')
```
→
```
.select('id, client_id, platform, account_name, account_id, is_connected, last_sync_at, last_sync_status, last_error, metadata, token_expires_at, created_at, updated_at')
```

### Risk
None — the returned data is only used to pass to `triggerOAuth()`, which only reads `conn.id` and `conn.platform`. No other fields are needed.

