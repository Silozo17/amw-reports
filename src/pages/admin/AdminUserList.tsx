import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Users, Trash2, Ban, CheckCircle, Loader2, Pencil, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import usePageMeta from '@/hooks/usePageMeta';

import UserEditDialog, { type UserRow } from '@/components/admin/UserEditDialog';
import UserResetPasswordDialog from '@/components/admin/UserResetPasswordDialog';
import { UserDeactivateDialog, UserDeleteDialog } from '@/components/admin/UserActionDialogs';

const AdminUserList = () => {
  usePageMeta({ title: 'Users — Admin — AMW Reports', description: 'Manage all platform users.' });
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [isActioning, setIsActioning] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (!profiles) return [];
      const { data: memberships } = await supabase.from('org_members').select('id, user_id, org_id, role');
      const { data: orgs } = await supabase.from('organisations').select('id, name');
      const orgMap = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
      const memberMap = Object.fromEntries((memberships ?? []).filter((m) => m.user_id).map((m) => [m.user_id!, m]));
      return profiles.map((p): UserRow => {
        const membership = memberMap[p.user_id];
        return {
          user_id: p.user_id, full_name: p.full_name, email: p.email, avatar_url: p.avatar_url,
          phone: p.phone, position: p.position, created_at: p.created_at, org_id: p.org_id,
          onboarding_completed: p.onboarding_completed, org_name: p.org_id ? orgMap[p.org_id] ?? null : null,
          role: membership?.role ?? null, membership_id: membership?.id ?? null, is_active: !!membership,
        };
      });
    },
  });

  const { data: allOrgs = [] } = useQuery({
    queryKey: ['admin-all-orgs'],
    queryFn: async () => {
      const { data } = await supabase.from('organisations').select('id, name').order('name');
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.full_name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.org_name?.toLowerCase().includes(s);
  });

  const handleDeactivate = async (user: UserRow) => {
    setIsActioning(true);
    try {
      const { error } = await supabase.from('org_members').delete().eq('user_id', user.user_id);
      if (error) throw error;
      await supabase.from('profiles').update({ org_id: null }).eq('user_id', user.user_id);
      toast.success(`${user.full_name || user.email} has been deactivated`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      console.error(err);
      toast.error('Failed to deactivate user');
    } finally {
      setIsActioning(false);
      setDeactivateTarget(null);
    }
  };

  const handleDelete = async (user: UserRow) => {
    setIsActioning(true);
    try {
      await supabase.from('org_members').delete().eq('user_id', user.user_id);
      const { error } = await supabase.from('profiles').delete().eq('user_id', user.user_id);
      if (error) throw error;
      toast.success(`${user.full_name || user.email} has been deleted`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete user. They may need to be removed from the auth system separately.');
    } finally {
      setIsActioning(false);
      setDeleteTarget(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-display">Users</h1>
            <p className="text-muted-foreground font-body mt-1 text-sm">Manage all platform users ({users.length} total)</p>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or org..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card><CardContent className="pt-6 flex items-center gap-3"><Users className="h-5 w-5 text-muted-foreground" /><div><p className="text-2xl font-display">{users.length}</p><p className="text-xs text-muted-foreground">Total Users</p></div></CardContent></Card>
          <Card><CardContent className="pt-6 flex items-center gap-3"><CheckCircle className="h-5 w-5 text-accent" /><div><p className="text-2xl font-display">{users.filter((u) => u.is_active).length}</p><p className="text-xs text-muted-foreground">Active</p></div></CardContent></Card>
          <Card><CardContent className="pt-6 flex items-center gap-3"><Ban className="h-5 w-5 text-destructive" /><div><p className="text-2xl font-display">{users.filter((u) => !u.is_active).length}</p><p className="text-xs text-muted-foreground">Orphaned / Inactive</p></div></CardContent></Card>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading users...</div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Onboarding</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {(user.full_name || user.email || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">{user.full_name || '—'}</p>
                            <p className="text-xs text-muted-foreground">{user.email || '—'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{user.org_name || <span className="text-muted-foreground italic">None</span>}</TableCell>
                      <TableCell>
                        {user.role ? <Badge variant="outline" className="text-[10px] capitalize">{user.role}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {user.onboarding_completed ? <Badge variant="default" className="text-[10px]">Done</Badge> : <Badge variant="secondary" className="text-[10px]">Pending</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(user.created_at), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        {user.is_active ? <Badge variant="default" className="text-[10px]">Active</Badge> : <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit user" onClick={() => setEditTarget(user)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Reset password" onClick={() => setResetTarget(user)}><KeyRound className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                          {user.is_active && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Deactivate user" onClick={() => setDeactivateTarget(user)}><Ban className="h-3.5 w-3.5 text-amber-500" /></Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete user" onClick={() => setDeleteTarget(user)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{search ? 'No users match your search' : 'No users found'}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <UserEditDialog user={editTarget} allOrgs={allOrgs} onClose={() => setEditTarget(null)} />
      <UserResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />
      <UserDeactivateDialog user={deactivateTarget} isActioning={isActioning} onConfirm={handleDeactivate} onClose={() => setDeactivateTarget(null)} />
      <UserDeleteDialog user={deleteTarget} isActioning={isActioning} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
    </AppLayout>
  );
};

export default AdminUserList;
