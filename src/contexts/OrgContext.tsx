import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Organisation {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  heading_font: string | null;
  body_font: string | null;
  report_settings: { show_logo: boolean; show_ai_insights: boolean; report_accent_color: string | null } | null;
  button_color: string | null;
  button_text_color: string | null;
  text_on_dark: string | null;
  text_on_light: string | null;
  show_org_name: boolean;
  chart_color_1: string | null;
  chart_color_2: string | null;
  chart_color_3: string | null;
  chart_color_4: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

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

      // Recovery: if no memberships exist, try to link to profile.org_id or create new org
      if (membershipsError || activeMemberships.length === 0) {
        // Check if profile has an org_id already set
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('user_id', user.id)
          .single();

        if (profile?.org_id) {
          // Link user to existing org as manager
          await supabase.from('org_members').insert({
            org_id: profile.org_id,
            user_id: user.id,
            role: 'manager',
            accepted_at: new Date().toISOString(),
          });
          activeMemberships = [{ org_id: profile.org_id, role: 'manager' }];
          
        } else {
          // No profile org_id — create a brand new org
          const orgName =
            user.user_metadata?.company_name ||
            user.user_metadata?.full_name ||
            user.email ||
            'My Workspace';

          const { data: newOrg, error: orgError } = await supabase
            .from('organisations')
            .insert({
              name: orgName,
              slug: orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
              created_by: user.id,
            })
            .select('id')
            .single();

          if (orgError || !newOrg) {
            console.error('Failed to recover org:', orgError);
            return;
          }

          await supabase.from('org_members').insert({
            org_id: newOrg.id,
            user_id: user.id,
            role: 'owner',
            accepted_at: new Date().toISOString(),
          });

          await supabase
            .from('profiles')
            .update({ org_id: newOrg.id })
            .eq('user_id', user.id);

          // Assign starter plan
          const { data: starterPlan } = await supabase
            .from('subscription_plans')
            .select('id')
            .eq('slug', 'starter')
            .single();

          if (starterPlan) {
            await supabase.from('org_subscriptions').insert({
              org_id: newOrg.id,
              plan_id: starterPlan.id,
              status: 'active',
            });
          }

          activeMemberships = [{ org_id: newOrg.id, role: 'owner' }];
          
        }
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
