

# Sync All AMW Media Org Connections

## What Needs Syncing

16 connections across 5 clients need a current-month sync (March 2026). AMW Media's 8 connections are already up to date.

## Execution

Invoke each platform's sync edge function with `month: 3, year: 2026` for each connection:

**Black Steel Doors (4):**
- `sync-google-ads` → `6f64df14`
- `sync-meta-ads` → `f6be43ec`
- `sync-facebook-page` → `6743b18a`
- `sync-instagram` → `9deab0d6`

**Blue Light Services (2):**
- `sync-facebook-page` → `2cd16d0b`
- `sync-instagram` → `748bf31d`

**Escape Campers (3):**
- `sync-meta-ads` → `7b11007c`
- `sync-facebook-page` → `c8744b3d`
- `sync-instagram` → `2e301a29`

**JR Stone (2):**
- `sync-facebook-page` → `77d4f31c`
- `sync-instagram` → `7cb7a2ed`

**Wheels VT (5):**
- `sync-meta-ads` → `a98bbb61`
- `sync-facebook-page` → `87d48dca`
- `sync-instagram` → `b1af5c99`
- `sync-tiktok-ads` → `730569b7`
- `sync-google-search-console` → `4adfd27e`

## Method

Call `supabase--curl_edge_functions` for each, passing `{ connection_id, month: 3, year: 2026 }`. Process sequentially to avoid rate limits.

No code changes required — operational action only.

