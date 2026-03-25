import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Mail, Phone, Globe, Building2, MapPin, RefreshCw, FileText, Loader2, BarChart3, CalendarIcon, History, Trash2 } from 'lucide-react';
import type { Client, ClientRecipient, PlatformConnection, PlatformType } from '@/types/database';
import { PLATFORM_LABELS, PLATFORM_LOGOS, CURRENCY_OPTIONS } from '@/types/database';
import { TIMEZONE_OPTIONS } from '@/types/metrics';
import { formatPhone } from '@/lib/utils';
import RecipientDialog from '@/components/clients/RecipientDialog';
import ConnectionDialog from '@/components/clients/ConnectionDialog';
import ClientEditDialog from '@/components/clients/ClientEditDialog';
import MetricConfigPanel from '@/components/clients/MetricConfigPanel';
import AccountPickerDialog from '@/components/clients/AccountPickerDialog';
import ClientDashboard from '@/components/clients/ClientDashboard';
import { generateReport, getCurrentReportPeriod } from '@/lib/reports';
import { removeConnectionAndData } from '@/lib/connectionHelpers';
import ConnectionDisclaimer from '@/components/clients/ConnectionDisclaimer';
import { toast } from 'sonner';

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [client, setClient] = useState<Client | null>(null);
  const [recipients, setRecipients] = useState<ClientRecipient[]>([]);
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // Account picker state
  const [pickerConnection, setPickerConnection] = useState<PlatformConnection | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Handle OAuth callback query params
  useEffect(() => {
    const oauthError = searchParams.get('oauth_error');
    const pendingConnectionId = searchParams.get('oauth_pending_selection');
    const oauthConnected = searchParams.get('oauth_connected');

    if (oauthError) {
      toast.error(`OAuth error: ${oauthError}`);
      setSearchParams({}, { replace: true });
    }

    if (oauthConnected) {
      setSearchParams({}, { replace: true });
      supabase
        .from('platform_connections')
        .select('platform, account_name')
        .eq('id', oauthConnected)
        .single()
        .then(({ data }) => {
          if (data) {
            const label = PLATFORM_LABELS[data.platform as PlatformType];
            toast.success(`${label} connected successfully${data.account_name ? ` — ${data.account_name}` : ''}`);
          } else {
            toast.success('Platform connected successfully');
          }
          fetchData();
        });
    }

    if (pendingConnectionId) {
      setSearchParams({}, { replace: true });
      supabase
        .from('platform_connections')
        .select('*')
        .eq('id', pendingConnectionId)
        .single()
        .then(({ data }) => {
          if (data) {
            const conn = data as PlatformConnection;
            const meta = conn.metadata as Record<string, unknown> | null;

            // Check if there's a discovery error (e.g. YouTube API disabled)
            if (meta?.discovery_error) {
              toast.error(String(meta.discovery_error));
              fetchData();
              return;
            }

            // Check if connection already has an account selected (auto-selected)
            if (conn.account_id) {
              toast.success(`${PLATFORM_LABELS[conn.platform]} connected successfully`);
              fetchData();
              return;
            }

            // Check if there are actually selectable assets before opening picker
            const hasAssets = (meta?.channels as unknown[])?.length > 0 ||
              (meta?.customers as unknown[])?.length > 0 ||
              (meta?.ad_accounts as unknown[])?.length > 0 ||
              (meta?.pages as unknown[])?.length > 0 ||
              (meta?.ig_accounts as unknown[])?.length > 0 ||
              (meta?.accounts as unknown[])?.length > 0 ||
              (meta?.sites as unknown[])?.length > 0 ||
              (meta?.properties as unknown[])?.length > 0 ||
              (meta?.locations as unknown[])?.length > 0 ||
              (meta?.organizations as unknown[])?.length > 0;

            if (!hasAssets) {
              toast.error('No accounts were discovered. Please check that the required APIs are enabled and permissions were granted.');
              fetchData();
              return;
            }

            setPickerConnection(conn);
            setPickerOpen(true);
          }
        });
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
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [syncMonth, setSyncMonth] = useState(() => {
    const n = new Date();
    return n.getMonth() === 0 ? 12 : n.getMonth();
  });
  const [syncYear, setSyncYear] = useState(() => {
    const n = new Date();
    return n.getMonth() === 0 ? n.getFullYear() - 1 : n.getFullYear();
  });
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');

  const runSyncForMonth = async (m: number, y: number) => {
    let syncCount = 0;
    const errors: string[] = [];

    const syncPlatform = async (conn: PlatformConnection, functionName: string, label: string) => {
      try {
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { connection_id: conn.id, month: m, year: y },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        syncCount += data.campaigns_synced || data.pages_synced || data.accounts_synced || 1;
      } catch (e) {
        console.error(`Sync error:`, e);
        errors.push(`${label}: ${e instanceof Error ? e.message : 'failed'}`);
      }
    };

    const syncMap: Record<string, string> = {
      google_ads: 'sync-google-ads',
      meta_ads: 'sync-meta-ads',
      facebook: 'sync-facebook-page',
      instagram: 'sync-instagram',
      tiktok: 'sync-tiktok-ads',
      linkedin: 'sync-linkedin',
    };

    const connectedPlatformConns = connections.filter(c => c.is_connected && c.account_id);
    if (connectedPlatformConns.length === 0) return { syncCount: 0, errors: ['No connected platforms'] };

    await Promise.all(
      connectedPlatformConns.map(conn => {
        const fn = syncMap[conn.platform];
        if (fn) return syncPlatform(conn, fn, PLATFORM_LABELS[conn.platform]);
        return Promise.resolve();
      })
    );

    return { syncCount, errors };
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMenuOpen(false);

    const connectedPlatformConns = connections.filter(c => c.is_connected && c.account_id);
    if (connectedPlatformConns.length === 0) {
      toast.info('No fully configured platforms found. Connect and select accounts first.');
      setIsSyncing(false);
      return;
    }

    const { syncCount, errors } = await runSyncForMonth(syncMonth, syncYear);

    if (errors.length > 0) {
      toast.error(`Sync errors: ${errors.join('; ')}`);
    } else {
      toast.success(`Synced ${syncCount} items for ${syncMonth}/${syncYear}`);
    }

    fetchData();
    setIsSyncing(false);
  };

  const handleBulkSync = async () => {
    setIsBulkSyncing(true);
    setSyncMenuOpen(false);

    const connectedPlatformConns = connections.filter(c => c.is_connected && c.account_id);
    if (connectedPlatformConns.length === 0) {
      toast.info('No fully configured platforms found.');
      setIsBulkSyncing(false);
      return;
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    let m = currentMonth;
    let y = currentYear;
    let totalSynced = 0;
    const allErrors: string[] = [];
    const MONTH_NAMES_SHORT = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 0; i < 12; i++) {
      setBulkProgress(`Syncing ${MONTH_NAMES_SHORT[m]} ${y}... (${i + 1}/12)`);
      const { syncCount, errors } = await runSyncForMonth(m, y);
      totalSynced += syncCount;
      allErrors.push(...errors);
      m--;
      if (m === 0) { m = 12; y--; }
    }

    if (allErrors.length > 0) {
      toast.error(`Bulk sync completed with ${allErrors.length} errors`);
    } else {
      toast.success(`Bulk sync complete — synced ${totalSynced} items across 12 months`);
    }

    setBulkProgress('');
    setIsBulkSyncing(false);
    fetchData();
  };

  const handleGenerateReport = async () => {
    if (!client) return;
    setIsGenerating(true);
    const { month, year } = getCurrentReportPeriod();
    await generateReport(client.id, month, year);
    setIsGenerating(false);
  };

  const handleOpenPicker = (conn: PlatformConnection) => {
    setPickerConnection(conn);
    setPickerOpen(true);
  };

  const handleDeleteClient = async () => {
    if (!client) return;
    setIsDeleting(true);
    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    if (error) {
      toast.error('Failed to delete client');
      setIsDeleting(false);
    } else {
      toast.success('Client deleted');
      navigate('/clients');
    }
  };

  // Auto-sync historical data after picker completes
  const handlePickerComplete = async () => {
    await fetchData();

    // Get updated connections to check for newly connected platforms
    const { data: updatedConns } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('client_id', id!)
      .eq('is_connected', true)
      .not('account_id', 'is', null);

    if (!updatedConns || updatedConns.length === 0) return;

    // Check if any connected platform has no snapshots (newly connected)
    const { data: existingSnapshots } = await supabase
      .from('monthly_snapshots')
      .select('platform')
      .eq('client_id', id!)
      .limit(100);

    const platformsWithData = new Set((existingSnapshots ?? []).map(s => s.platform));
    const newPlatforms = (updatedConns as PlatformConnection[]).filter(c => !platformsWithData.has(c.platform));

    if (newPlatforms.length === 0) return;

    // Auto-sync historical data for new platforms
    toast.info('Syncing historical data for newly connected platform...');
    
    const syncMap: Record<string, string> = {
      google_ads: 'sync-google-ads',
      meta_ads: 'sync-meta-ads',
      facebook: 'sync-facebook-page',
      instagram: 'sync-instagram',
      tiktok: 'sync-tiktok-ads',
      linkedin: 'sync-linkedin',
    };

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    let m = currentMonth;
    let y = currentYear;
    const MONTH_NAMES_SHORT = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 0; i < 12; i++) {
      toast.info(`Syncing historical data... ${MONTH_NAMES_SHORT[m]} ${y} (${i + 1}/12)`);
      for (const conn of newPlatforms) {
        const fn = syncMap[conn.platform];
        if (!fn) continue;
        try {
          await supabase.functions.invoke(fn, {
            body: { connection_id: conn.id, month: m, year: y },
          });
        } catch (e) {
          console.error(`Auto-sync error for ${conn.platform}:`, e);
        }
      }
      m--;
      if (m === 0) { m = 12; y--; }
    }

    toast.success('Historical data sync complete');
    fetchData();
  };

  const handleRemoveConnection = async (conn: PlatformConnection) => {
    const { error } = await removeConnectionAndData(conn.id, conn.client_id, conn.platform);
    if (error) {
      toast.error('Failed to remove connection');
    } else {
      toast.success('Connection and data removed');
      fetchData();
    }
  };

  const handleSettingChange = async (field: string, value: string | boolean) => {
    if (!client) return;
    const { error } = await supabase.from('clients').update({ [field]: value }).eq('id', client.id);
    if (error) {
      toast.error('Failed to update setting');
    } else {
      setClient(prev => prev ? { ...prev, [field]: value } : null);
      toast.success('Setting updated');
    }
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {client.logo_url && (
              <img src={client.logo_url} alt={`${client.company_name} logo`} className="h-10 w-10 rounded-lg object-contain border bg-muted" />
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-display">{client.company_name}</h1>
              <p className="text-muted-foreground font-body mt-1 text-sm">{client.full_name}{client.position && ` · ${client.position}`}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-12 sm:ml-0">
            <Badge variant={client.is_active ? 'default' : 'secondary'} className="text-sm">
              {client.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <ClientEditDialog client={client} onUpdate={fetchData} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {client.company_name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this client and all associated data including connections, snapshots, reports, and sync logs. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteClient} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isDeleting ? 'Deleting...' : 'Delete Client'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Popover open={syncMenuOpen} onOpenChange={setSyncMenuOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" disabled={isSyncing || isBulkSyncing}>
                  {isSyncing || isBulkSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{isBulkSyncing ? bulkProgress : isSyncing ? 'Syncing...' : 'Sync'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4 space-y-3" align="end">
                <p className="text-sm font-medium">Sync Data</p>
                <div className="flex gap-2">
                  <Select value={String(syncMonth)} onValueChange={v => setSyncMonth(Number(v))}>
                    <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(syncYear)} onValueChange={v => setSyncYear(Number(v))}>
                    <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => {
                        const yr = new Date().getFullYear() - i;
                        return <SelectItem key={yr} value={String(yr)}>{yr}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" className="w-full gap-2" onClick={handleManualSync} disabled={isSyncing}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync Selected Month
                </Button>
                <div className="border-t pt-2">
                  <Button size="sm" variant="outline" className="w-full gap-2" onClick={handleBulkSync} disabled={isBulkSyncing}>
                    <History className="h-3.5 w-3.5" />
                    Sync Last 12 Months
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button size="sm" className="gap-2" onClick={handleGenerateReport} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isGenerating ? 'Generating...' : 'Report'}</span>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
            <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5 hidden sm:inline" />Dashboard</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="recipients">Recipients</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <ClientDashboard clientId={client.id} clientName={client.company_name} currencyCode={client.preferred_currency} />
          </TabsContent>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="font-display text-lg">Contact Info</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {client.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{client.email}</div>}
                  {client.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{formatPhone(client.phone)}</div>}
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

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-display text-primary">{connections.filter(c => c.is_connected && c.account_id).length}</p>
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
                    {connections.map(conn => {
                      const needsSelection = conn.is_connected && !conn.account_id;
                      return (
                        <div key={conn.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                          <div>
                            <div className="flex items-center gap-2">
                              {PLATFORM_LOGOS[conn.platform] && <img src={PLATFORM_LOGOS[conn.platform]} alt="" className="h-5 w-5 object-contain" />}
                              <p className="text-sm font-body font-medium">{PLATFORM_LABELS[conn.platform]}</p>
                            </div>
                            <p className="text-xs text-muted-foreground ml-7">
                              {conn.account_name ?? conn.account_id ?? 'No account selected'}
                              {conn.last_sync_at && ` · Last sync: ${new Date(conn.last_sync_at).toLocaleDateString()}`}
                            </p>
                            {conn.last_error && <p className="text-xs text-destructive mt-1">{conn.last_error}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            {needsSelection && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleOpenPicker(conn)}>
                                Select Account
                              </Button>
                            )}
                            {conn.is_connected && conn.account_id && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleOpenPicker(conn)}>
                                Change
                              </Button>
                            )}
                            <Badge variant={conn.is_connected && conn.account_id ? 'default' : needsSelection ? 'secondary' : 'destructive'}>
                              {conn.is_connected && conn.account_id ? 'Connected' : needsSelection ? 'Select Account' : 'Disconnected'}
                            </Badge>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7">
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove {PLATFORM_LABELS[conn.platform]}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will remove the connection and delete all associated data (snapshots, sync history, and metric configuration) for this platform.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleRemoveConnection(conn)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Remove & Delete Data
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
              <div className="px-6 pb-4">
                <ConnectionDisclaimer />
              </div>
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
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Detail Level</p>
                    <p className="text-xs text-muted-foreground">How detailed reports should be</p>
                  </div>
                  <Select value={client.report_detail_level} onValueChange={v => handleSettingChange('report_detail_level', v)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Simple</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {[
                  { key: 'enable_mom_comparison', label: 'MoM Comparison', desc: 'Compare with previous month' },
                  { key: 'enable_yoy_comparison', label: 'YoY Comparison', desc: 'Compare with same month last year' },
                  { key: 'enable_explanations', label: 'AI Explanations', desc: 'Plain-English insights in reports' },
                  { key: 'enable_upsell', label: 'Upsell Section', desc: 'Recommend AMW services in reports' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={client[item.key as keyof Client] as boolean}
                      onCheckedChange={v => handleSettingChange(item.key, v)}
                    />
                  </div>
                ))}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium">Currency</p>
                      <p className="text-xs text-muted-foreground">Currency used in reports</p>
                    </div>
                    <Select value={client.preferred_currency} onValueChange={v => handleSettingChange('preferred_currency', v)}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Timezone</p>
                      <p className="text-xs text-muted-foreground">Timezone for data reporting</p>
                    </div>
                    <Select value={client.preferred_timezone} onValueChange={v => handleSettingChange('preferred_timezone', v)}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map(tz => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Account Picker Dialog */}
      <AccountPickerDialog
        connection={pickerConnection}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onComplete={handlePickerComplete}
        clientId={client.id}
      />
    </AppLayout>
  );
};

export default ClientDetail;
