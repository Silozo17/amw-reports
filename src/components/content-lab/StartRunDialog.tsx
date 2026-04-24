import { Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  missingHints?: string[];
  starting: boolean;
  onConfirm: () => void;
}

/** Confirmation dialog used before spending a credit on a Content Lab run. */
const StartRunDialog = ({ open, onOpenChange, clientName, missingHints, starting, onConfirm }: Props) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Generate ideas for {clientName}?</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="space-y-2 text-sm">
            <p>
              This uses <strong>1 credit</strong> and takes about 3-6 minutes. We'll scrape your client's last
              30 days, find local competitors, pull viral worldwide content, then generate 30 ideas.
            </p>
            {missingHints && missingHints.length > 0 && (
              <div className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
                <p className="font-medium">For sharper results, consider adding:</p>
                <ul className="list-disc pl-4">
                  {missingHints.map((h) => <li key={h}>{h}</li>)}
                </ul>
              </div>
            )}
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={starting}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => { e.preventDefault(); onConfirm(); }}
          disabled={starting}
        >
          {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Start run
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default StartRunDialog;
