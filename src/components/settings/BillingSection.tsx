import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEntitlements } from '@/hooks/useEntitlements';
import UsageBadge from '@/components/entitlements/UsageBadge';
import { CreditCard, Users, Plug, ExternalLink, Loader2, Check, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

const STRIPE_PLANS = {
  starter: {
    name: 'Starter',
    price: 'Free',
    priceId: null,
    features: ['1 client', '5 connections', 'Basic reports'],
  },
  freelance: {
    name: 'Freelance',
    price: '£49.99/mo',
    priceId: 'price_1TFHsVHCGP7kst5ZpWooaPlh',
    features: ['5 clients', '25 connections', 'Branded reports', 'Email delivery'],
  },
  agency: {
    name: 'Agency',
    price: '£69.99/mo',
    priceId: 'price_1TFNmfHCGP7kst5ZS17zNsEQ',
    features: ['5 clients', '25 connections', 'White-label branding', 'Custom domain', 'Email delivery'],
  },
};

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

  const [searchParams] = useSearchParams();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<{ subscribed: boolean; plan: string } | null>(null);

  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    if (checkoutStatus === 'success') {
      toast.success('Subscription activated! Your plan has been upgraded.');
      checkSubscription();
    }
  }, [searchParams]);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      setStripeStatus(data);
    } catch (err) {
      console.error('Failed to check subscription:', err);
    }
  };

  const handleCheckout = async (priceId: string) => {
    setIsCheckingOut(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Portal error:', err);
      toast.error('Failed to open billing portal. Please try again.');
    } finally {
      setIsOpeningPortal(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading billing info...</div>;
  }

  const currentPlanSlug = plan?.slug || 'starter';

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      {plan && subscription && (
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
            {stripeStatus?.subscribed && (
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={isOpeningPortal}
                className="w-full"
              >
                {isOpeningPortal ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Opening...</>
                ) : (
                  <><ExternalLink className="h-4 w-4 mr-2" /> Manage Subscription</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Usage */}
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
          </CardContent>
        </Card>
      </div>

      {/* Plan Selection */}
      {!isUnlimited && (
        <div>
          <h3 className="text-lg font-display mb-4">Available Plans</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(STRIPE_PLANS).map(([slug, p]) => {
              const isCurrent = currentPlanSlug === slug;
              return (
                <Card
                  key={slug}
                  className={isCurrent ? 'border-primary ring-1 ring-primary' : ''}
                >
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-display">{p.name}</p>
                        <p className="text-2xl font-bold font-body">{p.price}</p>
                      </div>
                      {isCurrent && (
                        <Badge className="gap-1">
                          <Check className="h-3 w-3" /> Current
                        </Badge>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {!isCurrent && p.priceId && (
                      <Button
                        onClick={() => handleCheckout(p.priceId!)}
                        disabled={isCheckingOut}
                        className="w-full gap-2"
                      >
                        {isCheckingOut ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                        ) : (
                          <><Sparkles className="h-4 w-4" /> Upgrade to {p.name}</>
                        )}
                      </Button>
                    )}
                    {!isCurrent && !p.priceId && (
                      <p className="text-xs text-center text-muted-foreground">Your current free plan</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Contact for custom */}
      {!isUnlimited && (
        <Card>
          <CardContent className="py-6 text-center space-y-2">
            <Sparkles className="h-5 w-5 text-primary mx-auto" />
            <p className="text-sm font-body font-medium">Need more?</p>
            <p className="text-xs text-muted-foreground">
              Contact us at <a href="mailto:info@amwmedia.co.uk" className="text-primary hover:underline">info@amwmedia.co.uk</a> for
              custom pricing with additional clients and connections.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BillingSection;
