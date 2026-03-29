import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

interface AdminOrgSubscriptionProps {
  orgId: string;
  subscription: Tables<'org_subscriptions'> | null;
  plans: Tables<'subscription_plans'>[];
  isLoading: boolean;
}

const AdminOrgSubscription = ({ orgId, subscription, plans, isLoading }: AdminOrgSubscriptionProps) => {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [planId, setPlanId] = useState('');
  const [additionalClients, setAdditionalClients] = useState(0);
  const [additionalConnections, setAdditionalConnections] = useState(0);
  const [isCustom, setIsCustom] = useState(false);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [status, setStatus] = useState('active');

  useEffect(() => {
    if (subscription) {
      setPlanId(subscription.plan_id);
      setAdditionalClients(subscription.additional_clients);
      setAdditionalConnections(subscription.additional_connections);
      setIsCustom(subscription.is_custom);
      setIsUnlimited(subscription.override_max_clients === -1);
      setStatus(subscription.status);
    } else if (plans.length > 0) {
      setPlanId(plans[0].id);
    }
  }, [subscription, plans]);

  const handleSave = async () => {
    setIsSaving(true);
    const payload = {
      org_id: orgId,
      plan_id: planId,
      status,
      additional_clients: additionalClients,
      additional_connections: additionalConnections,
      is_custom: isCustom,
      override_max_clients: isUnlimited ? -1 : null,
      override_max_connections: isUnlimited ? -1 : null,
    };

    if (subscription) {
      const { error } = await supabase.from('org_subscriptions').update(payload).eq('id', subscription.id);
      if (error) { toast.error('Failed to update subscription'); console.error(error); }
      else toast.success('Subscription updated');
    } else {
      const { error } = await supabase.from('org_subscriptions').insert(payload);
      if (error) { toast.error('Failed to create subscription'); console.error(error); }
      else toast.success('Subscription created');
    }

    queryClient.invalidateQueries({ queryKey: ['admin-org-sub', orgId] });
    queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
    setIsSaving(false);
  };

  if (isLoading) {
    return <div className="text-muted-foreground py-4">Loading...</div>;
  }

  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-lg">Subscription Settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Plan</Label>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name} — £{p.base_price}/mo</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Additional Clients</Label>
            <Input type="number" min={0} value={additionalClients} onChange={(e) => setAdditionalClients(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Additional Connections</Label>
            <Input type="number" min={0} value={additionalConnections} onChange={(e) => setAdditionalConnections(Number(e.target.value))} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-body font-medium">Custom Plan</p>
            <p className="text-xs text-muted-foreground">Mark as custom/override plan</p>
          </div>
          <Switch checked={isCustom} onCheckedChange={setIsCustom} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-body font-medium">Unlimited Access</p>
            <p className="text-xs text-muted-foreground">No client or connection limits</p>
          </div>
          <Switch checked={isUnlimited} onCheckedChange={setIsUnlimited} />
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminOrgSubscription;
