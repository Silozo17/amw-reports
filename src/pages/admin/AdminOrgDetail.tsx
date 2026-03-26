import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const AdminOrgDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const [planId, setPlanId] = useState('');
  const [additionalClients, setAdditionalClients] = useState(0);
  const [additionalConnections, setAdditionalConnections] = useState(0);
  const [isCustom, setIsCustom] = useState(false);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [status, setStatus] = useState('active');

  const { data: org } = useQuery({
    queryKey: ['admin-org', id],
    queryFn: async () => {
      const { data } = await supabase.from('organisations').select('*').eq('id', id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('subscription_plans').select('*').eq('is_active', true);
      return data ?? [];
    },
  });

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['admin-org-sub', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('org_subscriptions')
        .select('*')
        .eq('org_id', id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

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
      org_id: id!,
      plan_id: planId,
      status,
      additional_clients: additionalClients,
      additional_connections: additionalConnections,
      is_custom: isCustom,
      override_max_clients: isUnlimited ? -1 : null,
      override_max_connections: isUnlimited ? -1 : null,
    };

    if (subscription) {
      const { error } = await supabase
        .from('org_subscriptions')
        .update(payload)
        .eq('id', subscription.id);
      if (error) {
        toast.error('Failed to update subscription');
        console.error(error);
      } else {
        toast.success('Subscription updated');
      }
    } else {
      const { error } = await supabase
        .from('org_subscriptions')
        .insert(payload);
      if (error) {
        toast.error('Failed to create subscription');
        console.error(error);
      } else {
        toast.success('Subscription created');
      }
    }

    queryClient.invalidateQueries({ queryKey: ['admin-org-sub', id] });
    queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
    setIsSaving(false);
  };

  return (
    <AdminLayout>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/organisations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-display">{org?.name ?? 'Organisation'}</h1>
            <p className="text-muted-foreground font-body mt-1">Manage subscription & limits</p>
          </div>
        </div>

        {subLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Subscription Settings</CardTitle>
            </CardHeader>
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
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminOrgDetail;
