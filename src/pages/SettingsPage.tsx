import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';

const SettingsPage = () => {
  const { isOwner, profile, role } = useAuth();

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
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-display">Settings</h1>
          <p className="text-muted-foreground font-body mt-1">Platform configuration (Owner only)</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Your Account</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span>{profile?.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{profile?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <Badge className="capitalize">{role}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Platform Defaults</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Default metric sets and report templates will be configurable here.
              User management and branding settings coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
