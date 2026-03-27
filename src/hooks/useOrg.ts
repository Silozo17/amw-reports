// Stable re-export — all consumers import from this path.
// Implementation lives in src/contexts/OrgContext.tsx.
export { OrgProvider, useOrg } from '@/contexts/OrgContext';
export type { Organisation, OrgMembership } from '@/contexts/OrgContext';
