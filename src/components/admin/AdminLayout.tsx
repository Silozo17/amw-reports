import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, ScrollText, ArrowLeft, Menu, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/admin/organisations', label: 'Organisations', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/activity', label: 'Activity Log', icon: ScrollText },
];

interface AdminLayoutProps {
  children: ReactNode;
}

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const navigate = useNavigate();

  return (
    <>
      <div className="px-6 py-5 border-b border-border">
        <h1 className="text-xl font-display text-primary">AMW Admin</h1>
        <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase font-body">Platform Management</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {ADMIN_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            onClick={onNavigate}
            className={({ isActive }) => cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-body font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-4">
        <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => { onNavigate?.(); navigate('/dashboard'); }}>
          <ArrowLeft className="h-4 w-4" />
          Back to App
        </Button>
      </div>
    </>
  );
};

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <SidebarContent onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <h1 className="text-lg font-display text-primary">AMW Admin</h1>
        </header>
        <main className="p-4 overflow-auto">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex h-screen w-64 flex-col border-r border-border bg-card sticky top-0">
        <SidebarContent />
      </aside>
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
