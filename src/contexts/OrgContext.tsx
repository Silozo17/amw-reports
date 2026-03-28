import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Organisation } from '@/types/database';
import { ensureOrgMembership } from '@/lib/orgRecovery';

export type { Organisation } from '@/types/database';

export interface OrgMembership {
  id: string;
  org_id: string;
  user_id: string | null;
  role: 'owner' | 'manager';
  invited_email: string | null;
  accepted_at: string | null;
  created_at: string;
}

interface OrgContextValue {
  org: Organisation | null;
  orgId: string | null;
  orgRole: 'owner' | 'manager' | null;
  isOrgOwner: boolean;
  isLoading: boolean;
  refetchOrg: (overrideOrgId?: string) => Promise<void>;
  allMemberships: { org_id: string; role: string; org_name: string; org_logo: string | null }[];
  switchOrg: (newOrgId: string) => void;
}

const OrgContext = createContext<OrgContextValue | null>(null);

const SELECTED_ORG_KEY = 'amw_selected_org_id';

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [org, setOrg] = useState<Organisation | null>(null);
  const [orgRole, setOrgRole] = useState<'owner' | 'manager' | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [allMemberships, setAllMemberships] = useState<{ org_id: string; role: string; org_name: string; org_logo: string | null }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrg = useCallback(async (overrideOrgId?: string) => {
    if (!user) return;

    try {
      // Fetch ALL memberships for this user
      const { data: memberships, error: membershipsError } = await supabase
        .from('org_members')
        .select('org_id, role')
        .eq('user_id', user.id);

      let activeMemberships = memberships ?? [];

      // Recovery: if no memberships exist, use shared utility
      if (membershipsError || activeMemberships.length === 0) {
        const recoveredOrgId = await ensureOrgMembership(user);
        if (!recoveredOrgId) return;

        // Re-fetch memberships after recovery
        const { data: refreshed } = await supabase
          .from('org_members')
          .select('org_id, role')
          .eq('user_id', user.id);
        activeMemberships = refreshed ?? [];
      }

      // Fetch org details for all memberships
      const orgIds = activeMemberships.map(m => m.org_id);
      const { data: orgsData } = await supabase
        .from('organisations')
        .select('id, name, logo_url')
        .in('id', orgIds);

      const membershipList = activeMemberships.map(m => {
        const orgInfo = orgsData?.find(o => o.id === m.org_id);
        return {
          org_id: m.org_id,
          role: m.role,
          org_name: orgInfo?.name ?? 'Unknown',
          org_logo: orgInfo?.logo_url ?? null,
        };
      });
      setAllMemberships(membershipList);

      // Determine which org to select
      const savedOrgId = localStorage.getItem(SELECTED_ORG_KEY);
      const targetOrgId =
        overrideOrgId ??
        (savedOrgId && orgIds.includes(savedOrgId) ? savedOrgId : orgIds[0]);

      const selectedMembership = activeMemberships.find(m => m.org_id === targetOrgId) ?? activeMemberships[0];

      setOrgId(selectedMembership.org_id);
      setOrgRole(selectedMembership.role as 'owner' | 'manager');
      localStorage.setItem(SELECTED_ORG_KEY, selectedMembership.org_id);

      // Fetch full org data for the selected org
      const { data: orgData, error: orgError } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', selectedMembership.org_id)
        .single();

      if (orgError) {
        console.error('Failed to fetch organisation:', orgError);
        return;
      }

      setOrg(orgData as unknown as Organisation | null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const switchOrg = useCallback((newOrgId: string) => {
    localStorage.setItem(SELECTED_ORG_KEY, newOrgId);
    setIsLoading(true);
    fetchOrg(newOrgId);
  }, [fetchOrg]);

  useEffect(() => {
    if (!user) {
      setOrg(null);
      setOrgRole(null);
      setOrgId(null);
      setAllMemberships([]);
      setIsLoading(false);
      return;
    }

    fetchOrg();
  }, [user, fetchOrg]);

  return (
    <OrgContext.Provider
      value={{
        org,
        orgId,
        orgRole,
        isOrgOwner: orgRole === 'owner',
        isLoading,
        refetchOrg: fetchOrg,
        allMemberships,
        switchOrg,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) {
    // Return safe defaults during HMR or when rendered outside provider
    return {
      org: null,
      orgId: null,
      orgRole: null,
      isOrgOwner: false,
      isLoading: true,
      refetchOrg: async () => {},
      allMemberships: [],
      switchOrg: () => {},
    } as OrgContextValue;
  }
  return context;
}
