import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useOrg } from '@/contexts/OrgContext';
import { Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AccountSection from '@/components/settings/AccountSection';
import OrganisationSection from '@/components/settings/OrganisationSection';
import BrandingSection from '@/components/settings/BrandingSection';
import ReportSettingsSection from '@/components/settings/ReportSettingsSection';
import CustomDomainSection from '@/components/settings/CustomDomainSection';
import MetricsDefaultsSection from '@/components/settings/MetricsDefaultsSection';
import BillingSection from '@/components/settings/BillingSection';
import UpsellsOverviewSection from '@/components/settings/UpsellsOverviewSection';

const SettingsPage = () => {
  const { isPlatformAdmin } = useAuth();
  const { orgRole } = useOrg();
  const { hasWhitelabel } = useEntitlements();

  const isOrgOwner = orgRole === 'owner';
  const isOrgManager = orgRole === 'manager';
  const canAccessSettings = isOrgOwner || isPlatformAdmin || isOrgManager;

  if (!canAccessSettings) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Shield className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">Access denied</p>
        </div>
      </AppLayout>
    );
  }

  const canManageOrg = isOrgOwner || isPlatformAdmin;
  const canManageMetrics = isOrgOwner || isPlatformAdmin;
  const canManageBilling = isOrgOwner || isPlatformAdmin;
  const showWhitelabel = hasWhitelabel;

  // Build visible tabs
  const tabs: { value: string; label: string }[] = [];
  if (canManageOrg) tabs.push({ value: 'organisation', label: 'Organisation' });
  tabs.push({ value: 'account', label: 'Account' });
  if (showWhitelabel) tabs.push({ value: 'whitelabel', label: 'White Label' });
  if (canManageMetrics) tabs.push({ value: 'metrics', label: 'Metrics' });
  tabs.push({ value: 'upsells', label: 'Upsells' });
  if (canManageBilling) tabs.push({ value: 'billing', label: 'Billing' });

  const defaultTab = tabs[0]?.value ?? 'account';

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-display">Settings</h1>
          <p className="text-muted-foreground font-body mt-1">Organisation & platform configuration</p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="flex w-full">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex-1">{tab.label}</TabsTrigger>
            ))}
          </TabsList>

          {canManageOrg && (
            <TabsContent value="organisation" className="space-y-6 mt-6">
              <OrganisationSection />
            </TabsContent>
          )}

          <TabsContent value="account" className="space-y-6 mt-6">
            <AccountSection />
          </TabsContent>

          {showWhitelabel && (
            <TabsContent value="whitelabel" className="space-y-6 mt-6">
              <BrandingSection />
              <ReportSettingsSection />
              <CustomDomainSection />
            </TabsContent>
          )}

          {canManageMetrics && (
            <TabsContent value="metrics" className="space-y-6 mt-6">
              <MetricsDefaultsSection />
            </TabsContent>
          )}

          <TabsContent value="upsells" className="space-y-6 mt-6">
            <UpsellsOverviewSection />
          </TabsContent>

          {canManageBilling && (
            <TabsContent value="billing" className="space-y-6 mt-6">
              <BillingSection />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
