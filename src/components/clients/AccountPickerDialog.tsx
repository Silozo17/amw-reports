import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PlatformConnection, PlatformType } from '@/types/database';
import { PLATFORM_LABELS } from '@/types/database';

interface MetaPage {
  id: string;
  name: string;
  access_token?: string;
  instagram?: { id: string; username: string };
}

interface DiscoveredAccount {
  id: string;
  name: string;
}

interface AccountPickerDialogProps {
  connection: PlatformConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  clientId: string;
}

const AccountPickerDialog = ({ connection, open, onOpenChange, onComplete, clientId }: AccountPickerDialogProps) => {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const metadata = connection?.metadata as Record<string, unknown> | null;
  const platform = connection?.platform;

  // Reset selections when connection changes
  useEffect(() => {
    setSelectedAccountId('');
    setSelectedPages([]);
  }, [connection?.id]);

  if (!connection || !metadata) return null;

  const getAccountOptions = (): DiscoveredAccount[] => {
    switch (platform) {
      case 'google_ads':
        return (metadata.customers as DiscoveredAccount[]) || [];
      case 'meta_ads':
        return (metadata.ad_accounts as DiscoveredAccount[]) || [];
      case 'tiktok':
        return (metadata.advertisers as DiscoveredAccount[]) || [];
      case 'linkedin':
        return (metadata.ad_accounts as DiscoveredAccount[]) || [];
      default:
        return [];
    }
  };

  const getPages = (): MetaPage[] => {
    if (platform !== 'meta_ads') return [];
    return (metadata.pages as MetaPage[]) || [];
  };

  const getOrganizations = (): DiscoveredAccount[] => {
    if (platform !== 'linkedin') return [];
    return (metadata.organizations as DiscoveredAccount[]) || [];
  };

  const accounts = getAccountOptions();
  const pages = getPages();
  const organizations = getOrganizations();

  const togglePage = (pageId: string) => {
    setSelectedPages(prev =>
      prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId]
    );
  };

  const handleSave = async () => {
    if (!selectedAccountId && accounts.length > 0 && platform !== 'linkedin') {
      toast.error('Please select an account');
      return;
    }

    // For linkedin, either ad account or org is fine
    if (platform === 'linkedin' && !selectedAccountId && organizations.length === 0) {
      toast.error('Please select an account');
      return;
    }

    setIsSaving(true);

    try {
      const selectedAccount = accounts.find(a => a.id === selectedAccountId);

      // Update the main connection with the selected account
      const { error } = await supabase
        .from('platform_connections')
        .update({
          account_id: selectedAccountId || null,
          account_name: selectedAccount?.name || null,
        })
        .eq('id', connection.id);

      if (error) throw error;

      // For Meta: create facebook/instagram connections for selected pages
      if (platform === 'meta_ads' && selectedPages.length > 0) {
        // Fetch the full connection row (with access_token, token_expires_at) from DB
        const { data: fullConn } = await supabase
          .from('platform_connections')
          .select('access_token, token_expires_at')
          .eq('id', connection.id)
          .single();

        const connAccessToken = fullConn?.access_token;
        const connTokenExpires = fullConn?.token_expires_at;

        for (const pageId of selectedPages) {
          const page = pages.find(p => p.id === pageId);
          if (!page) continue;

          // Create Facebook Page connection
          await supabase.from('platform_connections').insert({
            client_id: clientId,
            platform: 'facebook' as PlatformType,
            is_connected: true,
            account_id: page.id,
            account_name: page.name,
            access_token: page.access_token || connAccessToken,
            token_expires_at: connTokenExpires,
            metadata: { page_id: page.id, page_name: page.name, source_connection_id: connection.id },
          });

          // Create Instagram connection if page has linked IG
          if (page.instagram) {
            const igName = page.instagram.username ? `@${page.instagram.username}` : `IG (${page.instagram.id})`;

            await supabase.from('platform_connections').insert({
              client_id: clientId,
              platform: 'instagram' as PlatformType,
              is_connected: true,
              account_id: page.instagram.id,
              account_name: igName,
              access_token: page.access_token || connAccessToken,
              token_expires_at: connTokenExpires,
              metadata: {
                ig_user_id: page.instagram.id,
                ig_username: page.instagram.username,
                page_id: page.id,
                source_connection_id: connection.id,
              },
            });
          }
        }
      }

      // For LinkedIn: save selected organization if any
      if (platform === 'linkedin' && selectedPages.length > 0) {
        const selectedOrg = organizations.find(o => selectedPages.includes(o.id));
        if (selectedOrg && !selectedAccountId) {
          await supabase
            .from('platform_connections')
            .update({
              account_id: selectedOrg.id,
              account_name: selectedOrg.name,
              metadata: { ...metadata, selected_organization: { id: selectedOrg.id, name: selectedOrg.name } } as unknown as Record<string, never>,
            })
            .eq('id', connection.id);
        } else if (selectedOrg) {
          await supabase
            .from('platform_connections')
            .update({
              metadata: { ...metadata, selected_organization: { id: selectedOrg.id, name: selectedOrg.name } } as unknown as Record<string, never>,
            })
            .eq('id', connection.id);
        }
      }

      toast.success('Account selection saved');
      onComplete();
      onOpenChange(false);
    } catch (e) {
      console.error('Save error:', e);
      toast.error('Failed to save selection');
    } finally {
      setIsSaving(false);
    }
  };

  const hasNoAssets = accounts.length === 0 && pages.length === 0 && organizations.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Select {PLATFORM_LABELS[platform!]} Account
          </DialogTitle>
        </DialogHeader>

        {hasNoAssets ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No accounts were discovered. Make sure you granted the correct permissions during authorization.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Ad Account / Customer selector */}
            {accounts.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {platform === 'google_ads' ? 'Customer Account' : 
                   platform === 'tiktok' ? 'Advertiser Account' : 'Ad Account'}
                </Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(acct => (
                      <SelectItem key={acct.id} value={acct.id}>
                        {acct.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Meta: Facebook Pages + Instagram */}
            {pages.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Facebook Pages & Instagram</Label>
                <p className="text-xs text-muted-foreground">
                  Select the page(s) for this client. Linked Instagram accounts will be added automatically.
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pages.map(page => (
                    <label
                      key={page.id}
                      className="flex items-start gap-3 p-2 rounded-md bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    >
                      <Checkbox
                        checked={selectedPages.includes(page.id)}
                        onCheckedChange={() => togglePage(page.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">📄 {page.name}</p>
                        {page.instagram && (
                          <p className="text-xs text-muted-foreground">
                            📸 @{page.instagram.username || page.instagram.id}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* LinkedIn: Organizations */}
            {organizations.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Company Pages</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {organizations.map(org => (
                    <label
                      key={org.id}
                      className="flex items-center gap-3 p-2 rounded-md bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    >
                      <Checkbox
                        checked={selectedPages.includes(org.id)}
                        onCheckedChange={() => togglePage(org.id)}
                      />
                      <p className="text-sm font-medium">🏢 {org.name}</p>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!hasNoAssets && (
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Selection
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AccountPickerDialog;
