import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Share2, Copy, Trash2, Plus, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface ShareToken {
  id: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface CustomDomain {
  domain: string;
  verified_at: string | null;
  is_active: boolean;
}

interface SelectedPeriod {
  type: string;
  month: number;
  year: number;
  startDate?: Date;
  endDate?: Date;
}

interface ShareDialogProps {
  clientId: string;
  orgId: string;
  clientName: string;
  selectedPeriod?: SelectedPeriod | null;
}

const generateSlugToken = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${slug}-${suffix}`;
};

const ShareDialog = ({ clientId, orgId, clientName, selectedMonth, selectedYear }: ShareDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTokens = async () => {
    const { data } = await supabase
      .from('client_share_tokens')
      .select('id, token, is_active, expires_at, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    setTokens((data as ShareToken[]) ?? []);
  };

  const fetchCustomDomain = async () => {
    const { data } = await supabase
      .from('custom_domains')
      .select('domain, verified_at, is_active')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .limit(1)
      .single();
    if (data && (data as CustomDomain).verified_at) {
      setCustomDomain((data as CustomDomain).domain);
    }
  };

  useEffect(() => {
    if (open) {
      fetchTokens();
      fetchCustomDomain();
    }
  }, [open]);

  const createToken = async () => {
    setIsLoading(true);
    const token = generateSlugToken(clientName);
    const { error } = await supabase.from('client_share_tokens').insert({
      client_id: clientId,
      org_id: orgId,
      created_by: user?.id ?? null,
      token,
    });
    if (error) {
      toast.error('Failed to create share link');
    } else {
      toast.success('Share link created');
      fetchTokens();
    }
    setIsLoading(false);
  };

  const revokeToken = async (id: string) => {
    const { error } = await supabase
      .from('client_share_tokens')
      .update({ is_active: false })
      .eq('id', id);
    if (error) {
      toast.error('Failed to revoke link');
    } else {
      toast.success('Share link revoked');
      fetchTokens();
    }
  };

  const deleteToken = async (id: string) => {
    const { error } = await supabase
      .from('client_share_tokens')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Failed to delete link');
    } else {
      toast.success('Share link deleted');
      fetchTokens();
    }
  };

  const getShareUrl = (token: string) => {
    const base = customDomain ? `https://${customDomain}/portal/${token}` : `${window.location.origin}/portal/${token}`;
    if (selectedMonth && selectedYear) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const offset = (currentYear - selectedYear) * 12 + (currentMonth - selectedMonth);
      if (offset > 0) return `${base}?period=${offset}`;
    }
    return base;
  };

  const copyLink = async (token: ShareToken) => {
    await navigator.clipboard.writeText(getShareUrl(token.token));
    setCopiedId(token.id);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeTokens = tokens.filter(t => t.is_active);
  const inactiveTokens = tokens.filter(t => !t.is_active);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Share {clientName} Dashboard</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate a read-only link that lets clients view their dashboard without logging in.
          </p>

          <Button onClick={createToken} disabled={isLoading} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            {isLoading ? 'Creating...' : 'Create Share Link'}
          </Button>

          {activeTokens.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Active Links</Label>
              {activeTokens.map(token => (
                <div key={token.id} className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border">
                  <Input
                    readOnly
                    value={getShareUrl(token.token)}
                    className="text-xs font-mono flex-1 h-8"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyLink(token)}
                  >
                    {copiedId === token.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <a href={getShareUrl(token.token)} target="_blank" rel="noopener noreferrer">
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => revokeToken(token.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {inactiveTokens.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Revoked Links</Label>
              {inactiveTokens.map(token => (
                <div key={token.id} className="flex items-center gap-2 p-2 rounded-md opacity-50">
                  <Badge variant="secondary" className="text-xs">Revoked</Badge>
                  <span className="text-xs text-muted-foreground font-mono truncate flex-1">
                    ...{token.token.slice(-8)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => deleteToken(token.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {tokens.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No share links created yet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
