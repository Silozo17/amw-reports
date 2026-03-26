import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const OrganisationSection = () => {
  const { profile, role } = useAuth();
  const { org } = useOrg();

  return (
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
  );
};

export default OrganisationSection;
