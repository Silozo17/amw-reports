import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

const AdminOrgList = () => {
  const navigate = useNavigate();

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

          // Count connections via clients belonging to this org
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
            subscription: subRes.data as any,
          };
        })
      );

      return enriched;
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display">Organisations</h1>
          <p className="text-muted-foreground font-body mt-1">Manage all platform organisations</p>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : (
          <div className="rounded-md border">
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
    </AdminLayout>
  );
};

export default AdminOrgList;
