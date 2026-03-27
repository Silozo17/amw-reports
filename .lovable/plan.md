

# Add Quick Client Switcher to Client Detail Page

## What

Add a client selector dropdown next to the client name/back button on the client detail page, similar to the org switcher in the sidebar. Users can quickly swap between clients without navigating back to the client list.

## How

### 1. Create `src/components/clients/ClientSwitcher.tsx`
A Popover component that:
- Shows a `ChevronsUpDown` icon button next to the client name area
- Fetches all clients for the current org (`useOrg().orgId`)
- Displays a scrollable list with client logos/initials, company names
- Highlights the current client with a `Check` icon
- Includes a search/filter input at the top for quick filtering
- On click, navigates to `/clients/{selectedId}` via `useNavigate`
- Styled consistently with the org switcher pattern (Popover + button list)

### 2. Modify `src/pages/clients/ClientDetail.tsx`
- Import and render `<ClientSwitcher>` next to the client name (between the back button and client info, or after the client name)
- Pass `currentClientId={id}` and `orgId` as props
- The switcher replaces the need to click back → select new client

## Files Modified

| File | Change |
|---|---|
| `src/components/clients/ClientSwitcher.tsx` | New component — Popover with searchable client list |
| `src/pages/clients/ClientDetail.tsx` | Add `<ClientSwitcher>` next to client name in header |

