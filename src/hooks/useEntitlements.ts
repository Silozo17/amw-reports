import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

interface SubscriptionPlan {
  name: string;
  slug: string;
  base_price: number;
  included_clients: number;
  included_connections: number;
  additional_client_price: number;
  additional_connection_price: number;
  has_whitelabel: boolean;
}

interface OrgSubscription {
  id: string;
  plan_id: string;
  status: string;
  additional_clients: number;
  additional_connections: number;
  is_custom: boolean;
  override_max_clients: number | null;
  override_max_connections: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_period_end: string | null;
  subscription_plans: SubscriptionPlan;
}

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'none';

export interface Entitlements {
  plan: SubscriptionPlan | null;
  subscription: OrgSubscription | null;
  maxClients: number;
  maxConnections: number;
  currentClients: number;
  currentConnections: number;
  canAddClient: boolean;
  canAddConnection: boolean;
  isUnlimited: boolean;
  isLoading: boolean;
  hasWhitelabel: boolean;
  subscriptionStatus: SubscriptionStatus;
  isInGracePeriod: boolean;
  isLocked: boolean;
  gracePeriodEnd: Date | null;
}

const CREATOR_LIMITS = {
  maxClients: 1,
  maxConnections: 5,
};

export function useEntitlements(): Entitlements {
  const { orgId } = useOrg();

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['org-subscription', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_subscriptions')
        .select('*, subscription_plans(*)')
        .eq('org_id', orgId!)
        .single();
      if (error) {
        console.error('Failed to fetch subscription:', error);
        return null;
      }
      return data as unknown as OrgSubscription;
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: currentClients = 0, isLoading: clientsLoading } = useQuery({
    queryKey: ['client-count', orgId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId!);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  });

  const { data: currentConnections = 0, isLoading: connLoading } = useQuery({
    queryKey: ['connection-count', orgId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('platform_connections')
        .select('id, clients!inner(org_id)', { count: 'exact', head: true })
        .eq('is_connected', true)
        .eq('clients.org_id', orgId!);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  });

  const isLoading = subLoading || clientsLoading || connLoading;
  const plan = subscription?.subscription_plans ?? null;

  // --- Subscription status logic ---
  const rawStatus = subscription?.status ?? 'none';
  const subscriptionStatus: SubscriptionStatus =
    rawStatus === 'active' ? 'active' :
    rawStatus === 'past_due' ? 'past_due' :
    rawStatus === 'cancelled' ? 'cancelled' : 'none';

  const gracePeriodEnd = subscription?.grace_period_end
    ? new Date(subscription.grace_period_end)
    : null;

  const now = new Date();
  const isInGracePeriod =
    (subscriptionStatus === 'past_due' || subscriptionStatus === 'cancelled') &&
    gracePeriodEnd !== null &&
    gracePeriodEnd > now;

  const isLocked =
    (subscriptionStatus === 'past_due' || subscriptionStatus === 'cancelled') &&
    !isInGracePeriod;

  // --- Entitlement calculations ---
  const isUnlimited = !isLocked && (
    subscription?.override_max_clients === -1 || subscription?.override_max_connections === -1
  );

  let maxClients: number;
  let maxConnections: number;
  let hasWhitelabel: boolean;

  if (isLocked) {
    // Locked: fall back to Starter limits
    maxClients = CREATOR_LIMITS.maxClients;
    maxConnections = CREATOR_LIMITS.maxConnections;
    hasWhitelabel = false;
  } else {
    maxClients = subscription?.override_max_clients === -1
      ? Infinity
      : subscription?.override_max_clients != null
        ? subscription.override_max_clients
        : (plan?.included_clients ?? 1) + (subscription?.additional_clients ?? 0);

    maxConnections = subscription?.override_max_connections === -1
      ? Infinity
      : subscription?.override_max_connections != null
        ? subscription.override_max_connections
        : (plan?.included_connections ?? 5) + ((subscription?.additional_connections ?? 0) * 5);

    hasWhitelabel = plan?.has_whitelabel ?? false;
  }

  // During grace period: existing features work, but no expansion
  const canAddClient = isInGracePeriod
    ? false
    : !isLocked && currentClients < maxClients;

  const canAddConnection = isInGracePeriod
    ? false
    : !isLocked && currentConnections < maxConnections;

  return {
    plan,
    subscription: subscription ?? null,
    maxClients,
    maxConnections,
    currentClients,
    currentConnections,
    canAddClient,
    canAddConnection,
    isUnlimited,
    isLoading,
    hasWhitelabel,
    subscriptionStatus,
    isInGracePeriod,
    isLocked,
    gracePeriodEnd,
  };
}
