import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Loader2, Users, Plug, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const AdminOrgDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const [planId, setPlanId] = useState('');
  const [additionalClients, setAdditionalClients] = useState(0);
  const [additionalConnections, setAdditionalConnections] = useState(0);
  const [isCustom, setIsCustom] = useState(false);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [status, setStatus] = useState('active');

  const { data: org } = useQuery({
    queryKey: ['admin-org', id],
    queryFn: async () => {
      const { data } = await supabase.from('organisations').select('*').eq('id', id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('subscription_plans').select('*').eq('is_active', true);
      return data ?? [];
    },
  });

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['admin-org-sub', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('org_subscriptions')
        .select('*')
        .eq('org_id', id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  // Clients for this org
  const { data: clients = [] } = useQuery({
    queryKey: ['admin-org-clients', id],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').eq('org_id', id!).order('company_name');
      return data ?? [];
    },
    enabled: !!id,
  });

  // Connections for this org's clients
  const { data: connections = [] } = useQuery({
    queryKey: ['admin-org-connections', id],
    queryFn: async () => {
      const clientIds = clients.map((c) => c.id);
      if (clientIds.length === 0) return [];
      const { data } = await supabase
        .from('platform_connections')
        .select('*')
        .in('client_id', clientIds);
      return data ?? [];
    },
    enabled: clients.length > 0,
  });

  // Members
  const { data: members = [] } = useQuery({
    queryKey: ['admin-org-members', id],
    queryFn: async () => {
      const { data } = await supabase.from('org_members').select('*').eq('org_id', id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  // Profiles for members
  const { data: profiles = [] } = useQuery({
    queryKey: ['admin-org-profiles', id],
    queryFn: async () => {
      const userIds = members.filter((m) => m.user_id).map((m) => m.user_id!);
      if (userIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('*').in('user_id', userIds);
      return data ?? [];
    },
    enabled: members.length > 0,
  });

  const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p]));
  const connectionsByClient = connections.reduce<Record<string, typeof connections>>((acc, c) => {
    (acc[c.client_id] ??= []).push(c);
    return acc;
  }, {});

  useEffect(() => {
    if (subscription) {
      setPlanId(subscription.plan_id);
      setAdditionalClients(subscription.additional_clients);
      setAdditionalConnections(subscription.additional_connections);
      setIsCustom(subscription.is_custom);
      setIsUnlimited(subscription.override_max_clients === -1);
      setStatus(subscription.status);
    } else if (plans.length > 0) {
      setPlanId(plans[0].id);
    }
  }, [subscription, plans]);

  const handleSave = async () => {
    setIsSaving(true);
    const payload = {
      org_id: id!,
      plan_id: planId,
      status,
      additional_clients: additionalClients,
      additional_connections: additionalConnections,
      is_custom: isCustom,
      override_max_clients: isUnlimited ? -1 : null,
      override_max_connections: isUnlimited ? -1 : null,
    };

    if (subscription) {
      const { error } = await supabase.from('org_subscriptions').update(payload).eq('id', subscription.id);
      if (error) { toast.error('Failed to update subscription'); console.error(error); }
      else toast.success('Subscription updated');
    } else {
      const { error } = await supabase.from('org_subscriptions').insert(payload);
      if (error) { toast.error('Failed to create subscription'); console.error(error); }
      else toast.success('Subscription created');
    }

    queryClient.invalidateQueries({ queryKey: ['admin-org-sub', id] });
    queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
    setIsSaving(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from('org_members').delete().eq('id', memberId);
    if (error) { toast.error('Failed to remove member'); console.error(error); }
    else {
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: ['admin-org-members', id] });
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/organisations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-display">{org?.name ?? 'Organisation'}</h1>
            <p className="text-muted-foreground font-body mt-1">Manage subscription, clients & team</p>
          </div>
        </div>

        <Tabs defaultValue="subscription">
          <TabsList>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="clients">Clients ({clients.length})</TabsTrigger>
            <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
            <TabsTrigger value="onboarding">Onboarding Data</TabsTrigger>
          </TabsList>

          {/* SUBSCRIPTION TAB */}
          <TabsContent value="subscription">
            {subLoading ? (
              <div className="text-muted-foreground py-4">Loading...</div>
            ) : (
              <Card>
                <CardHeader><CardTitle className="font-display text-lg">Subscription Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select value={planId} onValueChange={setPlanId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} — £{p.base_price}/mo</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="trial">Trial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Additional Clients</Label>
                      <Input type="number" min={0} value={additionalClients} onChange={(e) => setAdditionalClients(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Additional Connections</Label>
                      <Input type="number" min={0} value={additionalConnections} onChange={(e) => setAdditionalConnections(Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-body font-medium">Custom Plan</p>
                      <p className="text-xs text-muted-foreground">Mark as custom/override plan</p>
                    </div>
                    <Switch checked={isCustom} onCheckedChange={setIsCustom} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-body font-medium">Unlimited Access</p>
                      <p className="text-xs text-muted-foreground">No client or connection limits</p>
                    </div>
                    <Switch checked={isUnlimited} onCheckedChange={setIsUnlimited} />
                  </div>
                  <Button onClick={handleSave} disabled={isSaving} className="w-full">
                    {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : 'Save Changes'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* CLIENTS TAB */}
          <TabsContent value="clients">
            <Card>
              <CardHeader><CardTitle className="font-display text-lg">Clients</CardTitle></CardHeader>
              <CardContent>
                {clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No clients yet</p>
                ) : (
                  <Table>
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
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Connections detail */}
            {connections.length > 0 && (
              <Card className="mt-4">
                <CardHeader><CardTitle className="font-display text-lg">Connection Health</CardTitle></CardHeader>
                <CardContent>
                  <Table>
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
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* MEMBERS TAB */}
          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No members</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => {
                        const profile = member.user_id ? profileMap[member.user_id] : null;
                        const isPending = !member.user_id;
                        return (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium">
                              {profile?.full_name ?? member.invited_email ?? '—'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {profile?.email ?? member.invited_email ?? '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] capitalize">{member.role}</Badge>
                            </TableCell>
                            <TableCell>
                              {isPending ? (
                                <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                              ) : (
                                <Badge variant="default" className="text-[10px]">Active</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveMember(member.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* ONBOARDING DATA TAB */}
          <TabsContent value="onboarding">
            <OnboardingDataTab orgId={id!} members={members} profileMap={profileMap} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

function OnboardingDataTab({ orgId, members, profileMap }: { orgId: string; members: any[]; profileMap: Record<string, any> }) {
  const { data: onboardingData = [], isLoading } = useQuery({
    queryKey: ['admin-onboarding', orgId],
    queryFn: async () => {
      const userIds = members.filter(m => m.user_id).map(m => m.user_id!);
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from('onboarding_responses')
        .select('*')
        .in('user_id', userIds);
      return data ?? [];
    },
    enabled: members.length > 0,
  });

  const platformLabels: Record<string, string> = {
    google_ads: 'Google Ads', meta_ads: 'Meta Ads', facebook: 'Facebook',
    instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn',
    google_search_console: 'Search Console', google_analytics: 'Analytics',
    google_business_profile: 'Google Business', youtube: 'YouTube',
  };

  if (isLoading) return <div className="text-muted-foreground py-4">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Onboarding Responses</CardTitle>
      </CardHeader>
      <CardContent>
        {onboardingData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No onboarding data yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead>Clients</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Referral</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {onboardingData.map((row: any) => {
                const profile = profileMap[row.user_id];
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{profile?.full_name ?? row.user_id}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-[10px]">{row.account_type}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                      {(row.platforms_used ?? []).map((p: string) => platformLabels[p] ?? p).join(', ') || '—'}
                    </TableCell>
                    <TableCell className="text-sm">{row.client_count ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">{row.primary_reason?.replace(/_/g, ' ') ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">{row.referral_source?.replace(/_/g, ' ') ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.completed_at ? format(new Date(row.completed_at), 'dd MMM yyyy') : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminOrgDetail;
