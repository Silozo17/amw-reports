import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, FileText, Loader2, BarChart3, Trash2, Clock, XCircle, AlertTriangle } from 'lucide-react';
import DeleteClientDialog from '@/components/clients/DeleteClientDialog';
import type { Client, ClientRecipient, PlatformConnection, PlatformType } from '@/types/database';
import { PLATFORM_LABELS } from '@/types/database';
import type { SelectedPeriod } from '@/components/clients/DashboardHeader';
import AccountPickerDialog from '@/components/clients/AccountPickerDialog';
import ClientDashboard from '@/components/clients/ClientDashboard';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import { generateReport, getCurrentReportPeriod } from '@/lib/reports';
import { removeConnectionAndData } from '@/lib/connectionHelpers';
import { useEntitlements } from '@/hooks/useEntitlements';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useSyncJobs } from '@/hooks/useSyncJobs';
import SyncProgressBar from '@/components/clients/SyncProgressBar';
import ShareDialog from '@/components/clients/ShareDialog';
import UpsellTab from '@/components/clients/UpsellTab';
import ClientReportsTab from '@/components/clients/ClientReportsTab';
import ClientSwitcher from '@/components/clients/ClientSwitcher';
import ClientEditDialog from '@/components/clients/ClientEditDialog';
import MetricConfigPanel from '@/components/clients/MetricConfigPanel';
import ClientConnectionsTab from '@/components/clients/tabs/ClientConnectionsTab';
import ClientSettingsTab from '@/components/clients/tabs/ClientSettingsTab';
import ClientContentLabTab from '@/components/clients/tabs/ClientContentLabTab';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import { toast } from 'sonner';
import usePageMeta from '@/hooks/usePageMeta';

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
  const [cancelDeletionDialogOpen, setCancelDeletionDialogOpen] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [clientUsers, setClientUsers] = useState<{ id: string; invited_email: string; user_id: string; created_at: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [pickerConnection, setPickerConnection] = useState<PlatformConnection | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const entitlements = useEntitlements();
  const { isPlatformAdmin } = usePlatformAdmin();
  const { isOwner, isManager, isClientUser } = useAuth();
  const isOrgMember = isOwner || isManager;
  const { hasAccess: hasContentLabAccess } = useContentLabAccess();

  // Server-side sync queue
  const { activeJobs, isAnySyncing, enqueueSync } = useSyncJobs(id);

  const getSyncMonths = useCallback(async (): Promise<number> => {
    if (entitlements.plan?.slug === 'agency') return 24;
    const { data: sub } = await supabase
      .from('org_subscriptions')
      .select('subscription_plans(slug)')
      .eq('org_id', client?.org_id ?? '')
      .single();
    const slug = (sub?.subscription_plans as unknown as { slug: string } | null)?.slug;
    return slug === 'agency' ? 24 : 12;
  }, [entitlements.plan, client?.org_id]);
  const [reportMonth, setReportMonth] = useState<number | null>(null);
  const [reportYear, setReportYear] = useState<number | null>(null);
  const [reportPickerLoaded, setReportPickerLoaded] = useState(false);
  const [dashboardPeriod, setDashboardPeriod] = useState<SelectedPeriod | null>(null);

  const handlePeriodChange = useCallback((period: SelectedPeriod) => {
    setDashboardPeriod(period);
  }, []);

  usePageMeta({ title: client ? `${client.company_name} — AMW Reports` : 'Client — AMW Reports', description: 'Client detail and performance dashboard' });

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
        .select('id, client_id, platform, account_name, account_id, is_connected, last_sync_at, last_sync_status, last_error, metadata, token_expires_at, created_at, updated_at')
        .eq('id', oauthConnected)
        .single()
        .then(async ({ data }) => {
          if (data) {
            const conn = data as PlatformConnection;
            const label = PLATFORM_LABELS[conn.platform];
            toast.success(`${label} connected successfully${conn.account_name ? ` — ${conn.account_name}` : ''}`);
            await fetchData();

            // Enqueue server-side sync (sync will happen even if user navigates away)
            if (conn.account_id && conn.is_connected && client) {
              const months = await getSyncMonths();
              try {
                await enqueueSync({
                  connectionId: conn.id,
                  clientId: conn.client_id,
                  orgId: client.org_id,
                  platform: conn.platform,
                  months,
                });
                toast.success('Historical data sync started — progress shown below');
              } catch {
                toast.error('Failed to start sync — it will be retried automatically');
              }
            }
          } else {
            toast.success('Platform connected successfully');
            fetchData();
          }
        });
    }

    if (pendingConnectionId) {
      setSearchParams({}, { replace: true });
      supabase
        .from('platform_connections')
        .select('id, client_id, platform, account_name, account_id, is_connected, last_sync_at, last_sync_status, last_error, metadata, token_expires_at, created_at, updated_at')
        .eq('id', pendingConnectionId)
        .single()
        .then(({ data }) => {
          if (data) {
            const conn = data as PlatformConnection;
            const meta = conn.metadata as Record<string, unknown> | null;

            if (meta?.discovery_error) {
              toast.error(String(meta.discovery_error));
              fetchData();
              return;
            }

            if (conn.account_id) {
              toast.success(`${PLATFORM_LABELS[conn.platform]} connected successfully`);
              fetchData();
              return;
            }

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
      supabase.from('platform_connections').select('id, client_id, platform, account_name, account_id, is_connected, last_sync_at, last_sync_status, last_error, metadata, token_expires_at, created_at, updated_at').eq('client_id', id),
      supabase.from('client_users').select('id, invited_email, user_id, created_at').eq('client_id', id),
    ]);
    setClient(clientRes.data as Client | null);
    setRecipients((recipientsRes.data as ClientRecipient[]) ?? []);
    setConnections((connectionsRes.data as PlatformConnection[]) ?? []);
    setClientUsers((clientUsersRes.data as { id: string; invited_email: string; user_id: string; created_at: string }[]) ?? []);
    setIsLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    if (error) toast.error('Failed to revoke access');
    else { toast.success('Client access revoked'); fetchData(); }
  };

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
    const { error } = await supabase.from('clients').update({ scheduled_deletion_at: deletionTime }).eq('id', client.id);
    if (error) toast.error('Failed to schedule deletion');
    else { toast.success('Client scheduled for deletion in 24 hours'); setClient(prev => prev ? { ...prev, scheduled_deletion_at: deletionTime } : null); }
    setIsDeleting(false);
    setDeleteDialogOpen(false);
  };

  const handleCancelDeletion = async () => {
    if (!client) return;
    setIsDeleting(true);
    const { error } = await supabase.from('clients').update({ scheduled_deletion_at: null }).eq('id', client.id);
    if (error) toast.error('Failed to cancel deletion');
    else { toast.success('Deletion cancelled'); setClient(prev => prev ? { ...prev, scheduled_deletion_at: null } : null); }
    setIsDeleting(false);
  };

  const handlePickerComplete = async () => {
    await fetchData();
    if (!pickerConnection || !client) return;

    // Re-fetch only the specific connection that was just configured
    const { data: conn } = await supabase
      .from('platform_connections').select('id, client_id, platform, account_name, account_id, is_connected, last_sync_at, last_sync_status, last_error, metadata, token_expires_at, created_at, updated_at')
      .eq('id', pickerConnection.id).single();
    if (!conn || !conn.account_id || !conn.is_connected) return;

    const typedConn = conn as PlatformConnection;
    const months = await getSyncMonths();

    try {
      await enqueueSync({
        connectionId: typedConn.id,
        clientId: typedConn.client_id,
        orgId: client.org_id,
        platform: typedConn.platform,
        months,
      });
      toast.success('Historical data sync started — progress shown below');
    } catch {
      toast.error('Failed to start sync — it will be retried automatically');
    }
  };

  const handleRemoveConnection = async (conn: PlatformConnection) => {
    const { error } = await removeConnectionAndData(conn.id, conn.client_id, conn.platform);
    if (error) toast.error('Failed to remove connection');
    else { toast.success('Connection and data removed'); fetchData(); }
  };

  const handleSettingChange = async (field: string, value: string | boolean) => {
    if (!client) return;
    const { error } = await supabase.from('clients').update({ [field]: value }).eq('id', client.id);
    if (error) toast.error('Failed to update setting');
    else { setClient(prev => prev ? { ...prev, [field]: value } : null); toast.success('Setting updated'); }
  };

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div></AppLayout>;
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
        {isDeletionPending && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="flex-1">This client is scheduled for deletion in <span className="font-bold">{countdown}</span>. All data will be permanently removed when the timer expires.</p>
            <Button variant="outline" size="sm" onClick={() => setCancelDeletionDialogOpen(true)} disabled={isDeleting} className="shrink-0 gap-1.5">
              <XCircle className="h-3.5 w-3.5" />Cancel Deletion
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}><ArrowLeft className="h-4 w-4" /></Button>
            {client.logo_url && <img src={client.logo_url} alt={`${client.company_name} logo`} className="h-10 w-10 rounded-lg object-contain border bg-muted" />}
            <div>
              <div className="flex items-center gap-1">
                <h1 className="text-2xl sm:text-3xl font-display">{client.company_name}</h1>
                <ClientSwitcher currentClientId={client.id} />
              </div>
              <p className="text-muted-foreground font-body mt-1 text-sm">{client.full_name}{client.position && ` · ${client.position}`}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-0">
            <Badge variant={client.is_active ? 'default' : 'secondary'} className="text-sm">{client.is_active ? 'Active' : 'Inactive'}</Badge>
            <ShareDialog clientId={client.id} orgId={client.org_id} clientName={client.company_name} selectedPeriod={dashboardPeriod} />
            <ClientEditDialog client={client} onUpdate={fetchData} />
            {isDeletionPending ? (
              <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => setCancelDeletionDialogOpen(true)} disabled={isDeleting}>
                <Clock className="h-3.5 w-3.5" /><span className="hidden sm:inline">{countdown}</span><span className="text-xs">Cancel</span>
              </Button>
            ) : (
              <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialogOpen(true)} aria-label="Delete client">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <DeleteClientDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} clientName={client.company_name} onConfirm={handleScheduleDeletion} isLoading={isDeleting} />
            <AlertDialog open={cancelDeletionDialogOpen} onOpenChange={setCancelDeletionDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel scheduled deletion?</AlertDialogTitle>
                  <AlertDialogDescription>This will cancel the scheduled deletion for <span className="font-semibold">{client.company_name}</span>. The client and all its data will be preserved.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Scheduled</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { setCancelDeletionDialogOpen(false); handleCancelDeletion(); }}>Yes, Cancel Deletion</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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

        {isAnySyncing && <SyncProgressBar jobs={activeJobs} />}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="relative">
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 sm:hidden" />
            <TabsList className="w-full overflow-x-auto flex-nowrap justify-start scrollbar-none">
              <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5 hidden sm:inline" />Dashboard</TabsTrigger>
              <TabsTrigger value="connections">Connections</TabsTrigger>
              <TabsTrigger value="upsells">Upsells</TabsTrigger>
              {hasContentLabAccess && <TabsTrigger value="content-lab">Content Lab</TabsTrigger>}
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="mt-4">
            <SectionErrorBoundary>
              <ClientDashboard clientId={client.id} clientName={client.company_name} currencyCode={client.preferred_currency} showHealthScore={client.show_health_score !== false} onPeriodChange={handlePeriodChange} />
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="connections" className="mt-4">
            <ClientConnectionsTab
              clientId={client.id}
              connections={connections}
              onUpdate={fetchData}
              onOpenPicker={handleOpenPicker}
              onRemoveConnection={handleRemoveConnection}
              orgId={client.org_id}
              planSlug={entitlements.plan?.slug}
              isOrgMember={isOrgMember}
              isPlatformAdmin={isPlatformAdmin}
            />
          </TabsContent>

          <TabsContent value="upsells" className="mt-4">
            <UpsellTab clientId={client.id} />
          </TabsContent>

          {hasContentLabAccess && (
            <TabsContent value="content-lab" className="mt-4">
              <ClientContentLabTab client={client} onEditClient={() => setActiveTab('settings')} />
            </TabsContent>
          )}

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
            <ClientSettingsTab
              client={client}
              clientUsers={clientUsers}
              inviteEmail={inviteEmail}
              isInviting={isInviting}
              onInviteEmailChange={setInviteEmail}
              onInviteClient={handleInviteClient}
              onRevokeClientUser={handleRevokeClientUser}
              onSettingChange={handleSettingChange}
            />
          </TabsContent>
        </Tabs>
      </div>

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
