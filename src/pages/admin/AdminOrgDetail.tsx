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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Loader2, Users, Plug, Trash2, Pencil, Save, Check, RefreshCw } from 'lucide-react';
import { SYNC_FUNCTION_MAP } from '@/lib/triggerSync';
import { toast } from 'sonner';
import { format } from 'date-fns';

const AdminOrgDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [bulkSyncProgress, setBulkSyncProgress] = useState('');

  // Subscription state
  const [planId, setPlanId] = useState('');
  const [additionalClients, setAdditionalClients] = useState(0);
  const [additionalConnections, setAdditionalConnections] = useState(0);
  const [isCustom, setIsCustom] = useState(false);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [status, setStatus] = useState('active');

  // Org name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedOrgName, setEditedOrgName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Member edit dialog
  const [editMember, setEditMember] = useState<any>(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberEmail, setEditMemberEmail] = useState('');
  const [editMemberRole, setEditMemberRole] = useState('');
  const [isSavingMember, setIsSavingMember] = useState(false);

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

  const { data: clients = [] } = useQuery({
    queryKey: ['admin-org-clients', id],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').eq('org_id', id!).order('company_name');
      return data ?? [];
    },
    enabled: !!id,
  });

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

  const { data: members = [] } = useQuery({
    queryKey: ['admin-org-members', id],
    queryFn: async () => {
      const { data } = await supabase.from('org_members').select('*').eq('org_id', id!);
      return data ?? [];
    },
    enabled: !!id,
  });

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

  useEffect(() => {
    if (org) setEditedOrgName(org.name);
  }, [org]);

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

  const handleSaveOrgName = async () => {
    if (!editedOrgName.trim()) return;
    setIsSavingName(true);
    const { error } = await supabase
      .from('organisations')
      .update({ name: editedOrgName.trim() })
      .eq('id', id!);
    if (error) {
      toast.error('Failed to update organisation name');
      console.error(error);
    } else {
      toast.success('Organisation name updated');
      queryClient.invalidateQueries({ queryKey: ['admin-org', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
      setIsEditingName(false);
    }
    setIsSavingName(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from('org_members').delete().eq('id', memberId);
    if (error) { toast.error('Failed to remove member'); console.error(error); }
    else {
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: ['admin-org-members', id] });
    }
  };

  const openEditMember = (member: any) => {
    const profile = member.user_id ? profileMap[member.user_id] : null;
    setEditMember(member);
    setEditMemberName(profile?.full_name ?? '');
    setEditMemberEmail(profile?.email ?? member.invited_email ?? '');
    setEditMemberRole(member.role);
  };

  const handleSaveMember = async () => {
    if (!editMember) return;
    setIsSavingMember(true);

    try {
      // Update role on org_members
      if (editMemberRole !== editMember.role) {
        const { error } = await supabase
          .from('org_members')
          .update({ role: editMemberRole })
          .eq('id', editMember.id);
        if (error) throw error;
      }

      // Update profile if user exists
      if (editMember.user_id) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: editMemberName.trim() || null,
            email: editMemberEmail.trim() || null,
          })
          .eq('user_id', editMember.user_id);
        if (error) throw error;
      }

      toast.success('Member updated');
      queryClient.invalidateQueries({ queryKey: ['admin-org-members', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-org-profiles', id] });
      setEditMember(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update member');
    } finally {
      setIsSavingMember(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/organisations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedOrgName}
                  onChange={(e) => setEditedOrgName(e.target.value)}
                  className="text-2xl font-display h-10 max-w-xs"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveOrgName} disabled={isSavingName}>
                  {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-primary" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setIsEditingName(false); setEditedOrgName(org?.name ?? ''); }}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-display">{org?.name ?? 'Organisation'}</h1>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditingName(true)}>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            )}
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

            {connections.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-display text-lg">Connection Health</CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={isBulkSyncing}
                      onClick={async () => {
                        setIsBulkSyncing(true);
                        const activeConns = connections.filter(c => c.is_connected && c.account_id);
                        if (activeConns.length === 0) {
                          toast.info('No active connections to sync');
                          setIsBulkSyncing(false);
                          return;
                        }

                        const now = new Date();
                        let m = now.getMonth() + 1;
                        let y = now.getFullYear();
                        const MONTH_NAMES_SHORT = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                        let successCount = 0;
                        let failCount = 0;

                        for (let i = 0; i < 12; i++) {
                          setBulkSyncProgress(`${MONTH_NAMES_SHORT[m]} ${y} (${i + 1}/12)`);
                          for (const conn of activeConns) {
                            const fn = SYNC_FUNCTION_MAP[conn.platform];
                            if (!fn) continue;
                            try {
                              const { data, error } = await supabase.functions.invoke(fn, {
                                body: { connection_id: conn.id, month: m, year: y },
                              });
                              if (error || data?.error) { failCount++; } else { successCount++; }
                            } catch { failCount++; }
                          }
                          m--;
                          if (m === 0) { m = 12; y--; }
                        }

                        if (failCount > 0) {
                          toast.error(`Bulk sync done: ${successCount} ok, ${failCount} failed`);
                        } else {
                          toast.success(`Bulk sync complete: ${successCount} syncs across 12 months`);
                        }
                        setBulkSyncProgress('');
                        setIsBulkSyncing(false);
                        queryClient.invalidateQueries({ queryKey: ['admin-org-connections', id] });
                      }}
                    >
                      {isBulkSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      {isBulkSyncing ? bulkSyncProgress : 'Sync All (12 months)'}
                    </Button>
                  </div>
                </CardHeader>
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
                        <TableHead className="w-20">Actions</TableHead>
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
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMember(member)}>
                                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveMember(member.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
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

      {/* Edit Member Dialog */}
      <Dialog open={!!editMember} onOpenChange={() => setEditMember(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>Update member details and role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editMemberName} onChange={(e) => setEditMemberName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={editMemberEmail} onChange={(e) => setEditMemberEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editMemberRole} onValueChange={setEditMemberRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>Cancel</Button>
            <Button onClick={handleSaveMember} disabled={isSavingMember}>
              {isSavingMember ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
