import { ReactNode, useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOrg } from '@/contexts/OrgContext';
import AppSidebar from './AppSidebar';
import BillingStatusBanner from './BillingStatusBanner';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { org } = useOrg();

  const orgName = org?.name ?? 'AMW';

  if (isMobile) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <BillingStatusBanner />
        <header className="flex h-14 items-center gap-3 border-b border-border bg-sidebar px-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 border-r-0">
              <AppSidebar onNavigate={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            {org?.logo_url ? (
              <img src={org.logo_url} alt={orgName} className="h-7 w-7 rounded object-contain" />
            ) : null}
            <h1 className="text-lg font-display tracking-wide text-primary">{orgName}</h1>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-4">
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <BillingStatusBanner />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
