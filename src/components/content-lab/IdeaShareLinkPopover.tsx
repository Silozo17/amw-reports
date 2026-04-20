import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Send, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { toast } from 'sonner';

interface Props {
  ideaId: string;
  runId: string;
  trigger: React.ReactNode;
}

const IdeaShareLinkPopover = ({ ideaId, runId, trigger }: Props) => {
  const { orgId } = useOrg();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const buildLink = (slug: string) => `${window.location.origin}/share/content-lab/${slug}?idea=${ideaId}`;

  const loadOrCreate = async () => {
    if (!runId || !orgId) return;
    const { data: existing } = await supabase
      .from('content_lab_run_share_tokens')
      .select('slug')
      .eq('run_id', runId)
      .eq('is_active', true)
      .maybeSingle();
    if (existing?.slug) {
      setLink(buildLink(existing.slug));
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('content_lab_run_share_tokens')
        .insert({ run_id: runId, org_id: orgId })
        .select('slug')
        .single();
      if (error) throw error;
      setLink(buildLink(data.slug));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create share link');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !link) await loadOrCreate();
  };

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div>
          <p className="text-sm font-semibold">Share this idea</p>
          <p className="text-xs text-muted-foreground">Anyone with the link can view it.</p>
        </div>
        {creating ? (
          <p className="text-xs text-muted-foreground">Creating link…</p>
        ) : link ? (
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 rounded-md border border-input bg-muted px-2 py-1.5 text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button size="sm" variant="secondary" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={loadOrCreate} className="w-full">
            <Send className="mr-2 h-4 w-4" /> Create share link
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default IdeaShareLinkPopover;
