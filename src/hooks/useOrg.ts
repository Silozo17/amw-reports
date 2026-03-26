import { useState, useEffect } from 'react';
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

export function useOrg() {
  const { user } = useAuth();
  const [org, setOrg] = useState<Organisation | null>(null);
  const [orgRole, setOrgRole] = useState<'owner' | 'manager' | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrg = async () => {
    if (!user) return;

    try {
      let { data: membership, error: membershipError } = await supabase
        .from('org_members')
        .select('org_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (membershipError || !membership) {
        // Recovery: auto-create org for users who have none
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

        membership = { org_id: newOrg.id, role: 'owner' };
        console.log('Recovered org for user', user.id);
      }

      setOrgId(membership.org_id);
      setOrgRole(membership.role as 'owner' | 'manager');

      const { data: orgData, error: orgError } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', membership.org_id)
        .single();

      if (orgError) {
        console.error('Failed to fetch organisation:', orgError);
        return;
      }

      setOrg(orgData as Organisation | null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setOrg(null);
      setOrgRole(null);
      setOrgId(null);
      setIsLoading(false);
      return;
    }

    fetchOrg();
  }, [user]);

  return { org, orgId, orgRole, isOrgOwner: orgRole === 'owner', isLoading, refetchOrg: fetchOrg };
}
