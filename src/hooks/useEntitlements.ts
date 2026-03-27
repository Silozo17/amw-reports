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
  subscription_plans: SubscriptionPlan;
}

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
  /** Check if a connection can be added for a specific client given its current connection count */
  canAddConnectionForClient: (clientConnectionCount: number) => boolean;
  flexiblePoolRemaining: number;
}

const LOCKED_CONNECTIONS_PER_CLIENT = 3;

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
        .select('id', { count: 'exact', head: true })
        .eq('is_connected', true);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  });

  const isLoading = subLoading || clientsLoading || connLoading;
  const plan = subscription?.subscription_plans ?? null;

  const isUnlimited = subscription?.override_max_clients === -1 || subscription?.override_max_connections === -1;

  const maxClients = subscription?.override_max_clients === -1
    ? Infinity
    : subscription?.override_max_clients != null
      ? subscription.override_max_clients
      : (plan?.included_clients ?? 1) + (subscription?.additional_clients ?? 0);

  const maxConnections = subscription?.override_max_connections === -1
    ? Infinity
    : subscription?.override_max_connections != null
      ? subscription.override_max_connections
      : (plan?.included_connections ?? 5) + (subscription?.additional_connections ?? 0);

  const hasWhitelabel = plan?.has_whitelabel ?? false;

  // Connection allocation: locked slots per client + flexible pool
  const totalLockedSlots = currentClients * LOCKED_CONNECTIONS_PER_CLIENT;
  const flexiblePoolTotal = maxConnections === Infinity ? Infinity : Math.max(0, maxConnections - totalLockedSlots);
  // Connections used beyond locked slots count against the flexible pool
  // We approximate: total used connections - min(total used, locked capacity)
  const flexiblePoolUsed = Math.max(0, currentConnections - totalLockedSlots);
  const flexiblePoolRemaining = flexiblePoolTotal === Infinity ? Infinity : Math.max(0, flexiblePoolTotal - flexiblePoolUsed);

  const canAddConnectionForClient = (clientConnectionCount: number): boolean => {
    if (isUnlimited) return true;
    if (currentConnections >= maxConnections) return false;
    // If client has fewer than locked slots, always allowed
    if (clientConnectionCount < LOCKED_CONNECTIONS_PER_CLIENT) return true;
    // Otherwise, must have flexible pool remaining
    return flexiblePoolRemaining > 0;
  };

  return {
    plan,
    subscription: subscription ?? null,
    maxClients,
    maxConnections,
    currentClients,
    currentConnections,
    canAddClient: currentClients < maxClients,
    canAddConnection: currentConnections < maxConnections,
    isUnlimited,
    isLoading,
    hasWhitelabel,
    canAddConnectionForClient,
    flexiblePoolRemaining,
  };
}
