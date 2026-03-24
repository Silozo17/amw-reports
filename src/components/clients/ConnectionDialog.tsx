import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { PlatformConnection, PlatformType } from '@/types/database';
import { PLATFORM_LABELS } from '@/types/database';

interface ConnectionDialogProps {
  clientId: string;
  connections: PlatformConnection[];
  onUpdate: () => void;
}

const PLATFORMS: PlatformType[] = ['google_ads', 'meta_ads', 'facebook', 'instagram', 'tiktok', 'linkedin'];

const OAUTH_SUPPORTED: PlatformType[] = ['google_ads', 'meta_ads', 'tiktok', 'linkedin'];

// Facebook & Instagram connect through meta_ads OAuth — they don't have their own OAuth
const META_DEPENDENT: PlatformType[] = ['facebook', 'instagram'];

const CONNECT_FUNCTION_MAP: Record<string, string> = {
  google_ads: 'google-ads-connect',
  meta_ads: 'meta-ads-connect',
  tiktok: 'tiktok-ads-connect',
  linkedin: 'linkedin-connect',
};

const ConnectionDialog = ({ clientId, connections, onUpdate }: ConnectionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<PlatformType | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const handleAddAndConnect = async () => {
    if (!platform) {
      toast.error('Select a platform');
      return;
    }

    // For facebook/instagram, check if meta_ads is connected
    if (META_DEPENDENT.includes(platform)) {
      const metaConn = connections.find(c => c.platform === 'meta_ads' && c.is_connected);
      if (!metaConn) {
        toast.error(`Connect Meta Ads first — ${PLATFORM_LABELS[platform]} data comes through your Meta Business connection.`);
        return;
      }
    }

    setIsSubmitting(true);

    // Create the connection record
    const { data: newConn, error } = await supabase
      .from('platform_connections')
      .insert({
        client_id: clientId,
        platform: platform as PlatformType,
        is_connected: META_DEPENDENT.includes(platform), // Auto-connect if meta-dependent
      })
      .select('*')
      .single();

    if (error || !newConn) {
      toast.error('Failed to add connection');
      setIsSubmitting(false);
      return;
    }

    onUpdate();

    // If OAuth supported, immediately trigger OAuth
    if (OAUTH_SUPPORTED.includes(platform)) {
      await triggerOAuth(newConn as PlatformConnection);
    } else {
      toast.success(`${PLATFORM_LABELS[platform]} connection added. Data will sync via your Meta Ads connection.`);
    }

    setPlatform('');
    setIsSubmitting(false);
  };

  const triggerOAuth = async (conn: PlatformConnection) => {
    setConnectingId(conn.id);

    try {
      const functionName = CONNECT_FUNCTION_MAP[conn.platform];
      if (!functionName) {
        toast.info(`OAuth for ${PLATFORM_LABELS[conn.platform]} is not yet available.`);
        setConnectingId(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { connection_id: conn.id, redirect_url: window.location.origin },
      });

      if (error) throw error;

      if (data?.auth_url) {
        window.location.href = data.auth_url;
      } else {
        throw new Error('No auth URL returned');
      }
    } catch (e) {
      console.error('OAuth error:', e);
      toast.error('Failed to start OAuth flow');
      setConnectingId(null);
    }
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('platform_connections').delete().eq('id', id);
    if (error) {
      toast.error('Failed to remove connection');
    } else {
      toast.success('Connection removed');
      onUpdate();
    }
  };

  const handleOAuthConnect = async (conn: PlatformConnection) => {
    await triggerOAuth(conn);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Add Connection</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Platform Connections</DialogTitle>
        </DialogHeader>

        {connections.length > 0 && (
          <div className="space-y-2 mb-4">
            {connections.map(conn => {
              const meta = conn.metadata as { pages?: Array<{ id: string; name: string; instagram?: { id: string; username: string } }>; ad_accounts?: Array<{ id: string; name: string }>; advertisers?: Array<{ id: string; name: string }>; organizations?: Array<{ id: string; name: string }> } | null;
              const canOAuth = OAUTH_SUPPORTED.includes(conn.platform);
              return (
                <div key={conn.id} className="flex flex-col p-2 rounded-md bg-muted/50 gap-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-body font-medium">{PLATFORM_LABELS[conn.platform]}</p>
                      <p className="text-xs text-muted-foreground">{conn.account_name || conn.account_id || 'Not yet connected'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={conn.is_connected ? 'default' : 'destructive'} className="text-xs">
                        {conn.is_connected ? 'Connected' : 'Pending'}
                      </Badge>
                      {!conn.is_connected && canOAuth && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          disabled={connectingId === conn.id}
                          onClick={() => handleOAuthConnect(conn)}
                        >
                          {connectingId === conn.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ExternalLink className="h-3 w-3" />
                          )}
                          Connect
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRemove(conn.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {/* Meta pages & IG */}
                  {conn.is_connected && meta?.pages && meta.pages.length > 0 && (
                    <div className="pl-2 border-l-2 border-primary/20 space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground">Pages & Instagram:</p>
                      {meta.pages.map(page => (
                        <p key={page.id} className="text-xs text-muted-foreground">
                          📄 {page.name}{page.instagram ? ` · 📸 @${page.instagram.username}` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                  {/* Meta ad accounts */}
                  {conn.is_connected && meta?.ad_accounts && meta.ad_accounts.length > 0 && (
                    <div className="pl-2 border-l-2 border-primary/20 space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground">Ad Accounts:</p>
                      {meta.ad_accounts.map(acct => (
                        <p key={acct.id} className="text-xs text-muted-foreground">📊 {acct.name}</p>
                      ))}
                    </div>
                  )}
                  {/* TikTok advertisers */}
                  {conn.is_connected && meta?.advertisers && meta.advertisers.length > 0 && (
                    <div className="pl-2 border-l-2 border-primary/20 space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground">Advertiser Accounts:</p>
                      {meta.advertisers.map(adv => (
                        <p key={adv.id} className="text-xs text-muted-foreground">📊 {adv.name}</p>
                      ))}
                    </div>
                  )}
                  {/* LinkedIn organizations */}
                  {conn.is_connected && meta?.organizations && meta.organizations.length > 0 && (
                    <div className="pl-2 border-l-2 border-primary/20 space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground">Company Pages:</p>
                      {meta.organizations.map(org => (
                        <p key={org.id} className="text-xs text-muted-foreground">🏢 {org.name}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as PlatformType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map(p => (
                  <SelectItem key={p} value={p}>
                    {PLATFORM_LABELS[p]}
                    {OAUTH_SUPPORTED.includes(p) ? ' (OAuth)' : META_DEPENDENT.includes(p) ? ' (via Meta)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAddAndConnect} disabled={isSubmitting || !platform} className="w-full gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isSubmitting ? 'Connecting...' : OAUTH_SUPPORTED.includes(platform as PlatformType) ? 'Add & Connect' : 'Add Connection'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Select a platform and click to add. OAuth platforms will redirect you to sign in.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectionDialog;
