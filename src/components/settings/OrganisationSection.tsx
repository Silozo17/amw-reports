import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/contexts/OrgContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { sendBrandedEmail } from '@/lib/sendBrandedEmail';

interface TeamMember {
  id: string;
  org_id: string;
  user_id: string | null;
  role: 'owner' | 'manager';
  invited_email: string | null;
  accepted_at: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
}

const OrganisationSection = () => {
  const { role } = useAuth();
  const { org, orgId } = useOrg();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMembers = async () => {
    if (!orgId) return;
    const [membersRes, profilesRes] = await Promise.all([
      supabase.from('org_members').select('*').eq('org_id', orgId),
      supabase.from('profiles').select('user_id, full_name, email'),
    ]);

    const members = (membersRes.data ?? []) as Array<{
      id: string; org_id: string; user_id: string | null; role: 'owner' | 'manager';
      invited_email: string | null; accepted_at: string | null;
    }>;
    const profiles = (profilesRes.data ?? []) as Array<{ user_id: string; full_name: string | null; email: string | null }>;

    const enriched: TeamMember[] = members.map(m => ({
      ...m,
      profiles: m.user_id ? profiles.find(p => p.user_id === m.user_id) ?? null : null,
    }));
    setTeamMembers(enriched);
    setIsLoading(false);
  };

  useEffect(() => {
    if (orgId) fetchMembers();
  }, [orgId]);

  const handleRemoveMember = async (member: TeamMember) => {
    const removedEmail = member.profiles?.email ?? member.invited_email;
    const removedName = member.profiles?.full_name ?? member.invited_email ?? 'Unknown';

    const { error } = await supabase.from('org_members').delete().eq('id', member.id);
    if (error) {
      toast.error('Failed to remove');
    } else {
      toast.success('Member removed');

      // Send member_removed email (fire-and-forget)
      if (removedEmail && orgId) {
        sendBrandedEmail({
          templateName: 'member_removed',
          recipientEmail: removedEmail,
          orgId,
          data: {
            member_name: removedName,
            org_name: org?.name ?? 'your organisation',
          },
        }).catch(err => console.error('Failed to send member_removed email:', err));
      }

      fetchMembers();
    }
  };

  const handleRoleChange = async (memberId: string, member: TeamMember, newRole: 'owner' | 'manager') => {
    if (member.role === newRole) return;

    const { error } = await supabase
      .from('org_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (error) {
      toast.error('Failed to update role');
    } else {
      toast.success(`Role updated to ${newRole}`);

      const memberEmail = member.profiles?.email ?? member.invited_email;
      if (memberEmail && orgId) {
        sendBrandedEmail({
          templateName: 'role_changed',
          recipientEmail: memberEmail,
          orgId,
          data: {
            member_name: member.profiles?.full_name ?? memberEmail,
            old_role: member.role,
            new_role: newRole,
            org_name: org?.name ?? 'your organisation',
          },
        }).catch(err => console.error('Failed to send role_changed email:', err));
      }

      fetchMembers();
    }
  };

  return (
    <div className="space-y-6">
      {/* Org Details */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Organisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{org?.name ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Slug</span>
            <span>{org?.slug ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your Role</span>
            <Badge className="capitalize">{role}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-lg">Team Members</CardTitle>
          {orgId && <InviteDialog orgId={orgId} onInvite={fetchMembers} />}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No team members found</p>
          ) : (
            <div className="space-y-2">
              {teamMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-body font-medium">
                      {member.profiles?.full_name ?? member.invited_email ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.profiles?.email ?? member.invited_email ?? ''}
                      {!member.accepted_at && member.invited_email && (
                        <span className="ml-2 text-warning">· Pending invite</span>
                      )}
                    </p>
                  </div>
                   <div className="flex items-center gap-2">
                     {role === 'owner' && member.role !== 'owner' && (
                       <Select
                         value={member.role}
                         onValueChange={(v) => handleRoleChange(member.id, member, v as 'owner' | 'manager')}
                       >
                         <SelectTrigger className="h-7 w-[110px] text-xs">
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="manager">Manager</SelectItem>
                           <SelectItem value="owner">Owner</SelectItem>
                         </SelectContent>
                       </Select>
                     )}
                     {(role !== 'owner' || member.role === 'owner') && (
                       <Badge variant="outline" className="capitalize">{member.role}</Badge>
                     )}
                     {member.role !== 'owner' && (
                       <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRemoveMember(member)}>
                         <Trash2 className="h-3.5 w-3.5 text-destructive" />
                       </Button>
                     )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const InviteDialog = ({ orgId, onInvite }: { orgId: string; onInvite: () => void }) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'owner'>('manager');
  const [isLoading, setIsLoading] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    setIsLoading(true);

    const { error } = await supabase.from('org_members').insert({
      org_id: orgId,
      invited_email: email.trim().toLowerCase(),
      role: inviteRole,
      invited_at: new Date().toISOString(),
    });

    if (error) {
      toast.error(error.message.includes('unique') ? 'This email has already been invited' : 'Failed to send invite');
    } else {
      // Send team_invitation email (fire-and-forget)
      sendBrandedEmail({
        templateName: 'team_invitation',
        recipientEmail: email.trim().toLowerCase(),
        orgId,
        data: {
          invited_email: email.trim().toLowerCase(),
          role: inviteRole,
        },
      }).catch(err => console.error('Failed to send invite email:', err));

      toast.success(`Invite sent to ${email}`);
      setEmail('');
      setOpen(false);
      onInvite();
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <UserPlus className="h-3.5 w-3.5" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Invite Team Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email address</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="colleague@agency.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={inviteRole} onValueChange={v => setInviteRole(v as 'manager' | 'owner')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            When this person signs up with this email, they will automatically be added to your organisation.
          </p>
          <Button className="w-full gap-2" onClick={handleInvite} disabled={isLoading}>
            <Mail className="h-4 w-4" />
            {isLoading ? 'Inviting...' : 'Send Invite'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrganisationSection;
