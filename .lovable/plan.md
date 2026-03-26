

# Add Missing Currencies

## Current State
`CURRENCY_OPTIONS` in `src/types/database.ts` has 7 currencies: GBP, EUR, USD, PLN, CAD, AUD, NZD. Missing Danish Krone and many others.

## Where Currencies Appear (all already use `CURRENCY_OPTIONS` — single source of truth)
1. **`src/types/database.ts`** — definition + `getCurrencySymbol()`
2. **`src/pages/clients/ClientForm.tsx`** — dropdown on client creation
3. **`src/pages/clients/ClientDetail.tsx`** — inline currency picker
4. **`src/components/clients/ClientEditDialog.tsx`** — edit dialog dropdown
5. **`src/components/clients/ClientDashboard.tsx`** — display via `getCurrencySymbol()`
6. **`src/components/clients/PlatformMetricsCard.tsx`** — display via `getCurrencySymbol()`
7. **`src/components/clients/dashboard/PlatformSection.tsx`** — display via `getCurrencySymbol()`
8. **`src/pages/ClientPortal.tsx`** — portal display via `getCurrencySymbol()`

## Change — Single File Edit
**`src/types/database.ts`** — expand `CURRENCY_OPTIONS` to include all major world currencies, sorted alphabetically:

```
AED (د.إ), ARS (AR$), AUD (A$), BGN (лв), BRL (R$), CAD (C$),
CHF (CHF), CLP (CL$), CNY (¥), COP (CO$), CZK (Kč), DKK (kr),
EGP (E£), EUR (€), GBP (£), GEL (₾), HKD (HK$), HRK (kn),
HUF (Ft), IDR (Rp), ILS (₪), INR (₹), ISK (kr), JPY (¥),
KRW (₩), MAD (MAD), MXN (MX$), MYR (RM), NGN (₦), NOK (kr),
NZD (NZ$), PEN (S/.), PHP (₱), PKR (₨), PLN (zł), QAR (QR),
RON (lei), RUB (₽), SAR (SAR), SEK (kr), SGD (S$), THB (฿),
TRY (₺), TWD (NT$), UAH (₴), USD ($), UYU (UY$), VND (₫),
ZAR (R)
```

No other files need changing — they all import from this single source.

