import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Users, Trash2, Ban, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UserRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  org_id: string | null;
  onboarding_completed: boolean | null;
  org_name: string | null;
  role: string | null;
  is_active: boolean;
}

const AdminUserList = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null);
  const [isActioning, setIsActioning] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!profiles) return [];

      // Get all org memberships
      const { data: memberships } = await supabase
        .from('org_members')
        .select('user_id, org_id, role');

      // Get all orgs
      const { data: orgs } = await supabase
        .from('organisations')
        .select('id, name');

      const orgMap = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
      const memberMap = Object.fromEntries(
        (memberships ?? []).filter((m) => m.user_id).map((m) => [m.user_id!, m])
      );

      return profiles.map((p): UserRow => {
        const membership = memberMap[p.user_id];
        return {
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          avatar_url: p.avatar_url,
          created_at: p.created_at,
          org_id: p.org_id,
          onboarding_completed: p.onboarding_completed,
          org_name: p.org_id ? orgMap[p.org_id] ?? null : null,
          role: membership?.role ?? null,
          is_active: !!membership,
        };
      });
    },
  });

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      u.org_name?.toLowerCase().includes(s)
    );
  });

  const handleDeactivate = async (user: UserRow) => {
    setIsActioning(true);
    try {
      // Remove from org_members to deactivate
      const { error } = await supabase
        .from('org_members')
        .delete()
        .eq('user_id', user.user_id);
      if (error) throw error;

      // Clear org_id from profile
      await supabase
        .from('profiles')
        .update({ org_id: null })
        .eq('user_id', user.user_id);

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
      // Remove org membership
      await supabase.from('org_members').delete().eq('user_id', user.user_id);
      // Remove profile
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
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display">Users</h1>
            <p className="text-muted-foreground font-body mt-1">
              Manage all platform users ({users.length} total)
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or org..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-display">{users.length}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-accent" />
              <div>
                <p className="text-2xl font-display">{users.filter((u) => u.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Ban className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-display">{users.filter((u) => !u.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Orphaned / Inactive</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading users...
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">All Users</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Onboarding</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
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
                        {user.role ? (
                          <Badge variant="outline" className="text-[10px] capitalize">{user.role}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.onboarding_completed ? (
                          <Badge variant="default" className="text-[10px]">Done</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(user.created_at), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <Badge variant="default" className="text-[10px]">Active</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {user.is_active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Deactivate user"
                              onClick={() => setDeactivateTarget(user)}
                            >
                              <Ban className="h-3.5 w-3.5 text-amber-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Delete user"
                            onClick={() => setDeleteTarget(user)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {search ? 'No users match your search' : 'No users found'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Deactivate Dialog */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={() => setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{deactivateTarget?.full_name || deactivateTarget?.email}</strong> from
              their organisation. They will lose access but can be re-invited later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActioning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateTarget && handleDeactivate(deactivateTarget)}
              disabled={isActioning}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isActioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong>'s
              profile and organisation membership. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActioning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={isActioning}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isActioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminUserList;
