import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Mail, Phone, Globe, Building2, MapPin } from 'lucide-react';
import type { Client, ClientRecipient, PlatformConnection } from '@/types/database';
import { PLATFORM_LABELS } from '@/types/database';

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [recipients, setRecipients] = useState<ClientRecipient[]>([]);
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      const [clientRes, recipientsRes, connectionsRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('client_recipients').select('*').eq('client_id', id),
        supabase.from('platform_connections').select('*').eq('client_id', id),
      ]);

      setClient(clientRes.data as Client | null);
      setRecipients((recipientsRes.data as ClientRecipient[]) ?? []);
      setConnections((connectionsRes.data as PlatformConnection[]) ?? []);
      setIsLoading(false);
    };

    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Client not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/clients')}>Back to clients</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-display">{client.company_name}</h1>
              <p className="text-muted-foreground font-body mt-1">{client.full_name}{client.position && ` · ${client.position}`}</p>
            </div>
          </div>
          <Badge variant={client.is_active ? 'default' : 'secondary'} className="text-sm">
            {client.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="recipients">Recipients</TabsTrigger>
            <TabsTrigger value="settings">Report Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="font-display text-lg">Contact Info</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {client.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{client.email}</div>}
                  {client.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{client.phone}</div>}
                  {client.website && <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" />{client.website}</div>}
                  {client.business_address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{client.business_address}</div>}
                  {client.account_manager && <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />Manager: {client.account_manager}</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="font-display text-lg">Services</CardTitle></CardHeader>
                <CardContent>
                  {client.services_subscribed.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {client.services_subscribed.map(s => <Badge key={s} variant="outline">{s}</Badge>)}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No services listed</p>
                  )}
                  {client.notes && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{client.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="connections" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-display text-lg">Platform Connections</CardTitle>
                <Button size="sm" variant="outline">Add Connection</Button>
              </CardHeader>
              <CardContent>
                {connections.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No platforms connected yet</p>
                ) : (
                  <div className="space-y-3">
                    {connections.map(conn => (
                      <div key={conn.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                        <div>
                          <p className="text-sm font-body font-medium">{PLATFORM_LABELS[conn.platform]}</p>
                          <p className="text-xs text-muted-foreground">{conn.account_name ?? conn.account_id ?? 'No account info'}</p>
                        </div>
                        <Badge variant={conn.is_connected ? 'default' : 'destructive'}>
                          {conn.is_connected ? 'Connected' : 'Disconnected'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recipients" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-display text-lg">Report Recipients</CardTitle>
                <Button size="sm" variant="outline">Add Recipient</Button>
              </CardHeader>
              <CardContent>
                {recipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No recipients configured</p>
                ) : (
                  <div className="space-y-2">
                    {recipients.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                        <div>
                          <p className="text-sm font-body font-medium">{r.name}</p>
                          <p className="text-xs text-muted-foreground">{r.email}</p>
                        </div>
                        {r.is_primary && <Badge variant="outline">Primary</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="font-display text-lg">Report Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Detail Level</span><span className="capitalize">{client.report_detail_level}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">MoM Comparison</span><Badge variant={client.enable_mom_comparison ? 'default' : 'secondary'}>{client.enable_mom_comparison ? 'On' : 'Off'}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">YoY Comparison</span><Badge variant={client.enable_yoy_comparison ? 'default' : 'secondary'}>{client.enable_yoy_comparison ? 'On' : 'Off'}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">AI Explanations</span><Badge variant={client.enable_explanations ? 'default' : 'secondary'}>{client.enable_explanations ? 'On' : 'Off'}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Upsell Section</span><Badge variant={client.enable_upsell ? 'default' : 'secondary'}>{client.enable_upsell ? 'On' : 'Off'}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span>{client.preferred_currency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Timezone</span><span>{client.preferred_timezone}</span></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ClientDetail;
