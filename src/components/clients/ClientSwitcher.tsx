import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronsUpDown, Check, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ClientSwitcherProps {
  currentClientId: string;
}

interface ClientOption {
  id: string;
  company_name: string;
  logo_url: string | null;
}

const ClientSwitcher = ({ currentClientId }: ClientSwitcherProps) => {
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from('clients')
      .select('id, company_name, logo_url')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('company_name')
      .then(({ data }) => {
        if (data) setClients(data);
      });
  }, [orgId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c => c.company_name.toLowerCase().includes(q));
  }, [clients, search]);

  if (clients.length <= 1) return null;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center justify-center rounded-md p-1.5 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Switch client"
        >
          <ChevronsUpDown className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No clients found</p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                if (c.id !== currentClientId) navigate(`/clients/${c.id}`);
                setOpen(false);
                setSearch('');
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-accent',
                c.id === currentClientId && 'bg-accent'
              )}
            >
              {c.logo_url ? (
                <img src={c.logo_url} alt={c.company_name} className="h-6 w-6 rounded object-contain" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-display">
                  {c.company_name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="flex-1 truncate font-body text-left">{c.company_name}</span>
              {c.id === currentClientId && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ClientSwitcher;
