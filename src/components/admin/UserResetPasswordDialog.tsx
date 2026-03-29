import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, KeyRound, Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { UserRow } from '@/components/admin/UserEditDialog';

interface UserResetPasswordDialogProps {
  user: UserRow | null;
  onClose: () => void;
}

const UserResetPasswordDialog = ({ user, onClose }: UserResetPasswordDialogProps) => {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleClose = () => {
    setTempPassword(null);
    onClose();
  };

  const handleResetPassword = async (action: 'set_temp_password' | 'send_reset_email') => {
    if (!user) return;
    setIsResetting(true);
    setTempPassword(null);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { user_id: user.user_id, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (action === 'set_temp_password' && data?.temp_password) {
        setTempPassword(data.temp_password);
        toast.success('Temporary password set');
      } else {
        toast.success('Password reset link generated');
        handleClose();
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Reset password for {user?.full_name || user?.email}
          </DialogDescription>
        </DialogHeader>
        {tempPassword ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Temporary password has been set:</p>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="text-sm font-mono flex-1 break-all">{tempPassword}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword);
                  toast.success('Copied to clipboard');
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Share this securely with the user. They should change it on first login.</p>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <Button onClick={() => handleResetPassword('set_temp_password')} disabled={isResetting} className="w-full">
              {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Generate Temporary Password
            </Button>
            <Button variant="outline" onClick={() => handleResetPassword('send_reset_email')} disabled={isResetting} className="w-full">
              {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send Password Reset Link
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserResetPasswordDialog;
