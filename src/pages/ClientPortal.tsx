import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { getCurrencySymbol } from '@/types/database';
import ClientDashboard from '@/components/clients/ClientDashboard';
import { hexToHsl } from '@/lib/colorUtils';
import usePageMeta from '@/hooks/usePageMeta';
import type { SelectedPeriod, PeriodType } from '@/components/clients/DashboardHeader';
import type { ClientPortalUpsell } from '@/types/database';

interface PortalOrg {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  heading_font: string | null;
  body_font: string | null;
}

interface PortalClient {
  id: string;
  company_name: string;
  full_name: string;
  logo_url: string | null;
  preferred_currency: string;
  org_id: string;
  show_health_score?: boolean;
  show_portal_upsells?: boolean;
}

const applyBranding = (org: PortalOrg) => {
  const root = document.documentElement;
  if (org.primary_color) {
    const hsl = org.primary_color.startsWith('#') ? hexToHsl(org.primary_color) : org.primary_color;
    if (hsl) root.style.setProperty('--primary', hsl);
  }
  if (org.heading_font) {
    root.style.setProperty('--font-heading', org.heading_font);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(org.heading_font)}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }
  if (org.body_font) {
    root.style.setProperty('--font-body', org.body_font);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(org.body_font)}:wght@300;400;500;600&display=swap`;
    document.head.appendChild(link);
  }
};

const VALID_PERIOD_TYPES = new Set<PeriodType>(['weekly', 'monthly', 'quarterly', 'ytd', 'last_year', 'maximum', 'custom']);

/** Parse full period from URL query params. Returns null if no period info present. */
const parsePeriodFromQuery = (searchParams: URLSearchParams): SelectedPeriod | null => {
  const type = searchParams.get('type') as PeriodType | null;
  const monthStr = searchParams.get('month');
  const yearStr = searchParams.get('year');
  const periodStr = searchParams.get('period');
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');

  // Period offset takes priority over explicit month/year
  // period=0 = current month, period=1 = last month, etc.
  if (periodStr !== null) {
    const offset = parseInt(periodStr, 10);
    if (!isNaN(offset) && offset >= 0) {
      const target = new Date();
      target.setMonth(target.getMonth() - offset);
      return {
        type: 'monthly',
        month: target.getMonth() + 1,
        year: target.getFullYear(),
      };
    }
  }

  // Explicit format: type + month + year
  if (type && VALID_PERIOD_TYPES.has(type) && monthStr && yearStr) {
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    if (!isNaN(month) && !isNaN(year) && month >= 1 && month <= 12) {
      const period: SelectedPeriod = { type, month, year };
      if (type === 'custom' && startDateStr && endDateStr) {
        period.startDate = new Date(startDateStr);
        period.endDate = new Date(endDateStr);
      }
      return period;
    }
  }

  return null;
};

const ClientPortal = () => {
  usePageMeta({ title: 'Client Dashboard — AMW Reports', description: 'View your marketing performance dashboard.' });
  const { token } = useParams<{ token: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialPeriod = useMemo(() => parsePeriodFromQuery(searchParams), [searchParams]);

  const handlePeriodChange = useCallback((period: SelectedPeriod) => {
    const params = new URLSearchParams();
    if (period.type === 'monthly') {
      const now = new Date();
      const offset = (now.getFullYear() - period.year) * 12 +
                     (now.getMonth() + 1 - period.month);
      params.set('period', String(Math.max(0, offset)));
    } else if (period.type === 'custom' &&
               period.startDate && period.endDate) {
      params.set('type', 'custom');
      params.set('startDate',
        period.startDate.toISOString().slice(0, 10));
      params.set('endDate',
        period.endDate.toISOString().slice(0, 10));
    } else {
      params.set('type', period.type);
    }
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  const [client, setClient] = useState<PortalClient | null>(null);
  const [org, setOrg] = useState<PortalOrg | null>(null);
  const [portalUpsells, setPortalUpsells] = useState<ClientPortalUpsell[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!token) { setError('Invalid link'); setIsLoading(false); return; }

      const { data, error: fnErr } = await supabase.functions.invoke('portal-data', {
        body: { token },
      });

      if (fnErr || data?.error) {
        setError(data?.error ?? fnErr?.message ?? 'Failed to load dashboard');
        setIsLoading(false);
        return;
      }

      setClient(data.client);
      setOrg(data.org);
      setPortalUpsells((data.portalUpsells ?? []) as ClientPortalUpsell[]);
      if (data.org) applyBranding(data.org);
      setIsLoading(false);
    };

    load();
  }, [token]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !client || !org) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-display text-foreground mb-2">Dashboard Unavailable</h1>
          <p className="text-muted-foreground">{error ?? 'Something went wrong.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {org.logo_url && (
              <img src={org.logo_url} alt={org.name} className="h-7 sm:h-8 w-auto object-contain shrink-0" />
            )}
            <span className="font-display text-base sm:text-lg text-foreground truncate">{org.name}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {client.logo_url && (
              <img src={client.logo_url} alt={client.company_name} className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg object-contain border bg-muted shrink-0" />
            )}
            <span className="text-xs sm:text-sm text-muted-foreground font-body truncate">{client.company_name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <ClientDashboard
          clientId={client.id}
          clientName={client.company_name}
          currencyCode={client.preferred_currency}
          portalToken={token}
          initialMonth={initialPeriod?.month}
          initialYear={initialPeriod?.year}
          initialPeriod={initialPeriod ?? undefined}
          disableAutoDetect={!!initialPeriod}
          showHealthScore={client.show_health_score !== false}
          portalUpsells={client.show_portal_upsells !== false ? portalUpsells : []}
          onPeriodChange={handlePeriodChange}
        />
      </main>

      <footer className="border-t bg-card px-4 sm:px-6 py-4 mt-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs text-muted-foreground">
            Powered by {org.name}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ClientPortal;
