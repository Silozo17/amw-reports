import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Settings,
  ScrollText,
  Bug,
  LogOut,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Shield,
  ChevronsUpDown,
  Check,
  Bell,
  Building2,
  Activity,
  Sparkles,
  KanbanSquare,
  Lightbulb,
  Heart,
  TrendingUp,
  Anchor,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/contexts/OrgContext';
import { useInvites } from '@/hooks/useInvites';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

const BASE_NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
];

const CONTENT_LAB_SUB_ITEMS = [
  { to: '/content-pipeline', label: 'Content Pipeline', icon: KanbanSquare },
  { to: '/ideas', label: 'Ideas', icon: Lightbulb },
  { to: '/content-lab/trends', label: 'Trends', icon: TrendingUp, comingSoon: true },
  { to: '/content-lab/hooks', label: 'Hook Library', icon: Anchor },
  { to: '/content-lab/swipe-file', label: 'Swipe File', icon: Heart },
];

const TAIL_NAV_ITEMS = [
  { to: '/settings', label: 'Settings', icon: Settings },
];

const ADMIN_SUB_ITEMS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/admin/organisations', label: 'Organisations', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/activity', label: 'Activity Log', icon: Activity },
  { to: '/admin/content-lab', label: 'Content Lab', icon: Sparkles },
  { to: '/debug', label: 'Debug', icon: Bug },
  { to: '/logs', label: 'Logs', icon: ScrollText },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

const AppSidebar = ({ onNavigate }: AppSidebarProps) => {
  const { signOut, profile, role, isOwner, isPlatformAdmin } = useAuth();
  const { org, orgId, allMemberships, switchOrg } = useOrg();
  const { hasAccess: hasContentLabAccess, canGenerate: canGenerateContentLab } = useContentLabAccess();
  
  const { pendingInvites, acceptInvite, declineInvite } = useInvites();
  const location = useLocation();
  const navigate = useNavigate();
  const [orgPopoverOpen, setOrgPopoverOpen] = useState(false);
  const [invitePopoverOpen, setInvitePopoverOpen] = useState(false);

  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname === '/debug' || location.pathname === '/logs';
  const [adminOpen, setAdminOpen] = useState(isAdminRoute);
  const isContentLabRoute = location.pathname.startsWith('/content-lab') || location.pathname === '/content-pipeline' || location.pathname === '/ideas';
  const [contentLabOpen, setContentLabOpen] = useState(isContentLabRoute);

  // Subtle "run in progress" pulse on the Content Lab parent.
  const { data: hasActiveRun = false } = useQuery({
    queryKey: ['content-lab-active-run', orgId],
    enabled: !!orgId && hasContentLabAccess,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_runs')
        .select('id')
        .eq('org_id', orgId!)
        .in('status', ['scraping', 'analysing', 'ideating', 'pending'])
        .limit(1);
      if (error) return false;
      return (data?.length ?? 0) > 0;
    },
  });

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
        {org?.show_org_name !== false && (
          <h1 className="text-xl font-display tracking-wide text-primary truncate">{orgName}</h1>
        )}
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
                    navigate('/clients');
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

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {BASE_NAV_ITEMS.map((item) => {
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

        {/* Content Lab collapsible section */}
        {hasContentLabAccess && (
          <Collapsible open={contentLabOpen} onOpenChange={setContentLabOpen}>
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-body font-medium transition-colors',
                  isContentLabRoute
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <Sparkles className={cn('h-4 w-4', hasActiveRun && 'animate-pulse text-primary')} />
                <span className="flex-1 text-left">Content Lab</span>
                {hasActiveRun && (
                  <span className="mr-1 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                )}
                {contentLabOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                {canGenerateContentLab && (
                  <NavLink
                    to="/content-lab"
                    onClick={handleNavClick}
                    end
                    className={({ isActive }) => cn(
                      'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-body font-semibold transition-colors',
                      isActive
                        ? 'bg-primary/10 text-sidebar-primary'
                        : 'text-sidebar-primary/80 hover:bg-sidebar-accent'
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Run
                  </NavLink>
                )}
                {CONTENT_LAB_SUB_ITEMS.map((item) => {
                  const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={handleNavClick}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-body font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-primary'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      <span className="flex-1">{item.label}</span>
                      {'comingSoon' in item && item.comingSoon && (
                        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                          Soon
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {TAIL_NAV_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
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

        {/* Platform Admin collapsible section */}
        {isPlatformAdmin && (
          <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-body font-medium transition-colors',
                  isAdminRoute
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <Shield className="h-4 w-4" />
                <span className="flex-1 text-left">Platform Admin</span>
                {adminOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                {ADMIN_SUB_ITEMS.map((item) => {
                  const isActive = item.exact
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={handleNavClick}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-body font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-primary'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </nav>

      {pendingInvites.length > 0 && (
        <div className="border-t border-sidebar-border px-3 pt-3">
          <Popover open={invitePopoverOpen} onOpenChange={setInvitePopoverOpen}>
            <PopoverTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 hover:bg-sidebar-accent transition-colors text-left text-sm font-body font-medium text-sidebar-foreground/70">
                <div className="relative">
                  <Bell className="h-4 w-4" />
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {pendingInvites.length}
                  </span>
                </div>
                Invitations
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-72 p-2">
              <p className="px-2 pb-2 text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">
                Pending Invites
              </p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="rounded-md border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      {invite.org_logo ? (
                        <img src={invite.org_logo} alt={invite.org_name} className="h-6 w-6 rounded object-contain" />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-display">
                          {invite.org_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-body font-medium truncate">{invite.org_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{invite.role}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { acceptInvite(invite.id); setInvitePopoverOpen(false); }}
                        className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineInvite(invite.id)}
                        className="flex-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

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
