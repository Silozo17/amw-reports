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
  Shield,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useState } from 'react';

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
  const { org, orgId, allMemberships, switchOrg } = useOrg();
  const { isPlatformAdmin } = usePlatformAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const [orgPopoverOpen, setOrgPopoverOpen] = useState(false);

  const handleNavClick = () => {
    onNavigate?.();
  };

  const orgName = org?.name ?? 'AMW';
  const orgInitial = orgName.charAt(0).toUpperCase();
  const initials = (profile?.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const hasMultipleOrgs = allMemberships.length > 1;

  const orgHeader = (
    <div className="flex items-center gap-3">
      {org?.logo_url ? (
        <img src={org.logo_url} alt={orgName} className="h-9 w-9 rounded object-contain" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded bg-primary text-primary-foreground font-display text-lg">
          {orgInitial}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-display tracking-wide text-primary truncate">{orgName}</h1>
        <p className="text-[10px] tracking-[0.3em] text-sidebar-foreground/60 uppercase font-body">Reports</p>
      </div>
      {hasMultipleOrgs && (
        <ChevronsUpDown className="h-4 w-4 text-sidebar-foreground/40 shrink-0" />
      )}
    </div>
  );

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="border-b border-sidebar-border">
        {hasMultipleOrgs ? (
          <Popover open={orgPopoverOpen} onOpenChange={setOrgPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="flex w-full items-center px-6 py-5 hover:bg-sidebar-accent transition-colors text-left">
                {orgHeader}
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-60 p-1">
              {allMemberships.map((m) => (
                <button
                  key={m.org_id}
                  onClick={() => {
                    switchOrg(m.org_id);
                    setOrgPopoverOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-accent',
                    m.org_id === orgId && 'bg-accent'
                  )}
                >
                  {m.org_logo ? (
                    <img src={m.org_logo} alt={m.org_name} className="h-6 w-6 rounded object-contain" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-display">
                      {m.org_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 truncate font-body">{m.org_name}</span>
                  {m.org_id === orgId && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        ) : (
          <div className="px-6 py-5">{orgHeader}</div>
        )}
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
            {isPlatformAdmin && (
              <DropdownMenuItem onClick={() => { navigate('/admin'); handleNavClick(); }}>
                <Shield className="mr-2 h-4 w-4" />
                Platform Admin
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
