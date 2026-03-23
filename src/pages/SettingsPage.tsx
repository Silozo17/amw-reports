import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Shield, UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_LABELS, METRIC_LABELS } from '@/types/database';
import type { PlatformType } from '@/types/database';

interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'manager';
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
  const { isOwner, profile, role } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [metricDefaults, setMetricDefaults] = useState<MetricDefault[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    const [membersRes, defaultsRes] = await Promise.all([
      supabase.from('user_roles').select('*, profiles!user_roles_user_id_fkey(full_name, email)'),
      supabase.from('metric_defaults').select('*'),
    ]);

    // The join may fail due to missing FK — fallback to separate query
    let members = (membersRes.data as TeamMember[]) ?? [];
    if (membersRes.error) {
      const { data: roles } = await supabase.from('user_roles').select('*');
      members = (roles as TeamMember[]) ?? [];
    }
    setTeamMembers(members);
    setMetricDefaults((defaultsRes.data as MetricDefault[]) ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRemoveRole = async (id: string) => {
    const { error } = await supabase.from('user_roles').delete().eq('id', id);
    if (error) toast.error('Failed to remove');
    else {
      toast.success('Role removed');
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
          <p className="text-muted-foreground font-body mt-1">Platform configuration (Owner only)</p>
        </div>

        {/* Account */}
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Your Account</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{profile?.full_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{profile?.email}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Role</span><Badge className="capitalize">{role}</Badge></div>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-lg">Team Members</CardTitle>
            <InviteDialog onInvite={fetchData} />
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
                        {member.profiles?.full_name ?? member.profiles?.email ?? member.user_id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.profiles?.email ?? 'No email'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">{member.role}</Badge>
                      {member.role !== 'owner' && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRemoveRole(member.id)}>
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

/* Invite Dialog — simplified since signups are disabled, 
   this creates a user_role entry. In practice, the owner would 
   need to re-enable signups temporarily or use an invite flow. */
const InviteDialog = ({ onInvite }: { onInvite: () => void }) => {
  const [open, setOpen] = useState(false);

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
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            To invite a team member, temporarily enable signups, have them create an account, then assign their role here. 
            Contact support for a streamlined invite flow.
          </p>
          <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsPage;
