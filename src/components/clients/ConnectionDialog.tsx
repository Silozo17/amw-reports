import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Plug } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { PlatformConnection, PlatformType } from '@/types/database';
import { PLATFORM_LABELS } from '@/types/database';

interface ConnectionDialogProps {
  clientId: string;
  connections: PlatformConnection[];
  onUpdate: () => void;
}

const PLATFORMS: PlatformType[] = ['google_ads', 'meta_ads', 'facebook', 'instagram', 'tiktok', 'linkedin'];

const ConnectionDialog = ({ clientId, connections, onUpdate }: ConnectionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<PlatformType | ''>('');
  const [accountName, setAccountName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!platform) {
      toast.error('Select a platform');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from('platform_connections').insert({
      client_id: clientId,
      platform: platform as PlatformType,
      account_name: accountName || null,
      account_id: accountId || null,
      is_connected: false,
    });

    if (error) {
      toast.error('Failed to add connection');
    } else {
      toast.success('Connection added — ready for OAuth setup');
      setPlatform('');
      setAccountName('');
      setAccountId('');
      onUpdate();
    }
    setIsSubmitting(false);
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
            {connections.map(conn => (
              <div key={conn.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <div>
                  <p className="text-sm font-body font-medium">{PLATFORM_LABELS[conn.platform]}</p>
                  <p className="text-xs text-muted-foreground">{conn.account_name || conn.account_id || 'No account info'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={conn.is_connected ? 'default' : 'destructive'} className="text-xs">
                    {conn.is_connected ? 'Connected' : 'Pending'}
                  </Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRemove(conn.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
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
                  <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Account Name (optional)</Label>
            <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="e.g. Main Ad Account" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Account ID (optional)</Label>
            <Input value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="e.g. act_123456" />
          </div>
          <Button onClick={handleAdd} disabled={isSubmitting} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            {isSubmitting ? 'Adding...' : 'Add Connection'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            OAuth authentication will be configured when API credentials are set up.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectionDialog;
