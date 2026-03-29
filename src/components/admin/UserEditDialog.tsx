import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface UserRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  position: string | null;
  created_at: string;
  org_id: string | null;
  onboarding_completed: boolean | null;
  org_name: string | null;
  role: string | null;
  membership_id: string | null;
  is_active: boolean;
}

interface OrgOption {
  id: string;
  name: string;
}

interface UserEditDialogProps {
  user: UserRow | null;
  allOrgs: OrgOption[];
  onClose: () => void;
}

const UserEditDialog = ({ user, allOrgs, onClose }: UserEditDialogProps) => {
  const queryClient = useQueryClient();
  const [editName, setEditName] = useState(user?.full_name ?? '');
  const [editEmail, setEditEmail] = useState(user?.email ?? '');
  const [editPhone, setEditPhone] = useState(user?.phone ?? '');
  const [editPosition, setEditPosition] = useState(user?.position ?? '');
  const [editOrgId, setEditOrgId] = useState(user?.org_id ?? '');
  const [editRole, setEditRole] = useState(user?.role ?? 'manager');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: editName.trim() || null,
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        position: editPosition.trim() || null,
        org_id: editOrgId || null,
      }).eq('user_id', user.user_id);
      if (profileError) throw profileError;

      const oldOrgId = user.org_id;
      const newOrgId = editOrgId || null;

      if (oldOrgId !== newOrgId) {
        if (user.membership_id) {
          await supabase.from('org_members').delete().eq('id', user.membership_id);
        }
        if (newOrgId) {
          const { error: memberError } = await supabase.from('org_members').insert({
            org_id: newOrgId, user_id: user.user_id, role: editRole, accepted_at: new Date().toISOString(),
          });
          if (memberError) throw memberError;
        }
      } else if (user.membership_id && editRole !== user.role) {
        await supabase.from('org_members').update({ role: editRole }).eq('id', user.membership_id);
      }

      toast.success(`${editName || editEmail} updated`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update profile, organisation, and role for {user?.full_name || user?.email}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Input value={editPosition} onChange={(e) => setEditPosition(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Organisation</Label>
            <Select value={editOrgId} onValueChange={setEditOrgId}>
              <SelectTrigger><SelectValue placeholder="No organisation" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No organisation</SelectItem>
                {allOrgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={editRole} onValueChange={setEditRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserEditDialog;
