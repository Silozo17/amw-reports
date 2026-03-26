import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Building2, Mail, Phone } from 'lucide-react';
import type { Client } from '@/types/database';
import { useEntitlements } from '@/hooks/useEntitlements';
import UsageBadge from '@/components/entitlements/UsageBadge';

const ClientList = () => {
  const { currentClients, maxClients } = useEntitlements();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .order('company_name');
      setClients((data as Client[]) ?? []);
      setIsLoading(false);
    };
    fetchClients();
  }, []);

  const filtered = clients.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display">Clients</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground font-body">{clients.length} total clients</p>
              <UsageBadge current={currentClients} max={maxClients} label="clients" />
            </div>
          </div>
          <Button onClick={() => navigate('/clients/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading clients...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No clients found</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/clients/new')}>
              Add your first client
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((client) => (
              <Card
                key={client.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/clients/${client.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-body font-semibold text-base">{client.company_name}</h3>
                      <p className="text-sm text-muted-foreground">{client.full_name}</p>
                    </div>
                    <Badge variant={client.is_active ? 'default' : 'secondary'}>
                      {client.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    {client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {client.position && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{client.position}</span>
                      </div>
                    )}
                  </div>
                  {client.services_subscribed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {client.services_subscribed.slice(0, 3).map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                      {client.services_subscribed.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{client.services_subscribed.length - 3}</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ClientList;
