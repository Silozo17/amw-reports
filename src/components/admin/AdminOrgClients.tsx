import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plug } from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import AdminSyncDialog from '@/components/admin/AdminSyncDialog';
import type { Tables } from '@/integrations/supabase/types';

interface AdminOrgClientsProps {
  orgId: string;
  clients: Tables<'clients'>[];
  connections: Tables<'platform_connections'>[];
}

const AdminOrgClients = ({ orgId, clients, connections }: AdminOrgClientsProps) => {
  const queryClient = useQueryClient();

  const connectionsByClient = connections.reduce<Record<string, Tables<'platform_connections'>[]>>((acc, c) => {
    (acc[c.client_id] ??= []).push(c);
    return acc;
  }, {});

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Clients</CardTitle></CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No clients yet</p>
          ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Connections</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const conns = connectionsByClient[client.id] ?? [];
                  const activeConns = conns.filter((c) => c.is_connected).length;
                  const hasError = conns.some((c) => c.last_sync_status === 'failed');
                  return (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.company_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{client.full_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Plug className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{activeConns}/{conns.length}</span>
                          {hasError && <Badge variant="destructive" className="text-[10px] px-1">Error</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={client.is_active ? 'default' : 'secondary'}>
                          {client.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>

      {connections.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg">Connection Health</CardTitle>
              <AdminSyncDialog
                clients={clients}
                connections={connections}
                onComplete={() => queryClient.invalidateQueries({ queryKey: ['admin-org-connections', orgId] })}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((conn) => {
                  const client = clients.find((c) => c.id === conn.client_id);
                  return (
                    <TableRow key={conn.id}>
                      <TableCell className="text-sm">{client?.company_name ?? '—'}</TableCell>
                      <TableCell className="text-sm font-mono">{conn.platform.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{conn.account_name ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {conn.last_sync_at ? format(new Date(conn.last_sync_at), 'dd MMM HH:mm') : '—'}
                      </TableCell>
                      <TableCell>
                        {conn.last_sync_status === 'failed' ? (
                          <Badge variant="destructive" className="text-[10px]">Failed</Badge>
                        ) : conn.is_connected ? (
                          <Badge variant="default" className="text-[10px]">Connected</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Disconnected</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table></div>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default AdminOrgClients;
