import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Check, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ShareWithClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
}

interface ShareToken {
  id: string;
  slug: string;
  view_count: number;
  last_viewed_at: string | null;
  is_active: boolean;
}

const ShareWithClientDialog = ({ open, onOpenChange, runId }: ShareWithClientDialogProps) => {
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: token, isLoading } = useQuery({
    queryKey: ['share-token', runId],
    enabled: open && !!runId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_run_share_tokens')
        .select('id, slug, view_count, last_viewed_at, is_active')
        .eq('run_id', runId)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data as ShareToken | null;
    },
  });

  const createToken = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('No org');
      const { data, error } = await supabase
        .from('content_lab_run_share_tokens')
        .insert({ run_id: runId, org_id: orgId })
        .select('id, slug, view_count, last_viewed_at, is_active')
        .single();
      if (error) throw error;
      return data as ShareToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-token', runId] });
      toast.success('Share link created');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create link'),
  });

  const revokeToken = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('content_lab_run_share_tokens')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-token', runId] });
      toast.success('Share link revoked');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to revoke'),
  });

  const shareUrl = token ? `${window.location.origin}/share/content-lab/${token.slug}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share with client</DialogTitle>
          <DialogDescription>
            Create a read-only public link. The client can view ideas and benchmarks but cannot edit.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : token ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Public link</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={handleCopy} aria-label="Copy link">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Eye className="h-4 w-4" />
                {token.view_count === 0
                  ? 'Not viewed yet'
                  : `Viewed ${token.view_count} time${token.view_count === 1 ? '' : 's'}`}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => revokeToken.mutate(token.id)}
                disabled={revokeToken.isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Revoke
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No active link yet. Create one to share this brief with your client.
            </p>
            <Button onClick={() => createToken.mutate()} disabled={createToken.isPending} className="w-full">
              {createToken.isPending ? 'Creating…' : 'Create share link'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShareWithClientDialog;
