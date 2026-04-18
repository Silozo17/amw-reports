import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Globe, Copy, Check, RefreshCw, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface CustomDomain {
  id: string;
  domain: string;
  verification_token: string;
  verified_at: string | null;
  is_active: boolean;
  created_at: string;
}

const CustomDomainSection = () => {
  const { orgId } = useOrg();
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchDomains = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('custom_domains')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    setDomains((data as CustomDomain[]) ?? []);
  };

  useEffect(() => {
    if (orgId) fetchDomains();
  }, [orgId]);

  const addDomain = async () => {
    if (!orgId || !newDomain.trim()) return;

    const cleaned = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (!cleaned.includes('.')) {
      toast.error('Please enter a valid domain (e.g. reports.youragency.com)');
      return;
    }

    setIsAdding(true);
    const { error } = await supabase.from('custom_domains').insert({
      org_id: orgId,
      domain: cleaned,
    });

    if (error) {
      toast.error(error.message.includes('unique') ? 'This domain is already registered' : 'Failed to add domain');
    } else {
      toast.success('Domain added — follow the DNS instructions below');
      setNewDomain('');
      fetchDomains();
    }
    setIsAdding(false);
  };

  const verifyDomain = async (domainId: string) => {
    setVerifyingId(domainId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('verify-domain', {
        body: { domain_id: domainId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.error) {
        toast.error('Verification failed — check DNS records');
      } else if (res.data?.success) {
        toast.success('Domain verified and activated!');
        fetchDomains();
      } else {
        toast.error(res.data?.message || 'TXT record not found yet');
      }
    } catch {
      toast.error('Verification request failed');
    }
    setVerifyingId(null);
  };

  const removeDomain = async (id: string) => {
    const { error } = await supabase.from('custom_domains').delete().eq('id', id);
    if (error) toast.error('Failed to remove domain');
    else {
      toast.success('Domain removed');
      fetchDomains();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Custom Domain
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Use your own domain for client portal links (e.g. reports.youragency.com)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add domain */}
        <div className="flex gap-2">
          <Input
            placeholder="reports.youragency.com"
            value={newDomain}
            onChange={e => setNewDomain(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addDomain()}
          />
          <Button onClick={addDomain} disabled={isAdding || !newDomain.trim()} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        {/* Domain list */}
        {domains.map(domain => (
          <div key={domain.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{domain.domain}</span>
                {domain.verified_at ? (
                  <Badge variant="default" className="text-xs">Verified</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Pending</Badge>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => removeDomain(domain.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {!domain.verified_at && (
              <div className="space-y-2 bg-muted/50 rounded-md p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">DNS Setup Instructions</p>
                <p className="text-sm">Add this TXT record to your DNS provider:</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-12 shrink-0">Name:</Label>
                    <code className="text-xs bg-background px-2 py-1 rounded border">_amw-verify</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-12 shrink-0">Value:</Label>
                    <code className="text-xs bg-background px-2 py-1 rounded border flex-1 truncate">
                      amw-verify={domain.verification_token}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => copyToken(domain)}
                    >
                      {copiedId === domain.id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 mt-2"
                  onClick={() => verifyDomain(domain.id)}
                  disabled={verifyingId === domain.id}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${verifyingId === domain.id ? 'animate-spin' : ''}`} />
                  {verifyingId === domain.id ? 'Checking...' : 'Verify DNS'}
                </Button>
                <p className="text-xs text-muted-foreground">DNS changes can take up to 48 hours to propagate.</p>
              </div>
            )}
          </div>
        ))}

        {domains.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No custom domains configured. Add one above to white-label your portal links.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default CustomDomainSection;
