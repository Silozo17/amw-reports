import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';

interface DeleteClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  onConfirm: () => void;
  isLoading: boolean;
}

const DeleteClientDialog = ({
  open,
  onOpenChange,
  clientName,
  onConfirm,
  isLoading,
}: DeleteClientDialogProps) => {
  const [typed, setTyped] = useState('');

  const matches = typed.trim().toLowerCase() === clientName.trim().toLowerCase();

  const handleOpenChange = (next: boolean) => {
    if (!next) setTyped('');
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Delete {clientName}?
          </DialogTitle>
          <DialogDescription>
            This will schedule this client for permanent deletion in 24 hours.
            All associated data (connections, snapshots, reports, sync logs) will
            be removed. You can cancel at any point before the timer expires.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <p className="text-sm font-medium">
            Type <span className="font-bold text-foreground">{clientName}</span>{' '}
            to confirm
          </p>
          <Input
            placeholder={clientName}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!matches || isLoading}
            onClick={onConfirm}
          >
            {isLoading ? 'Scheduling…' : 'Confirm Deletion'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteClientDialog;
