import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { getCurrencySymbol } from '@/types/database';
import ClientDashboard from '@/components/clients/ClientDashboard';

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
}

const hexToHsl = (hex: string): string | null => {
  try {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let hue = 0, sat = 0;
    const light = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      sat = light > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) hue = ((b - r) / d + 2) / 6;
      else hue = ((r - g) / d + 4) / 6;
    }
    return `${Math.round(hue * 360)} ${Math.round(sat * 100)}% ${Math.round(light * 100)}%`;
  } catch { return null; }
};

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

const ClientPortal = () => {
  const { token } = useParams<{ token: string }>();
  const [client, setClient] = useState<PortalClient | null>(null);
  const [org, setOrg] = useState<PortalOrg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!token) { setError('Invalid link'); setIsLoading(false); return; }

      // Initial call just to validate token and get client/org info
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
      {/* Portal header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {org.logo_url && (
              <img src={org.logo_url} alt={org.name} className="h-8 w-auto object-contain" />
            )}
            <span className="font-display text-lg text-foreground">{org.name}</span>
          </div>
          <div className="flex items-center gap-3">
            {client.logo_url && (
              <img src={client.logo_url} alt={client.company_name} className="h-8 w-8 rounded-lg object-contain border bg-muted" />
            )}
            <span className="text-sm text-muted-foreground font-body">{client.company_name}</span>
          </div>
        </div>
      </header>

      {/* Dashboard content — reusing the real ClientDashboard */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <ClientDashboard
          clientId={client.id}
          clientName={client.company_name}
          currencyCode={client.preferred_currency}
          portalToken={token}
        />
      </main>

      {/* Footer */}
      <footer className="border-t bg-card px-6 py-4 mt-8">
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
