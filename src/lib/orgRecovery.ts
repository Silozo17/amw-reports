import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

/**
 * Ensures the user has an org membership. If none exists, attempts recovery:
 * 1. Links to profile.org_id if set
 * 2. Creates a brand-new org with starter plan
 *
 * Returns the org_id of the recovered/existing membership, or null on failure.
 */
export async function ensureOrgMembership(user: User): Promise<string | null> {
  // Check existing memberships
  const { data: memberships } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id);

  if (memberships && memberships.length > 0) {
    return memberships[0].org_id;
  }

  // Recovery path 1: link to profile.org_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('user_id', user.id)
    .single();

  if (profile?.org_id) {
    await supabase.from('org_members').insert({
      org_id: profile.org_id,
      user_id: user.id,
      role: 'manager',
      accepted_at: new Date().toISOString(),
    });
    return profile.org_id;
  }

  // Recovery path 2: create new org
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
    return null;
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
    .eq('slug', 'creator')
    .single();

  if (starterPlan) {
    await supabase.from('org_subscriptions').insert({
      org_id: newOrg.id,
      plan_id: starterPlan.id,
      status: 'active',
    });
  }

  return newOrg.id;
}
