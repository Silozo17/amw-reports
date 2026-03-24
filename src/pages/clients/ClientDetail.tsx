import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Mail, Phone, Globe, Building2, MapPin, RefreshCw, FileText, Loader2 } from 'lucide-react';
import type { Client, ClientRecipient, PlatformConnection, PlatformType } from '@/types/database';
import { PLATFORM_LABELS } from '@/types/database';
import RecipientDialog from '@/components/clients/RecipientDialog';
import ConnectionDialog from '@/components/clients/ConnectionDialog';
import ClientEditDialog from '@/components/clients/ClientEditDialog';
import MetricConfigPanel from '@/components/clients/MetricConfigPanel';
import { generateReport, getCurrentReportPeriod } from '@/lib/reports';
import { toast } from 'sonner';

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [client, setClient] = useState<Client | null>(null);
  const [recipients, setRecipients] = useState<ClientRecipient[]>([]);
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Handle OAuth callback query params
  useEffect(() => {
    const oauthSuccess = searchParams.get('oauth_success');
    const oauthError = searchParams.get('oauth_error');
    if (oauthSuccess) {
      toast.success(`Successfully connected ${oauthSuccess.replace('_', ' ')}!`);
      setSearchParams({}, { replace: true });
    }
    if (oauthError) {
      toast.error(`OAuth error: ${oauthError}`);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [clientRes, recipientsRes, connectionsRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('client_recipients').select('*').eq('client_id', id),
      supabase.from('platform_connections').select('*').eq('client_id', id),
    ]);
    setClient(clientRes.data as Client | null);
    setRecipients((recipientsRes.data as ClientRecipient[]) ?? []);
    setConnections((connectionsRes.data as PlatformConnection[]) ?? []);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const [isGenerating, setIsGenerating] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsSyncing(true);
    const now = new Date();
    const month = now.getMonth(); // previous month
    const year = month === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const syncMonth = month === 0 ? 12 : month;

    let syncCount = 0;
    let errors: string[] = [];

    // Sync Google Ads
    const googleConn = connections.find(c => c.platform === 'google_ads' && c.is_connected);
    if (googleConn) {
      try {
        const { data, error } = await supabase.functions.invoke('sync-google-ads', {
          body: { connection_id: googleConn.id, month: syncMonth, year },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        syncCount += data.campaigns_synced || 0;
      } catch (e) {
        console.error('Google Ads sync error:', e);
        errors.push(`Google Ads: ${e instanceof Error ? e.message : 'failed'}`);
      }
    }

    // Sync Meta Ads
    const metaConn = connections.find(c => c.platform === 'meta_ads' && c.is_connected);
    if (metaConn) {
      try {
        const { data, error } = await supabase.functions.invoke('sync-meta-ads', {
          body: { connection_id: metaConn.id, month: syncMonth, year },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        syncCount += data.campaigns_synced || 0;
      } catch (e) {
        console.error('Meta Ads sync error:', e);
        errors.push(`Meta Ads: ${e instanceof Error ? e.message : 'failed'}`);
      }
    }

    if (!googleConn && !metaConn) {
      toast.info('No connected platforms found. Add and connect one first.');
    } else if (errors.length > 0) {
      toast.error(`Sync errors: ${errors.join('; ')}`);
    } else {
      toast.success(`Synced ${syncCount} campaigns for ${syncMonth}/${year}`);
    }

    fetchData();
    setIsSyncing(false);
  };

  const handleGenerateReport = async () => {
    if (!client) return;
    setIsGenerating(true);
    const { month, year } = getCurrentReportPeriod();
    await generateReport(client.id, month, year);
    setIsGenerating(false);
  };

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

  const connectedPlatforms: PlatformType[] = connections.map(c => c.platform);

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
          <div className="flex items-center gap-2">
            <Badge variant={client.is_active ? 'default' : 'secondary'} className="text-sm">
              {client.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <ClientEditDialog client={client} onUpdate={fetchData} />
            <Button variant="outline" size="sm" className="gap-2" onClick={handleManualSync} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {isSyncing ? 'Syncing...' : 'Sync'}
            </Button>
            <Button size="sm" className="gap-2" onClick={handleGenerateReport} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              {isGenerating ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="connections">Connections ({connections.length})</TabsTrigger>
            <TabsTrigger value="recipients">Recipients ({recipients.length})</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
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
                  {!client.email && !client.phone && !client.website && (
                    <p className="text-muted-foreground">No contact details added yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="font-display text-lg">Services & Notes</CardTitle></CardHeader>
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

            {/* Quick summary cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-display text-primary">{connections.filter(c => c.is_connected).length}</p>
                  <p className="text-xs text-muted-foreground">Connected Platforms</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-display text-primary">{recipients.length}</p>
                  <p className="text-xs text-muted-foreground">Report Recipients</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-display text-primary">{client.report_detail_level}</p>
                  <p className="text-xs text-muted-foreground capitalize">Report Detail</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="connections" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-display text-lg">Platform Connections</CardTitle>
                <ConnectionDialog clientId={client.id} connections={connections} onUpdate={fetchData} />
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
                          <p className="text-xs text-muted-foreground">
                            {conn.account_name ?? conn.account_id ?? 'No account info'}
                            {conn.last_sync_at && ` · Last sync: ${new Date(conn.last_sync_at).toLocaleDateString()}`}
                          </p>
                          {conn.last_error && <p className="text-xs text-destructive mt-1">{conn.last_error}</p>}
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
                <RecipientDialog clientId={client.id} recipients={recipients} onUpdate={fetchData} />
              </CardHeader>
              <CardContent>
                {recipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No recipients configured — add at least one to receive reports</p>
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

          <TabsContent value="metrics" className="mt-4">
            <MetricConfigPanel clientId={client.id} connectedPlatforms={connectedPlatforms} />
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
