import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Camera, Save, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import AvatarCropDialog from './AvatarCropDialog';

const AccountSection = () => {
  const { user, profile, refetchProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [email, setEmail] = useState(profile?.email ?? user?.email ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [position, setPosition] = useState(profile?.position ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [accountType, setAccountType] = useState((profile as any)?.account_type ?? 'business');

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Crop dialog state
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showCrop, setShowCrop] = useState(false);

  const initials = (fullName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check if image is square by loading it
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      if (img.width === img.height) {
        // Already square, upload directly
        uploadBlob(file);
      } else {
        // Show crop dialog
        setCropFile(file);
        setShowCrop(true);
      }
    };
    img.src = URL.createObjectURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const uploadBlob = async (blob: Blob) => {
    if (!user) return;
    setIsUploading(true);

    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const path = `avatars/${user.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('org-assets')
      .upload(path, blob, { upsert: true, contentType: blob.type });

    if (uploadError) {
      toast.error('Failed to upload avatar');
      setIsUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('org-assets').getPublicUrl(path);
    const url = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to save avatar');
    } else {
      setAvatarUrl(url);
      toast.success('Avatar updated');
      setShowCrop(false);
      refetchProfile();
    }
    setIsUploading(false);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        position: position.trim() || null,
      })
      .eq('user_id', user.id);

    if (profileError) {
      toast.error('Failed to update profile');
      setIsSaving(false);
      return;
    }

    if (email.trim() !== (user.email ?? '')) {
      const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
      if (emailError) {
        toast.error(`Failed to update email: ${emailError.message}`);
        setIsSaving(false);
        return;
      }
      toast.info('A confirmation email has been sent to your new address');
    }

    toast.success('Profile updated');
    refetchProfile();
    setIsSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(`Failed to change password: ${error.message}`);
    } else {
      toast.success('Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
    }
    setIsChangingPassword(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Your Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-primary/10 text-primary font-display text-lg">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Camera className="h-4 w-4 text-white" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
            </div>
            <div>
              <p className="text-sm font-medium">{fullName || 'Your Name'}</p>
              <p className="text-xs text-muted-foreground">Click the avatar to upload a new photo</p>
            </div>
          </div>

          {/* Profile Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 7..." />
            </div>
            <div className="space-y-2">
              <Label>Position / Title</Label>
              <Input value={position} onChange={e => setPosition(e.target.value)} placeholder="e.g. Account Manager" />
            </div>
          </div>

          <Button onClick={handleSaveProfile} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Profile
          </Button>

          <Separator />

          {/* Change Password */}
          <div className="space-y-4">
            <h3 className="text-sm font-display font-semibold">Change Password</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                />
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleChangePassword}
              disabled={isChangingPassword || !newPassword}
              className="gap-2"
            >
              {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      <AvatarCropDialog
        open={showCrop}
        onOpenChange={setShowCrop}
        imageFile={cropFile}
        onCropComplete={uploadBlob}
        isUploading={isUploading}
      />
    </>
  );
};

export default AccountSection;
