import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEntitlements } from '@/hooks/useEntitlements';
import UsageBadge from '@/components/entitlements/UsageBadge';
import { CreditCard, Users, Plug } from 'lucide-react';

const BillingSection = () => {
  const {
    plan,
    subscription,
    maxClients,
    maxConnections,
    currentClients,
    currentConnections,
    isUnlimited,
    isLoading,
  } = useEntitlements();

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading billing info...</div>;
  }

  if (!plan || !subscription) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No subscription found. Contact support to set up your plan.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-display">{plan.name}</p>
              <p className="text-sm text-muted-foreground font-body">
                {isUnlimited ? 'Unlimited access' : plan.base_price === 0 ? 'Free' : `£${plan.base_price}/month`}
              </p>
            </div>
            <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'} className="capitalize">
              {subscription.status}
            </Badge>
          </div>

          {subscription.is_custom && (
            <Badge variant="outline" className="text-xs">Custom Plan</Badge>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-body font-medium">Clients</p>
              </div>
              <UsageBadge current={currentClients} max={maxClients} label="used" />
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: isUnlimited ? '10%' : `${Math.min((currentClients / maxClients) * 100, 100)}%` }}
              />
            </div>
            {!isUnlimited && subscription.additional_clients > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {plan.included_clients} included + {subscription.additional_clients} add-ons (£{plan.additional_client_price}/ea)
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Plug className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-body font-medium">Connections</p>
              </div>
              <UsageBadge current={currentConnections} max={maxConnections} label="used" />
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: isUnlimited ? '10%' : `${Math.min((currentConnections / maxConnections) * 100, 100)}%` }}
              />
            </div>
            {!isUnlimited && subscription.additional_connections > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {plan.included_connections} included + {subscription.additional_connections} add-ons (£{plan.additional_connection_price}/ea)
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {!isUnlimited && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground font-body">
              Need more capacity? Contact us to upgrade your plan or add individual clients/connections.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BillingSection;
