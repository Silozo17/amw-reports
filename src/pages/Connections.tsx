import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plug, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { PLATFORM_LABELS } from '@/types/database';
import type { PlatformConnection } from '@/types/database';

const Connections = () => {
  const [connections, setConnections] = useState<(PlatformConnection & { clients?: { company_name: string } | null })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConnections = async () => {
      const { data } = await supabase
        .from('platform_connections')
        .select('*, clients(company_name)')
        .order('created_at', { ascending: false });
      setConnections(data as any[] ?? []);
      setIsLoading(false);
    };
    fetchConnections();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display">Connections</h1>
          <p className="text-muted-foreground font-body mt-1">Platform integrations across all clients</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading connections...</div>
        ) : connections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Plug className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">No platform connections yet</p>
              <p className="text-xs text-muted-foreground mt-1">Connect client accounts from the client detail page</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {connections.map(conn => (
              <Card key={conn.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-md flex items-center justify-center ${conn.is_connected ? 'bg-success/10' : 'bg-destructive/10'}`}>
                      {conn.is_connected ? <CheckCircle className="h-5 w-5 text-success" /> : <AlertCircle className="h-5 w-5 text-destructive" />}
                    </div>
                    <div>
                      <p className="font-body font-semibold">{PLATFORM_LABELS[conn.platform]}</p>
                      <p className="text-sm text-muted-foreground">
                        {conn.clients?.company_name ?? 'Unknown client'}
                        {conn.account_name && ` · ${conn.account_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={conn.is_connected ? 'default' : 'destructive'}>
                      {conn.is_connected ? 'Connected' : 'Disconnected'}
                    </Badge>
                    {conn.last_sync_at && (
                      <span className="text-xs text-muted-foreground">
                        Last sync: {new Date(conn.last_sync_at).toLocaleDateString()}
                      </span>
                    )}
                    <Button size="sm" variant="ghost">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Connections;
