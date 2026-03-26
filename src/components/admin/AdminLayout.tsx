import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/admin/organisations', label: 'Organisations', icon: Building2 },
];

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex h-screen w-64 flex-col border-r border-border bg-card sticky top-0">
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
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
