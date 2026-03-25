import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ExternalLink, Loader2, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { PlatformConnection, PlatformType } from '@/types/database';
import { PLATFORM_LABELS, PLATFORM_LOGOS } from '@/types/database';
import { removeConnectionAndData } from '@/lib/connectionHelpers';
import ConnectionDisclaimer from './ConnectionDisclaimer';

interface ConnectionDialogProps {
  clientId: string;
  connections: PlatformConnection[];
  onUpdate: () => void;
  onOpenPicker: (conn: PlatformConnection) => void;
}

const PLATFORMS: PlatformType[] = ['google_ads', 'meta_ads', 'facebook', 'instagram', 'tiktok', 'linkedin', 'google_search_console', 'google_analytics', 'google_business_profile', 'youtube'];

const OAUTH_SUPPORTED: PlatformType[] = ['google_ads', 'meta_ads', 'facebook', 'instagram', 'tiktok', 'linkedin', 'google_search_console', 'google_analytics', 'google_business_profile', 'youtube'];

const CONNECT_FUNCTION_MAP: Record<string, string> = {
  google_ads: 'google-ads-connect',
  meta_ads: 'meta-ads-connect',
  facebook: 'facebook-connect',
  instagram: 'instagram-connect',
  tiktok: 'tiktok-ads-connect',
  linkedin: 'linkedin-connect',
  google_search_console: 'google-search-console-connect',
  google_analytics: 'google-analytics-connect',
  google_business_profile: 'google-business-connect',
  youtube: 'youtube-connect',
};

const ConnectionDialog = ({ clientId, connections, onUpdate, onOpenPicker }: ConnectionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<PlatformType | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const handleAddAndConnect = async () => {
    if (!platform) {
      toast.error('Select a platform');
      return;
    }

    setIsSubmitting(true);

    const { data: newConn, error } = await supabase
      .from('platform_connections')
      .insert({
        client_id: clientId,
        platform: platform as PlatformType,
        is_connected: false,
      })
      .select('*')
      .single();

    if (error || !newConn) {
      toast.error('Failed to add connection');
      setIsSubmitting(false);
      return;
    }

    onUpdate();

    if (OAUTH_SUPPORTED.includes(platform)) {
      await triggerOAuth(newConn as PlatformConnection);
    } else {
      toast.success(`${PLATFORM_LABELS[platform]} connection added.`);
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

  const handleRemove = async (conn: PlatformConnection) => {
    const { error } = await removeConnectionAndData(conn.id, clientId, conn.platform);
    if (error) {
      toast.error('Failed to remove connection');
    } else {
      toast.success('Connection and associated data removed');
      onUpdate();
    }
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
              const canOAuth = OAUTH_SUPPORTED.includes(conn.platform);
              const needsSelection = conn.is_connected && !conn.account_id;
              return (
                <div key={conn.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {PLATFORM_LOGOS[conn.platform] && <img src={PLATFORM_LOGOS[conn.platform]} alt="" className="h-4 w-4 object-contain" />}
                        <p className="text-sm font-body font-medium">{PLATFORM_LABELS[conn.platform]}</p>
                      </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {conn.account_name || conn.account_id || (needsSelection ? 'Account not selected' : 'Not connected')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {needsSelection && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => { setOpen(false); onOpenPicker(conn); }}
                      >
                        <Settings2 className="h-3 w-3" />
                        Select
                      </Button>
                    )}
                    {conn.is_connected && conn.account_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => { setOpen(false); onOpenPicker(conn); }}
                      >
                        <Settings2 className="h-3 w-3" />
                        Change
                      </Button>
                    )}
                    {!conn.is_connected && canOAuth && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        disabled={connectingId === conn.id}
                        onClick={() => triggerOAuth(conn)}
                      >
                        {connectingId === conn.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ExternalLink className="h-3 w-3" />
                        )}
                        Connect
                      </Button>
                    )}
                    <Badge variant={conn.is_connected && conn.account_id ? 'default' : needsSelection ? 'secondary' : 'destructive'} className="text-xs">
                      {conn.is_connected && conn.account_id ? 'Ready' : needsSelection ? 'Pending' : 'Disconnected'}
                    </Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRemove(conn)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
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
                    <span className="flex items-center gap-2">
                      {PLATFORM_LOGOS[p] && <img src={PLATFORM_LOGOS[p]} alt="" className="h-4 w-4 object-contain" />}
                      {PLATFORM_LABELS[p]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAddAndConnect} disabled={isSubmitting || !platform} className="w-full gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isSubmitting ? 'Connecting...' : 'Add & Connect'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Select a platform and click to add. You'll be redirected to sign in via OAuth.
          </p>
        </div>

        <ConnectionDisclaimer />
      </DialogContent>
    </Dialog>
  );
};

export default ConnectionDialog;
