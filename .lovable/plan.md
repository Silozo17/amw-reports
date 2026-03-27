

# Scroll to Top on Navigation

## Problem
When navigating between pages, the scroll position persists from the previous page instead of resetting to the top.

## Solution
Create a `ScrollToTop` component that listens to `useLocation()` changes and calls `window.scrollTo(0, 0)` on every route change. Place it inside `BrowserRouter` in `App.tsx`.

## Files

| File | Change |
|---|---|
| `src/components/ScrollToTop.tsx` | Create component: uses `useEffect` + `useLocation` to scroll to top on pathname change |
| `src/App.tsx` | Import and render `<ScrollToTop />` inside `<BrowserRouter>`, before `<AuthProvider>` |

