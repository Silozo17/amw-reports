import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Users, Plug, Shield } from 'lucide-react';
import usePageMeta from '@/hooks/usePageMeta';

const AdminDashboard = () => {
  usePageMeta({ title: 'Platform Overview — Admin — AMW Reports', description: 'AMW Reports platform statistics.' });
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [orgs, clients, connections, members] = await Promise.all([
        supabase.from('organisations').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('platform_connections').select('id', { count: 'exact', head: true }).eq('is_connected', true),
        supabase.from('org_members').select('id', { count: 'exact', head: true }),
      ]);
      return {
        orgs: orgs.count ?? 0,
        clients: clients.count ?? 0,
        connections: connections.count ?? 0,
        members: members.count ?? 0,
      };
    },
  });

  const cards = [
    { label: 'Organisations', value: stats?.orgs ?? 0, icon: Building2 },
    { label: 'Total Clients', value: stats?.clients ?? 0, icon: Users },
    { label: 'Active Connections', value: stats?.connections ?? 0, icon: Plug },
    { label: 'Total Users', value: stats?.members ?? 0, icon: Users },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-display">Platform Overview</h1>
            <p className="text-muted-foreground font-body mt-1">AMW Reports platform statistics</p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/admin/security"><Shield className="h-4 w-4" /> Security &amp; Spend</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-body font-medium text-muted-foreground">{card.label}</CardTitle>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-display">{card.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
