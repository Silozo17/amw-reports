import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Loader2, Trash2, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import usePageMeta from '@/hooks/usePageMeta';

import AdminOrgSubscription from '@/components/admin/AdminOrgSubscription';
import AdminOrgClients from '@/components/admin/AdminOrgClients';
import AdminOrgMembers from '@/components/admin/AdminOrgMembers';
import AdminOrgOnboarding from '@/components/admin/AdminOrgOnboarding';

const AdminOrgDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedOrgName, setEditedOrgName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const { data: org } = useQuery({
    queryKey: ['admin-org', id],
    queryFn: async () => {
      const { data } = await supabase.from('organisations').select('*').eq('id', id!).single();
      return data;
    },
    enabled: !!id,
  });

  usePageMeta({ title: `${org?.name ?? 'Organisation'} — Admin — AMW Reports`, description: 'Manage organisation subscription, clients and team.' });

  const { data: plans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('subscription_plans').select('*').eq('is_active', true).order('base_price', { ascending: true });
      return data ?? [];
    },
  });

  const { data: subscription = null, isLoading: subLoading } = useQuery({
    queryKey: ['admin-org-sub', id],
    queryFn: async () => {
      const { data } = await supabase.from('org_subscriptions').select('*').eq('org_id', id!).maybeSingle();
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
      const { data } = await supabase.from('platform_connections').select('id, client_id, platform, account_name, account_id, is_connected, last_sync_at, last_sync_status, last_error, metadata, token_expires_at, created_at, updated_at').in('client_id', clientIds);
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

  useEffect(() => {
    if (org) setEditedOrgName(org.name);
  }, [org]);

  const handleSaveOrgName = async () => {
    if (!editedOrgName.trim()) return;
    setIsSavingName(true);
    const { error } = await supabase.from('organisations').update({ name: editedOrgName.trim() }).eq('id', id!);
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

  const handleDeleteOrg = async () => {
    setIsDeleting(true);
    await supabase.from('org_members').delete().eq('org_id', id!);
    await supabase.from('org_subscriptions').delete().eq('org_id', id!);
    const { error } = await supabase.from('organisations').delete().eq('id', id!);
    if (error) {
      toast.error('Failed to delete organisation. It may still have clients or other linked data.');
      console.error(error);
      setIsDeleting(false);
      return;
    }
    toast.success('Organisation deleted');
    queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
    navigate('/admin/organisations');
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/organisations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input value={editedOrgName} onChange={(e) => setEditedOrgName(e.target.value)} className="text-2xl font-display h-10 max-w-xs" autoFocus />
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

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete Org
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Organisation</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <strong>{org?.name}</strong>, its members, and subscription.
                  Clients and their data will be orphaned. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteOrg} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Organisation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="subscription">
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start scrollbar-none">
            <TabsTrigger value="subscription" className="whitespace-nowrap">Subscription</TabsTrigger>
            <TabsTrigger value="clients" className="whitespace-nowrap">Clients ({clients.length})</TabsTrigger>
            <TabsTrigger value="members" className="whitespace-nowrap">Members ({members.length})</TabsTrigger>
            <TabsTrigger value="onboarding" className="whitespace-nowrap">Onboarding Data</TabsTrigger>
          </TabsList>

          <TabsContent value="subscription">
            <AdminOrgSubscription orgId={id!} subscription={subscription} plans={plans} isLoading={subLoading} />
          </TabsContent>

          <TabsContent value="clients">
            <AdminOrgClients orgId={id!} clients={clients} connections={connections as unknown as Tables<'platform_connections'>[]} />
          </TabsContent>

          <TabsContent value="members">
            <AdminOrgMembers orgId={id!} members={members} profileMap={profileMap} />
          </TabsContent>

          <TabsContent value="onboarding">
            <AdminOrgOnboarding orgId={id!} members={members} profileMap={profileMap} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminOrgDetail;
