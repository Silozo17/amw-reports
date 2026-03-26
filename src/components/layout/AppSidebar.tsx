import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Plug,
  Settings,
  ScrollText,
  Bug,
  LogOut,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/connections', label: 'Connections', icon: Plug },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

const AppSidebar = ({ onNavigate }: AppSidebarProps) => {
  const { signOut, profile, role, isOwner } = useAuth();
  const { org } = useOrg();
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavClick = () => {
    onNavigate?.();
  };

  const orgName = org?.name ?? 'AMW';
  const orgInitial = orgName.charAt(0).toUpperCase();
  const initials = (profile?.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        {org?.logo_url ? (
          <img src={org.logo_url} alt={orgName} className="h-9 w-9 rounded object-contain" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded bg-primary text-primary-foreground font-display text-lg">
            {orgInitial}
          </div>
        )}
        <div>
          <h1 className="text-xl font-display tracking-wide text-primary">{orgName}</h1>
          <p className="text-[10px] tracking-[0.3em] text-sidebar-foreground/60 uppercase font-body">Reports</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.to === '/dashboard'
            ? location.pathname === '/dashboard'
            : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNavClick}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-body font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 hover:bg-sidebar-accent transition-colors text-left">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-sidebar-accent text-sidebar-primary text-xs font-body font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-body font-medium truncate">{profile?.full_name ?? 'User'}</p>
                <p className="text-xs text-sidebar-foreground/50 capitalize">{role ?? 'member'}</p>
              </div>
              <ChevronUp className="h-4 w-4 text-sidebar-foreground/40" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem onClick={() => { navigate('/settings'); handleNavClick(); }}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { navigate('/logs'); handleNavClick(); }}>
              <ScrollText className="mr-2 h-4 w-4" />
              Logs
            </DropdownMenuItem>
            {isOwner && (
              <DropdownMenuItem onClick={() => { navigate('/debug'); handleNavClick(); }}>
                <Bug className="mr-2 h-4 w-4" />
                Debug
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { signOut(); handleNavClick(); }}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};

export default AppSidebar;
