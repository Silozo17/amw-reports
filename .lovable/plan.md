

# Scope AI Analysis to Selected Period

## Problem
AI analysis is stored in a single React `useState` variable. When the user changes the month or timeframe, the stale analysis from the previous period remains visible. It should only display for the period it was generated for.

## Approach
Store analyses in a **keyed map** (`Map<string, { text: string; date: Date }>`) in `useClientDashboard`, keyed by a period identifier (e.g. `"3-2026"` or `"ytd-2026"`). When the user generates an analysis, it's saved under the current period key. When they switch months, the hook looks up the map — if an analysis exists for that period it's shown; if not, the AI analysis card is hidden and the button says "AI Analysis" (not "Refresh Analysis").

## Changes

### File: `src/hooks/useClientDashboard.ts`

1. Replace the single `aiAnalysis` / `aiAnalysisDate` state with a `Map`:
   ```typescript
   const [analysisMap, setAnalysisMap] = useState<Map<string, { text: string; date: Date }>>(new Map());
   ```

2. Build a period key from the current `selectedPeriod` (month + year, or include timeframe if applicable):
   ```typescript
   const periodKey = `${selectedPeriod.month}-${selectedPeriod.year}`;
   ```

3. Derive `aiAnalysis` and `aiAnalysisDate` from the map for the current period:
   ```typescript
   const currentAnalysis = analysisMap.get(periodKey);
   const aiAnalysis = currentAnalysis?.text ?? "";
   const aiAnalysisDate = currentAnalysis?.date ?? null;
   ```

4. In `handleAnalyse`, store the result under the current period key:
   ```typescript
   setAnalysisMap(prev => new Map(prev).set(periodKey, { text: data.analysis, date: new Date() }));
   ```

5. Keep returning `aiAnalysis` and `aiAnalysisDate` from the hook — no changes needed in `ClientDashboard.tsx` since the interface stays the same.

### No other files need changes
The `ClientDashboard.tsx` component already reads `aiAnalysis` and `aiAnalysisDate` from the hook and conditionally renders based on whether they have values. The map approach makes those values period-aware automatically.

### No database changes needed
Analyses remain ephemeral in-session state. If the user navigates away and back, they regenerate as needed.

