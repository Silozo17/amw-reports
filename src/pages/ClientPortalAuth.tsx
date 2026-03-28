import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ClientDashboard from '@/components/clients/ClientDashboard';
import ConnectionDialog from '@/components/clients/ConnectionDialog';
import AccountPickerDialog from '@/components/clients/AccountPickerDialog';
import ConnectionDisclaimer from '@/components/clients/ConnectionDisclaimer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import type { PlatformConnection, PlatformType } from '@/types/database';
import { PLATFORM_LABELS, PLATFORM_LOGOS } from '@/types/database';
import { removeConnectionAndData } from '@/lib/connectionHelpers';
import { triggerInitialSync, SYNC_FUNCTION_MAP } from '@/lib/triggerSync';
import { hexToHsl } from '@/lib/colorUtils';

interface PortalOrg {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  heading_font: string | null;
  body_font: string | null;
}

interface PortalClient {
  id: string;
  company_name: string;
  full_name: string;
  logo_url: string | null;
  preferred_currency: string;
}

const ClientPortalAuth = () => {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [client, setClient] = useState<PortalClient | null>(null);
  const [org, setOrg] = useState<PortalOrg | null>(null);
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'connections'>('dashboard');

  // Account picker state
  const [pickerConnection, setPickerConnection] = useState<PlatformConnection | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;

    // Get client_user info
    const { data: cuData, error: cuErr } = await supabase
      .rpc('get_client_user_info', { _user_id: user.id });

    if (cuErr || !cuData || cuData.length === 0) {
      setError('No client account found. Please contact your agency.');
      setIsLoading(false);
      return;
    }

    const { client_id, org_id } = cuData[0];

    // Fetch client, org, and connections in parallel
    const [clientRes, orgRes, connRes] = await Promise.all([
      supabase.from('clients').select('id, company_name, full_name, logo_url, preferred_currency').eq('id', client_id).single(),
      supabase.from('organisations').select('id, name, logo_url, primary_color, heading_font, body_font').eq('id', org_id).single(),
      supabase.from('platform_connections').select('*').eq('client_id', client_id),
    ]);

    if (clientRes.error || !clientRes.data) {
      setError('Failed to load your account.');
      setIsLoading(false);
      return;
    }

    setClient(clientRes.data as PortalClient);
    setOrg(orgRes.data as PortalOrg | null);
    setConnections((connRes.data ?? []) as PlatformConnection[]);

    // Apply branding
    if (orgRes.data) {
      const o = orgRes.data;
      const root = document.documentElement;
      if (o.primary_color) {
        const hsl = o.primary_color.startsWith('#') ? hexToHsl(o.primary_color) : o.primary_color;
        if (hsl) root.style.setProperty('--primary', hsl);
      }

      // Load Google Fonts with deduplication
      const loadFont = (fontName: string, weights: string) => {
        const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@${weights}&display=swap`;
        if (!document.querySelector(`link[href="${href}"]`)) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          document.head.appendChild(link);
        }
      };

      if (o.heading_font) {
        root.style.setProperty('--font-heading', o.heading_font);
        loadFont(o.heading_font, '400;700');
      }
      if (o.body_font) {
        root.style.setProperty('--font-body', o.body_font);
        loadFont(o.body_font, '300;400;500;600');
      }
    }

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
    if (user) fetchData();
  }, [user, authLoading, fetchData, navigate]);

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
      toast.success('Platform connected successfully');
      fetchData();
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
            setPickerConnection(data as PlatformConnection);
            setPickerOpen(true);
          }
          fetchData();
        });
    }
  }, [searchParams, setSearchParams, fetchData]);

  const handleRemoveConnection = async (conn: PlatformConnection) => {
    if (!client) return;
    const { error } = await removeConnectionAndData(conn.id, client.id, conn.platform);
    if (error) {
      toast.error('Failed to remove connection');
    } else {
      toast.success('Connection removed');
      fetchData();
    }
  };

  const handlePickerComplete = async () => {
    setPickerOpen(false);
    const conn = pickerConnection;
    setPickerConnection(null);
    if (!client || !conn) return;

    if (SYNC_FUNCTION_MAP[conn.platform]) {
      toast.info('Starting initial data sync...');
      await triggerInitialSync(conn.id, conn.platform);
    }
    fetchData();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-display text-foreground mb-2">Dashboard Unavailable</h1>
          <p className="text-muted-foreground mb-4">{error ?? 'Something went wrong.'}</p>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {org?.logo_url && (
              <img src={org.logo_url} alt={org.name} className="h-8 w-auto object-contain" />
            )}
            <span className="font-display text-lg text-foreground">{org?.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {client.logo_url && (
                <img src={client.logo_url} alt={client.company_name} className="h-8 w-8 rounded-lg object-contain border bg-muted" />
              )}
              <span className="text-sm text-muted-foreground font-body">{client.company_name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <div className="max-w-7xl mx-auto px-6 pt-4">
        <div className="flex gap-1 border-b">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('connections')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'connections'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Connections
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'dashboard' && (
          <ClientDashboard
            clientId={client.id}
            clientName={client.company_name}
            currencyCode={client.preferred_currency}
          />
        )}

        {activeTab === 'connections' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-display text-lg">Platform Connections</CardTitle>
                <ConnectionDialog clientId={client.id} connections={connections} onUpdate={fetchData} />
              </CardHeader>
              <CardContent>
                {connections.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No platforms connected yet. Click "Add Connection" to get started.
                  </p>
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
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setPickerConnection(conn); setPickerOpen(true); }}>
                                Select Account
                              </Button>
                            )}
                            {conn.is_connected && conn.account_id && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setPickerConnection(conn); setPickerOpen(true); }}>
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
                                    This will remove the connection and delete all associated data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleRemoveConnection(conn)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Remove
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
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card px-6 py-4 mt-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs text-muted-foreground">
            Powered by {org?.name}
          </p>
        </div>
      </footer>

      {/* Account Picker */}
      <AccountPickerDialog
        connection={pickerConnection}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onComplete={handlePickerComplete}
        clientId={client.id}
      />
    </div>
  );
};

export default ClientPortalAuth;
