import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Mail, Phone, Globe, Building2, MapPin, FileText, Loader2, BarChart3, CalendarIcon, Trash2, Share2, Clock, XCircle, AlertTriangle, UserPlus, Users } from 'lucide-react';
import DeleteClientDialog from '@/components/clients/DeleteClientDialog';
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
import { triggerInitialSync, SYNC_FUNCTION_MAP, type SyncProgress } from '@/lib/triggerSync';
import ConnectionDisclaimer from '@/components/clients/ConnectionDisclaimer';
import SyncProgressBar from '@/components/clients/SyncProgressBar';
import ShareDialog from '@/components/clients/ShareDialog';
import UpsellTab from '@/components/clients/UpsellTab';
import ClientReportsTab from '@/components/clients/ClientReportsTab';
import ClientSwitcher from '@/components/clients/ClientSwitcher';
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [clientUsers, setClientUsers] = useState<{ id: string; invited_email: string; user_id: string; created_at: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [activeSyncs, setActiveSyncs] = useState<Map<string, SyncProgress>>(new Map());
  const [syncStartTime, setSyncStartTime] = useState(0);

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
    const [clientRes, recipientsRes, connectionsRes, clientUsersRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('client_recipients').select('*').eq('client_id', id),
      supabase.from('platform_connections').select('*').eq('client_id', id),
      supabase.from('client_users').select('id, invited_email, user_id, created_at').eq('client_id', id),
    ]);
    setClient(clientRes.data as Client | null);
    setRecipients((recipientsRes.data as ClientRecipient[]) ?? []);
    setConnections((connectionsRes.data as PlatformConnection[]) ?? []);
    setClientUsers((clientUsersRes.data as any[]) ?? []);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInviteClient = async () => {
    if (!inviteEmail.trim() || !id) return;
    setIsInviting(true);
    const { data, error } = await supabase.functions.invoke('invite-client-user', {
      body: { client_id: id, email: inviteEmail.trim() },
    });
    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? 'Failed to send invite');
    } else {
      toast.success(data?.message ?? 'Invitation sent');
      setInviteEmail('');
      fetchData();
    }
    setIsInviting(false);
  };

  const handleRevokeClientUser = async (cuId: string) => {
    const { error } = await supabase.from('client_users').delete().eq('id', cuId);
    if (error) {
      toast.error('Failed to revoke access');
    } else {
      toast.success('Client access revoked');
      fetchData();
    }
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [reportMonth, setReportMonth] = useState<number | null>(null);
  const [reportYear, setReportYear] = useState<number | null>(null);
  const [reportPickerLoaded, setReportPickerLoaded] = useState(false);

  // Load most recent snapshot month to default the picker
  useEffect(() => {
    if (!id || reportPickerLoaded) return;
    (async () => {
      const { data } = await supabase
        .from('monthly_snapshots')
        .select('report_month, report_year')
        .eq('client_id', id)
        .order('report_year', { ascending: false })
        .order('report_month', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setReportMonth(data[0].report_month);
        setReportYear(data[0].report_year);
      } else {
        const { month, year } = getCurrentReportPeriod();
        setReportMonth(month);
        setReportYear(year);
      }
      setReportPickerLoaded(true);
    })();
  }, [id, reportPickerLoaded]);

  const handleGenerateReport = async () => {
    if (!client || !reportMonth || !reportYear) return;
    setIsGenerating(true);
    await generateReport(client.id, reportMonth, reportYear);
    setIsGenerating(false);
  };

  const handleOpenPicker = (conn: PlatformConnection) => {
    setPickerConnection(conn);
    setPickerOpen(true);
  };

  const scheduledAt = client?.scheduled_deletion_at ? new Date(client.scheduled_deletion_at) : null;
  const isDeletionPending = scheduledAt && scheduledAt > new Date();

  // Countdown timer
  useEffect(() => {
    if (!isDeletionPending || !scheduledAt) return;
    const update = () => {
      const diff = scheduledAt.getTime() - Date.now();
      if (diff <= 0) { setCountdown('Deleting…'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setCountdown(`${h}h ${m}m`);
    };
    update();
    const iv = setInterval(update, 60_000);
    return () => clearInterval(iv);
  }, [isDeletionPending, scheduledAt]);

  const handleScheduleDeletion = async () => {
    if (!client) return;
    setIsDeleting(true);
    const deletionTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('clients')
      .update({ scheduled_deletion_at: deletionTime } as any)
      .eq('id', client.id);
    if (error) {
      toast.error('Failed to schedule deletion');
    } else {
      toast.success('Client scheduled for deletion in 24 hours');
      setClient(prev => prev ? { ...prev, scheduled_deletion_at: deletionTime } as any : null);
    }
    setIsDeleting(false);
    setDeleteDialogOpen(false);
  };

  const handleCancelDeletion = async () => {
    if (!client) return;
    setIsDeleting(true);
    const { error } = await supabase
      .from('clients')
      .update({ scheduled_deletion_at: null } as any)
      .eq('id', client.id);
    if (error) {
      toast.error('Failed to cancel deletion');
    } else {
      toast.success('Deletion cancelled');
      setClient(prev => prev ? { ...prev, scheduled_deletion_at: null } as any : null);
    }
    setIsDeleting(false);
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

    // Auto-sync 12 months of historical data with progress tracking
    setSyncStartTime(Date.now());
    
    for (const conn of newPlatforms) {
      triggerInitialSync(conn.id, conn.platform, 12, (progress) => {
        setActiveSyncs(prev => {
          const next = new Map(prev);
          next.set(conn.platform, progress);
          return next;
        });
      }).then(results => {
        const failures = results.filter(r => !r.success);
        if (failures.length > 0) {
          console.error(`Auto-sync errors for ${conn.platform}:`, failures);
        }
        // Remove completed platform from active syncs
        setActiveSyncs(prev => {
          const next = new Map(prev);
          next.delete(conn.platform);
          return next;
        });
        fetchData();
      });
    }

    toast.success('Historical data sync started — progress shown below');
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
        {/* Pending deletion banner */}
        {isDeletionPending && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="flex-1">
              This client is scheduled for deletion in <span className="font-bold">{countdown}</span>.
              All data will be permanently removed when the timer expires.
            </p>
            <Button variant="outline" size="sm" onClick={handleCancelDeletion} disabled={isDeleting} className="shrink-0 gap-1.5">
              <XCircle className="h-3.5 w-3.5" />
              Cancel Deletion
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {client.logo_url && (
              <img src={client.logo_url} alt={`${client.company_name} logo`} className="h-10 w-10 rounded-lg object-contain border bg-muted" />
            )}
            <div>
              <div className="flex items-center gap-1">
                <h1 className="text-2xl sm:text-3xl font-display">{client.company_name}</h1>
                <ClientSwitcher currentClientId={client.id} />
              </div>
              <p className="text-muted-foreground font-body mt-1 text-sm">{client.full_name}{client.position && ` · ${client.position}`}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-0">
            <Badge variant={client.is_active ? 'default' : 'secondary'} className="text-sm">
              {client.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <ShareDialog clientId={client.id} orgId={client.org_id} clientName={client.company_name} />
            <ClientEditDialog client={client} onUpdate={fetchData} />
            {isDeletionPending ? (
              <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={handleCancelDeletion} disabled={isDeleting}>
                <Clock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{countdown}</span>
                <span className="text-xs">Cancel</span>
              </Button>
            ) : (
              <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialogOpen(true)} aria-label="Delete client">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <DeleteClientDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              clientName={client.company_name}
              onConfirm={handleScheduleDeletion}
              isLoading={isDeleting}
            />
            <Select value={reportMonth?.toString() ?? ''} onValueChange={v => setReportMonth(Number(v))}>
              <SelectTrigger className="w-24 sm:w-28 h-8 text-xs"><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>
                {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                  <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={reportYear?.toString() ?? ''} onValueChange={v => setReportYear(Number(v))}>
              <SelectTrigger className="w-20 h-8 text-xs"><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>
                {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(yr => (
                  <SelectItem key={yr} value={String(yr)}>{yr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-2" onClick={handleGenerateReport} disabled={isGenerating || !reportMonth || !reportYear}>
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isGenerating ? 'Generating...' : 'Report'}</span>
            </Button>
          </div>
        </div>

        {activeSyncs.size > 0 && (
          <SyncProgressBar activeSyncs={activeSyncs} startTime={syncStartTime} />
        )}

        <Tabs defaultValue="dashboard">
          <div className="relative">
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 sm:hidden" />
            <TabsList className="w-full overflow-x-auto flex-nowrap justify-start scrollbar-none">
              <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5 hidden sm:inline" />Dashboard</TabsTrigger>
              <TabsTrigger value="connections">Connections</TabsTrigger>
              <TabsTrigger value="upsells">Upsells</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </div>

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

          <TabsContent value="upsells" className="mt-4">
            <UpsellTab clientId={client.id} />
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <ClientReportsTab
              clientId={client.id}
              clientName={client.company_name}
              orgId={client.org_id}
              reportMonth={reportMonth}
              reportYear={reportYear}
              setReportMonth={setReportMonth}
              setReportYear={setReportYear}
            />
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
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Report Language</p>
                    <p className="text-xs text-muted-foreground">Language used for report text</p>
                  </div>
                  <Select value={(client as any).report_language ?? 'en'} onValueChange={v => handleSettingChange('report_language', v)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="it">Italian</SelectItem>
                      <SelectItem value="nl">Dutch</SelectItem>
                      <SelectItem value="pt">Portuguese</SelectItem>
                       <SelectItem value="pl">Polish</SelectItem>
                       <SelectItem value="da">Danish</SelectItem>
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

            {/* Client Self-Service Access */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" /> Client Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Invite your client to log in and manage their own platform connections via magic link.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="client@company.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleInviteClient} disabled={isInviting || !inviteEmail.trim()} size="sm">
                    {isInviting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                    Invite
                  </Button>
                </div>
                {clientUsers.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invited Users</p>
                    {clientUsers.map(cu => (
                      <div key={cu.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <div>
                          <p className="text-sm font-body">{cu.invited_email}</p>
                          <p className="text-xs text-muted-foreground">Invited {new Date(cu.created_at).toLocaleDateString()}</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke access?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove {cu.invited_email}'s ability to log in and manage connections for this client.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRevokeClientUser(cu.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Revoke
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                )}
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
