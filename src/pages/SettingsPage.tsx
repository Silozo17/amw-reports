import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AccountSection from '@/components/settings/AccountSection';
import OrganisationSection from '@/components/settings/OrganisationSection';
import BrandingSection from '@/components/settings/BrandingSection';
import ReportSettingsSection from '@/components/settings/ReportSettingsSection';
import CustomDomainSection from '@/components/settings/CustomDomainSection';
import MetricsDefaultsSection from '@/components/settings/MetricsDefaultsSection';

const SettingsPage = () => {
  const { isOwner } = useAuth();

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

        <Tabs defaultValue="organisation" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="organisation">Organisation</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="whitelabel">White Label</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="organisation" className="space-y-6 mt-6">
            <OrganisationSection />
          </TabsContent>

          <TabsContent value="account" className="space-y-6 mt-6">
            <AccountSection />
          </TabsContent>

          <TabsContent value="whitelabel" className="space-y-6 mt-6">
            <BrandingSection />
            <ReportSettingsSection />
            <CustomDomainSection />
          </TabsContent>

          <TabsContent value="metrics" className="space-y-6 mt-6">
            <MetricsDefaultsSection />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
