import { useEffect, useState, KeyboardEvent } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  clientId: string;
  initial: string[];
}

/**
 * Tag editor for clients.services_offered. Sits inside ClientContentLabTab
 * because Content Lab uses this list to constrain ideation + viral search to
 * services the client actually offers.
 */
const ServicesOfferedEditor = ({ clientId, initial }: Props) => {
  const queryClient = useQueryClient();
  const [services, setServices] = useState<string[]>(initial ?? []);
  const [draft, setDraft] = useState('');

  useEffect(() => { setServices(initial ?? []); }, [initial, clientId]);

  const save = useMutation({
    mutationFn: async (next: string[]) => {
      const { error } = await supabase
        .from('clients')
        .update({ services_offered: next })
        .eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save services'),
  });

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (services.some((s) => s.toLowerCase() === v.toLowerCase())) {
      setDraft('');
      return;
    }
    const next = [...services, v];
    setServices(next);
    setDraft('');
    save.mutate(next);
  };

  const remove = (s: string) => {
    const next = services.filter((x) => x !== s);
    setServices(next);
    save.mutate(next);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
  };

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base">Services this client offers</h3>
        {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground">
        Used to keep ideas focused on what they actually sell. Leave empty to fall back to industry-wide ideas.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {services.length === 0 && <p className="text-xs italic text-muted-foreground">No services added yet.</p>}
        {services.map((s) => (
          <Badge key={s} variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs">
            {s}
            <button
              type="button"
              onClick={() => remove(s)}
              className="rounded-full p-0.5 hover:bg-background"
              aria-label={`Remove ${s}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder="e.g. social media management"
          className="flex-1"
        />
        <Button type="button" onClick={add} disabled={!draft.trim()} size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </Card>
  );
};

export default ServicesOfferedEditor;
