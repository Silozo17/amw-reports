import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
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

const ConnectionDialog = ({ clientId, connections, onUpdate }: ConnectionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<PlatformType | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out platforms that already have a connection
  const connectedPlatforms = new Set(connections.map(c => c.platform));
  const availablePlatforms = PLATFORMS.filter(p => !connectedPlatforms.has(p));

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
    try {
      const functionName = CONNECT_FUNCTION_MAP[conn.platform];
      if (!functionName) {
        toast.info(`OAuth for ${PLATFORM_LABELS[conn.platform]} is not yet available.`);
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
          <DialogTitle className="font-display">Add Connection</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as PlatformType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {availablePlatforms.map(p => (
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
