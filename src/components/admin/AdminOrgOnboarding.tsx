import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import type { OrgMember } from '@/components/admin/AdminOrgMembers';

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: 'Google Ads', meta_ads: 'Meta Ads', facebook: 'Facebook',
  instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn',
  google_search_console: 'Search Console', google_analytics: 'Analytics',
  google_business_profile: 'Google Business', youtube: 'YouTube',
};

interface AdminOrgOnboardingProps {
  orgId: string;
  members: OrgMember[];
  profileMap: Record<string, { full_name: string | null; email: string | null }>;
}

const AdminOrgOnboarding = ({ orgId, members, profileMap }: AdminOrgOnboardingProps) => {
  const { data: onboardingData = [], isLoading } = useQuery({
    queryKey: ['admin-onboarding', orgId],
    queryFn: async () => {
      const userIds = members.filter(m => m.user_id).map(m => m.user_id!);
      if (userIds.length === 0) return [];
      const { data } = await supabase.from('onboarding_responses').select('*').in('user_id', userIds);
      return data ?? [];
    },
    enabled: members.length > 0,
  });

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
              {onboardingData.map((row) => {
                const profile = profileMap[row.user_id];
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{profile?.full_name ?? row.user_id}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-[10px]">{row.account_type}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                      {(row.platforms_used ?? []).map((p: string) => PLATFORM_LABELS[p] ?? p).join(', ') || '—'}
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
};

export default AdminOrgOnboarding;
