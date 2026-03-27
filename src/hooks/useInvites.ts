import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/contexts/OrgContext';

export interface PendingInvite {
  id: string;
  org_id: string;
  role: string;
  invited_email: string;
  org_name: string;
  org_logo: string | null;
}

export function useInvites() {
  const { user, profile } = useAuth();
  const { refetchOrg } = useOrg();
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchInvites = useCallback(async () => {
    if (!user || !profile?.email) return;

    setIsLoading(true);
    try {
      const { data: invites, error } = await supabase
        .from('org_members')
        .select('id, org_id, role, invited_email')
        .eq('invited_email', profile.email)
        .is('accepted_at', null)
        .is('user_id', null);

      if (error || !invites?.length) {
        setPendingInvites([]);
        return;
      }

      // Fetch org details for the invites
      const orgIds = invites.map(i => i.org_id);
      const { data: orgs } = await supabase
        .from('organisations')
        .select('id, name, logo_url')
        .in('id', orgIds);

      const mapped: PendingInvite[] = invites.map(inv => {
        const org = orgs?.find(o => o.id === inv.org_id);
        return {
          id: inv.id,
          org_id: inv.org_id,
          role: inv.role,
          invited_email: inv.invited_email ?? '',
          org_name: org?.name ?? 'Unknown',
          org_logo: org?.logo_url ?? null,
        };
      });

      setPendingInvites(mapped);
    } finally {
      setIsLoading(false);
    }
  }, [user, profile?.email]);

  const acceptInvite = useCallback(async (inviteId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('org_members')
      .update({ user_id: user.id, accepted_at: new Date().toISOString() })
      .eq('id', inviteId);

    if (error) {
      console.error('Failed to accept invite:', error);
      return;
    }

    setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    await refetchOrg();
  }, [user, refetchOrg]);

  const declineInvite = useCallback(async (inviteId: string) => {
    const { error } = await supabase
      .from('org_members')
      .delete()
      .eq('id', inviteId);

    if (error) {
      console.error('Failed to decline invite:', error);
      return;
    }

    setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  return {
    pendingInvites,
    isLoading,
    acceptInvite,
    declineInvite,
    refetchInvites: fetchInvites,
  };
}
