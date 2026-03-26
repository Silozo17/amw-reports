import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowUpRight } from 'lucide-react';

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'client' | 'connection';
  current: number;
  max: number;
}

const UpgradePrompt = ({ open, onOpenChange, type, current, max }: UpgradePromptProps) => {
  const isUnlimited = !isFinite(max);
  const price = type === 'client' ? '£9.99' : '£4.99';
  const noun = type === 'client' ? 'clients' : 'connections';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">{type === 'client' ? 'Client' : 'Connection'} limit reached</DialogTitle>
          <DialogDescription className="font-body">
            You're using {current}/{isUnlimited ? '∞' : max} {noun} on your current plan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            To add more {noun}, upgrade your plan or add individual {noun} at {price}/month each.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={() => {
              window.location.href = '/settings?tab=billing';
              onOpenChange(false);
            }}>
              <ArrowUpRight className="h-4 w-4" />
              View Plans
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePrompt;
