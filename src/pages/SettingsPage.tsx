import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, UserPlus, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_LABELS, METRIC_LABELS } from '@/types/database';
import type { PlatformType } from '@/types/database';
import AccountSection from '@/components/settings/AccountSection';
import OrganisationSection from '@/components/settings/OrganisationSection';
import BrandingSection from '@/components/settings/BrandingSection';
import ReportSettingsSection from '@/components/settings/ReportSettingsSection';

interface TeamMember {
  id: string;
  org_id: string;
  user_id: string | null;
  role: 'owner' | 'manager';
  invited_email: string | null;
  accepted_at: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
}

interface MetricDefault {
  id: string;
  platform: PlatformType;
  available_metrics: string[];
  default_metrics: string[];
}

const PLATFORMS: PlatformType[] = ['google_ads', 'meta_ads', 'facebook', 'instagram', 'tiktok', 'linkedin'];

const ALL_METRICS = Object.keys(METRIC_LABELS);

const SettingsPage = () => {
  const { isOwner } = useAuth();
  const { orgId } = useOrg();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [metricDefaults, setMetricDefaults] = useState<MetricDefault[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    if (!orgId) return;

    const [membersRes, defaultsRes, profilesRes] = await Promise.all([
      supabase.from('org_members').select('*').eq('org_id', orgId),
      supabase.from('metric_defaults').select('*'),
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
    setMetricDefaults((defaultsRes.data as MetricDefault[]) ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    if (orgId) fetchData();
  }, [orgId]);

  const handleRemoveMember = async (id: string) => {
    const { error } = await supabase.from('org_members').delete().eq('id', id);
    if (error) toast.error('Failed to remove');
    else {
      toast.success('Member removed');
      fetchData();
    }
  };

  const initDefaults = async (platform: PlatformType) => {
    const existing = metricDefaults.find(d => d.platform === platform);
    if (existing) return;

    const { error } = await supabase.from('metric_defaults').insert({
      platform,
      available_metrics: ALL_METRICS,
      default_metrics: ALL_METRICS.slice(0, 8),
    });

    if (error) toast.error('Failed to create defaults');
    else fetchData();
  };

  const toggleDefaultMetric = async (platform: PlatformType, metric: string, enabled: boolean) => {
    const def = metricDefaults.find(d => d.platform === platform);
    if (!def) return;

    const newDefaults = enabled
      ? [...def.default_metrics, metric]
      : def.default_metrics.filter(m => m !== metric);

    const { error } = await supabase.from('metric_defaults')
      .update({ default_metrics: newDefaults })
      .eq('id', def.id);

    if (error) toast.error('Failed to update');
    else fetchData();
  };

  if (!isOwner) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Shield className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">Owner access required</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-display">Settings</h1>
          <p className="text-muted-foreground font-body mt-1">Organisation & platform configuration</p>
        </div>

        <AccountSection />
        <OrganisationSection />
        <BrandingSection />
        <ReportSettingsSection />

        {/* Team Members */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-lg">Team Members</CardTitle>
            {orgId && <InviteDialog orgId={orgId} onInvite={fetchData} />}
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
                      <Badge variant="outline" className="capitalize">{member.role}</Badge>
                      {member.role !== 'owner' && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRemoveMember(member.id)}>
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

        {/* Metric Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Platform Metric Defaults</CardTitle>
            <p className="text-sm text-muted-foreground">Configure default metrics for each platform. Clients inherit these unless overridden.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {PLATFORMS.map(platform => {
              const def = metricDefaults.find(d => d.platform === platform);
              return (
                <div key={platform} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-body font-semibold">{PLATFORM_LABELS[platform]}</h3>
                    {!def && (
                      <Button size="sm" variant="outline" onClick={() => initDefaults(platform)}>
                        Initialize Defaults
                      </Button>
                    )}
                  </div>
                  {def && (
                    <div className="flex flex-wrap gap-2">
                      {ALL_METRICS.map(metric => {
                        const isOn = def.default_metrics.includes(metric);
                        return (
                          <Badge
                            key={metric}
                            variant={isOn ? 'default' : 'outline'}
                            className="cursor-pointer transition-colors text-xs"
                            onClick={() => toggleDefaultMetric(platform, metric, !isOn)}
                          >
                            {METRIC_LABELS[metric]}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
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

export default SettingsPage;
