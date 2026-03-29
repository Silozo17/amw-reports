import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Users, Trash2, Pencil, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string | null;
  role: string;
  invited_email: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

interface ProfileInfo {
  full_name: string | null;
  email: string | null;
}

interface AdminOrgMembersProps {
  orgId: string;
  members: OrgMember[];
  profileMap: Record<string, ProfileInfo>;
}

const AdminOrgMembers = ({ orgId, members, profileMap }: AdminOrgMembersProps) => {
  const queryClient = useQueryClient();

  // Edit member state
  const [editMember, setEditMember] = useState<OrgMember | null>(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberEmail, setEditMemberEmail] = useState('');
  const [editMemberRole, setEditMemberRole] = useState('');
  const [isSavingMember, setIsSavingMember] = useState(false);

  // Add member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberRole, setAddMemberRole] = useState('manager');
  const [isAddingMember, setIsAddingMember] = useState(false);

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from('org_members').delete().eq('id', memberId);
    if (error) { toast.error('Failed to remove member'); console.error(error); }
    else {
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: ['admin-org-members', orgId] });
    }
  };

  const openEditMember = (member: OrgMember) => {
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
      if (editMemberRole !== editMember.role) {
        const { error } = await supabase.from('org_members').update({ role: editMemberRole }).eq('id', editMember.id);
        if (error) throw error;
      }
      if (editMember.user_id) {
        const { error } = await supabase.from('profiles').update({
          full_name: editMemberName.trim() || null,
          email: editMemberEmail.trim() || null,
        }).eq('user_id', editMember.user_id);
        if (error) throw error;
      }
      toast.success('Member updated');
      queryClient.invalidateQueries({ queryKey: ['admin-org-members', orgId] });
      queryClient.invalidateQueries({ queryKey: ['admin-org-profiles', orgId] });
      setEditMember(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update member');
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleAddMember = async () => {
    const email = addMemberEmail.trim().toLowerCase();
    if (!email) return;
    setIsAddingMember(true);
    try {
      const { data: existingProfile } = await supabase.from('profiles').select('user_id').eq('email', email).maybeSingle();
      if (existingProfile) {
        const { error } = await supabase.from('org_members').insert({
          org_id: orgId, user_id: existingProfile.user_id, role: addMemberRole, accepted_at: new Date().toISOString(),
        });
        if (error) throw error;
        await supabase.from('profiles').update({ org_id: orgId }).eq('user_id', existingProfile.user_id);
        toast.success('User linked to organisation');
      } else {
        const { error } = await supabase.from('org_members').insert({
          org_id: orgId, invited_email: email, role: addMemberRole, invited_at: new Date().toISOString(),
        });
        if (error) throw error;
        toast.success('Invite created — user will be linked on signup');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-org-members', orgId] });
      setAddMemberEmail('');
      setAddMemberRole('manager');
      setShowAddMember(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <Button size="sm" className="gap-2" onClick={() => setShowAddMember(true)}>
              <UserPlus className="h-4 w-4" />
              Add Member
            </Button>
          </div>
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
                      <TableCell className="font-medium">{profile?.full_name ?? member.invited_email ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{profile?.email ?? member.invited_email ?? '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{member.role}</Badge></TableCell>
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

      {/* Add Member Dialog */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Link an existing user by email or create a pending invite for a new user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                value={addMemberEmail}
                onChange={(e) => setAddMemberEmail(e.target.value)}
                type="email"
                placeholder="user@example.com"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={addMemberRole} onValueChange={setAddMemberRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMember(false)}>Cancel</Button>
            <Button onClick={handleAddMember} disabled={isAddingMember || !addMemberEmail.trim()}>
              {isAddingMember ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminOrgMembers;
