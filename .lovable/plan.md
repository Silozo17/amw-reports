

# Fix AI Analysis Currency & Health Score Label Overflow

## Issue 1: AI Analysis uses wrong currency

The `analyze-client` edge function fetches only `company_name, services_subscribed` from the clients table. It never reads `preferred_currency`, so the AI prompt has no currency context and defaults to USD (`$`).

### Fix: `supabase/functions/analyze-client/index.ts`
- Change the client select to include `preferred_currency`: `"company_name, services_subscribed, preferred_currency"`
- Add currency context to the `dataContext` JSON: `currency: client.preferred_currency || "GBP"`
- Add a rule to the AI prompt: `"Always use ${currencySymbol} for any monetary values. Never use $ or USD unless that is the client's selected currency."`

## Issue 2: Health score label overflows inside the circle

The label text (e.g. "NEEDS ATTENTION") uses fixed `text-[10px]` inside a 128px SVG circle with no size constraints, causing overflow on longer labels.

### Fix: `src/components/clients/dashboard/HealthScore.tsx`
- On the label `<span>` (line 48), add `max-w-[80%] leading-tight` and reduce font to `text-[9px]` to ensure longer labels like "NEEDS ATTENTION" fit within the circular gauge
- Wrap the inner container div with `px-2` for breathing room

## Files to change
1. `supabase/functions/analyze-client/index.ts` — fetch and use `preferred_currency`
2. `src/components/clients/dashboard/HealthScore.tsx` — constrain label text inside circle

