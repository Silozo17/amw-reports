import { Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { UserRow } from '@/components/admin/UserEditDialog';

interface UserDeactivateDialogProps {
  user: UserRow | null;
  isActioning: boolean;
  onConfirm: (user: UserRow) => void;
  onClose: () => void;
}

export const UserDeactivateDialog = ({ user, isActioning, onConfirm, onClose }: UserDeactivateDialogProps) => (
  <AlertDialog open={!!user} onOpenChange={() => onClose()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Deactivate User</AlertDialogTitle>
        <AlertDialogDescription>
          This will remove <strong>{user?.full_name || user?.email}</strong> from
          their organisation. They will lose access but can be re-invited later.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isActioning}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => user && onConfirm(user)}
          disabled={isActioning}
          className="bg-amber-500 hover:bg-amber-600"
        >
          {isActioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Deactivate
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

interface UserDeleteDialogProps {
  user: UserRow | null;
  isActioning: boolean;
  onConfirm: (user: UserRow) => void;
  onClose: () => void;
}

export const UserDeleteDialog = ({ user, isActioning, onConfirm, onClose }: UserDeleteDialogProps) => (
  <AlertDialog open={!!user} onOpenChange={() => onClose()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete User</AlertDialogTitle>
        <AlertDialogDescription>
          This will permanently remove <strong>{user?.full_name || user?.email}</strong>'s
          profile and organisation membership. This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isActioning}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => user && onConfirm(user)}
          disabled={isActioning}
          className="bg-destructive hover:bg-destructive/90"
        >
          {isActioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Delete Permanently
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
