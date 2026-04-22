import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import usePageMeta from '@/hooks/usePageMeta';

import AppLayout from '@/components/layout/AppLayout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Settings, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const AdminOrgList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  usePageMeta({ title: 'Organisations — Admin — AMW Reports', description: 'Manage all organisations on the platform.' });

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['admin-orgs'],
    queryFn: async () => {
      const { data: orgData } = await supabase
        .from('organisations')
        .select('id, name, slug, created_at')
        .order('created_at');

      if (!orgData) return [];

      const enriched = await Promise.all(
        orgData.map(async (org) => {
          const [clientRes, subRes] = await Promise.all([
            supabase.from('clients').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
            supabase.from('org_subscriptions').select('*, subscription_plans(name, slug)').eq('org_id', org.id).maybeSingle(),
          ]);

          const { data: orgClients } = await supabase.from('clients').select('id').eq('org_id', org.id);
          const clientIds = (orgClients ?? []).map(c => c.id);
          let connectionCount = 0;
          if (clientIds.length > 0) {
            const { count } = await supabase
              .from('platform_connections')
              .select('id', { count: 'exact', head: true })
              .in('client_id', clientIds)
              .eq('is_connected', true);
            connectionCount = count ?? 0;
          }

          return {
            ...org,
            clientCount: clientRes.count ?? 0,
            connectionCount,
            subscription: subRes.data as { id: string; status: string; is_custom: boolean; subscription_plans: { name: string; slug: string } | null } | null,
          };
        })
      );

      return enriched;
    },
  });

  const handleCreateOrg = async () => {
    const name = newOrgName.trim();
    if (!name) return;
    setIsCreating(true);

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data: org, error } = await supabase
      .from('organisations')
      .insert({ name, slug })
      .select('id')
      .single();

    if (error || !org) {
      toast.error('Failed to create organisation');
      console.error(error);
      setIsCreating(false);
      return;
    }

    // Auto-assign creator plan
    const { data: creatorPlan } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('slug', 'creator')
      .maybeSingle();

    if (creatorPlan) {
      await supabase.from('org_subscriptions').insert({
        org_id: org.id,
        plan_id: creatorPlan.id,
        status: 'active',
      });
    }

    toast.success('Organisation created');
    queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
    setNewOrgName('');
    setShowCreate(false);
    setIsCreating(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-display">Organisations</h1>
            <p className="text-muted-foreground font-body mt-1 text-sm">Manage all platform organisations</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Create Organisation
          </Button>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Clients</TableHead>
                  <TableHead>Connections</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div>
                        <p className="font-body font-semibold">{org.name}</p>
                        <p className="text-xs text-muted-foreground">{org.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {org.subscription ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm capitalize">{org.subscription.subscription_plans?.name ?? 'Unknown'}</span>
                          {org.subscription.is_custom && <Badge variant="outline" className="text-xs">Custom</Badge>}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No plan</span>
                      )}
                    </TableCell>
                    <TableCell>{org.clientCount}</TableCell>
                    <TableCell>{org.connectionCount}</TableCell>
                    <TableCell>
                      <Badge variant={org.subscription?.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                        {org.subscription?.status ?? 'none'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/organisations/${org.id}`)}>
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create Organisation Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Organisation</DialogTitle>
            <DialogDescription>Add a new organisation to the platform</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Organisation Name</Label>
              <Input
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="e.g. Acme Corp"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateOrg()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreateOrg} disabled={isCreating || !newOrgName.trim()}>
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminOrgList;
