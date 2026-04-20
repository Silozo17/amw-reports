import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { useIdeaComments, usePostIdeaComment } from '@/hooks/useIdeaComments';

interface Props {
  ideaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatTime = (iso: string) => {
  const date = new Date(iso);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
};

const IdeaCommentsDrawer = ({ ideaId, open, onOpenChange }: Props) => {
  const [body, setBody] = useState('');
  const { data: comments = [], isLoading } = useIdeaComments(ideaId);
  const postMutation = usePostIdeaComment();

  const handleSend = async () => {
    if (!ideaId || !body.trim()) return;
    await postMutation.mutateAsync({ ideaId, body });
    setBody('');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Comments</SheetTitle>
        </SheetHeader>

        <div className="-mx-6 flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet — start the conversation.</p>
          ) : (
            <ul className="space-y-4">
              {comments.map((c) => (
                <li key={c.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">{c.author_label}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {formatTime(c.created_at)}
                    </p>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Leave a comment…"
            rows={3}
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={!body.trim() || postMutation.isPending}
            className="w-full"
          >
            <Send className="mr-2 h-4 w-4" />
            {postMutation.isPending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default IdeaCommentsDrawer;
