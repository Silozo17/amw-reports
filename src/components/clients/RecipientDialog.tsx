import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ClientRecipient } from '@/types/database';

interface RecipientDialogProps {
  clientId: string;
  recipients: ClientRecipient[];
  onUpdate: () => void;
}

const RecipientDialog = ({ clientId, recipients, onUpdate }: RecipientDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!name || !email) {
      toast.error('Name and email are required');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from('client_recipients').insert({
      client_id: clientId,
      name,
      email,
      is_primary: isPrimary,
    });

    if (error) {
      toast.error('Failed to add recipient');
    } else {
      toast.success('Recipient added');
      setName('');
      setEmail('');
      setIsPrimary(false);
      onUpdate();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('client_recipients').delete().eq('id', id);
    if (error) {
      toast.error('Failed to remove recipient');
    } else {
      toast.success('Recipient removed');
      onUpdate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Add Recipient</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Manage Recipients</DialogTitle>
        </DialogHeader>

        {recipients.length > 0 && (
          <div className="space-y-2 mb-4">
            {recipients.map(r => (
              <div key={r.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <div>
                  <p className="text-sm font-body font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.is_primary && (
                    <span className="text-xs text-primary font-medium">Primary</span>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Recipient name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Primary recipient</Label>
            <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
          </div>
          <Button onClick={handleAdd} disabled={isSubmitting} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            {isSubmitting ? 'Adding...' : 'Add Recipient'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecipientDialog;
