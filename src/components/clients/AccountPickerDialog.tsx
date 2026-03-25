import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check, ChevronRight, ChevronLeft, Info, BarChart3, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PlatformConnection, PlatformType } from '@/types/database';
import { PLATFORM_LABELS, PLATFORM_LOGOS } from '@/types/database';
import { cn } from '@/lib/utils';

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

type MetaStep = 'ad_account' | 'pages' | 'confirm';

const AccountPickerDialog = ({ connection, open, onOpenChange, onComplete, clientId }: AccountPickerDialogProps) => {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [metaStep, setMetaStep] = useState<MetaStep>('ad_account');

  const metadata = connection?.metadata as Record<string, unknown> | null;
  const platform = connection?.platform;
  const isMeta = platform === 'meta_ads';

  useEffect(() => {
    setSelectedAccountId('');
    setSelectedPages([]);
    setMetaStep('ad_account');
  }, [connection?.id]);

  if (!connection || !metadata) return null;

  const getAccountOptions = (): DiscoveredAccount[] => {
    switch (platform) {
      case 'google_ads': return (metadata.customers as DiscoveredAccount[]) || [];
      case 'meta_ads': return (metadata.ad_accounts as DiscoveredAccount[]) || [];
      case 'tiktok': return (metadata.advertisers as DiscoveredAccount[]) || [];
      case 'linkedin': return (metadata.ad_accounts as DiscoveredAccount[]) || [];
      case 'google_search_console': return (metadata.sites as DiscoveredAccount[]) || [];
      case 'google_analytics': return (metadata.properties as DiscoveredAccount[]) || [];
      case 'google_business_profile': return (metadata.locations as DiscoveredAccount[]) || [];
      default: return [];
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

  const hasNoAssets = accounts.length === 0 && pages.length === 0 && organizations.length === 0;

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
    if (platform === 'linkedin' && !selectedAccountId && organizations.length === 0) {
      toast.error('Please select an account');
      return;
    }

    setIsSaving(true);
    try {
      const selectedAccount = accounts.find(a => a.id === selectedAccountId);

      const { error } = await supabase
        .from('platform_connections')
        .update({ account_id: selectedAccountId || null, account_name: selectedAccount?.name || null })
        .eq('id', connection.id);
      if (error) throw error;

      // Meta: create facebook/instagram connections for selected pages
      if (isMeta && selectedPages.length > 0) {
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

      // LinkedIn: save selected organization
      if (platform === 'linkedin' && selectedPages.length > 0) {
        const selectedOrg = organizations.find(o => selectedPages.includes(o.id));
        if (selectedOrg) {
          await supabase
            .from('platform_connections')
            .update({
              account_id: selectedAccountId || selectedOrg.id,
              account_name: selectedAccountId ? selectedAccount?.name : selectedOrg.name,
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

  // ─── META MULTI-STEP ───
  if (isMeta && !hasNoAssets) {
    const selectedAccount = accounts.find(a => a.id === selectedAccountId);
    const selectedPageObjects = pages.filter(p => selectedPages.includes(p.id));

    const stepNumber = metaStep === 'ad_account' ? 1 : metaStep === 'pages' ? 2 : 3;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              {PLATFORM_LOGOS.meta_ads && <img src={PLATFORM_LOGOS.meta_ads} alt="" className="h-6 w-6 object-contain" />}
              Connect Meta Ads
            </DialogTitle>
            {/* Step indicator */}
            <div className="flex items-center gap-2 pt-3">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                    s < stepNumber ? 'bg-primary text-primary-foreground' :
                    s === stepNumber ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {s < stepNumber ? <Check className="h-4 w-4" /> : s}
                  </div>
                  <span className={cn(
                    'text-xs font-medium hidden sm:inline',
                    s === stepNumber ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {s === 1 ? 'Ad Account' : s === 2 ? 'Facebook Page' : 'Confirm'}
                  </span>
                  {s < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </DialogHeader>

          {/* Step 1: Ad Account */}
          {metaStep === 'ad_account' && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Select the Meta Ads account for this client:</p>
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No ad accounts discovered. You can skip this step.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {accounts.map(acct => (
                    <button
                      key={acct.id}
                      onClick={() => setSelectedAccountId(acct.id)}
                      className={cn(
                        'flex w-full items-center gap-4 rounded-lg border-2 p-4 text-left transition-all hover:border-primary/50',
                        selectedAccountId === acct.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card'
                      )}
                    >
                      <div className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                        selectedAccountId === acct.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {selectedAccountId === acct.id ? <Check className="h-5 w-5" /> : acct.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{acct.name}</p>
                        <p className="text-xs text-muted-foreground">ID: {acct.id}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Facebook Pages */}
          {metaStep === 'pages' && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Select the Facebook Page(s) for this client:</p>
              <div className="flex items-start gap-2 rounded-md bg-secondary/10 border border-secondary/20 p-3">
                <Info className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                <p className="text-xs text-secondary">
                  If an Instagram Business account is linked to this page, it will be connected automatically.
                </p>
              </div>
              {pages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No Facebook Pages discovered.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {pages.map(page => (
                    <button
                      key={page.id}
                      onClick={() => togglePage(page.id)}
                      className={cn(
                        'flex w-full items-center gap-4 rounded-lg border-2 p-4 text-left transition-all hover:border-primary/50',
                        selectedPages.includes(page.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card'
                      )}
                    >
                      <div className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                        selectedPages.includes(page.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {selectedPages.includes(page.id) ? <Check className="h-5 w-5" /> : '📄'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{page.name}</p>
                        {page.instagram && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            📸 Instagram: @{page.instagram.username || page.instagram.id}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirmation */}
          {metaStep === 'confirm' && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Review your selections before saving:</p>
              <div className="space-y-3">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Ad Account</p>
                  <p className="font-medium text-sm">{selectedAccount?.name || 'None selected'}</p>
                </div>

                {selectedPageObjects.length > 0 && (
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Facebook Pages & Instagram</p>
                    <div className="space-y-2">
                      {selectedPageObjects.map(page => (
                        <div key={page.id} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0" />
                          <span>{page.name}</span>
                          {page.instagram && (
                            <span className="text-xs text-muted-foreground ml-1">
                              + @{page.instagram.username || page.instagram.id}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-row gap-2">
            {metaStep !== 'ad_account' && (
              <Button variant="outline" onClick={() => setMetaStep(metaStep === 'confirm' ? 'pages' : 'ad_account')}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            {metaStep !== 'confirm' ? (
              <Button onClick={() => setMetaStep(metaStep === 'ad_account' ? 'pages' : 'confirm')}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Selection
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── NON-META / SINGLE STEP ───
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            {platform && PLATFORM_LOGOS[platform] && <img src={PLATFORM_LOGOS[platform]} alt="" className="h-6 w-6 object-contain" />}
            Select {PLATFORM_LABELS[platform!]} Account
          </DialogTitle>
        </DialogHeader>

        {hasNoAssets ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No accounts were discovered. Make sure you granted the correct permissions during authorization.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            {/* Ad Account / Customer selector */}
            {accounts.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {platform === 'google_ads' ? 'Select a Google Ads Account:' :
                   platform === 'tiktok' ? 'Select an Advertiser Account:' :
                   platform === 'google_search_console' ? 'Select a verified site:' :
                   platform === 'google_analytics' ? 'Select a GA4 property:' :
                   platform === 'google_business_profile' ? 'Select a business location:' :
                   'Select an Ad Account:'}
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {accounts.map(acct => {
                    const isGenericName = acct.name.startsWith('Google Ads (');
                    return (
                      <button
                        key={acct.id}
                        onClick={() => setSelectedAccountId(acct.id)}
                        className={cn(
                          'flex w-full items-center gap-4 rounded-lg border-2 p-4 text-left transition-all hover:border-primary/50',
                          selectedAccountId === acct.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-card'
                        )}
                      >
                        <div className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                          selectedAccountId === acct.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {selectedAccountId === acct.id ? <Check className="h-5 w-5" /> : platform === 'google_ads' ? <BarChart3 className="h-5 w-5" /> : acct.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{acct.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {platform === 'google_ads' ? `Account ID: ${acct.id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}` : `ID: ${acct.id}`}
                          </p>
                          {platform === 'google_ads' && isGenericName && (
                            <p className="text-[10px] text-warning mt-0.5">Name will update after reconnecting</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* LinkedIn: Organizations */}
            {organizations.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Select a Company Page:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {organizations.map(org => (
                    <button
                      key={org.id}
                      onClick={() => togglePage(org.id)}
                      className={cn(
                        'flex w-full items-center gap-4 rounded-lg border-2 p-4 text-left transition-all hover:border-primary/50',
                        selectedPages.includes(org.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card'
                      )}
                    >
                      <div className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                        selectedPages.includes(org.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {selectedPages.includes(org.id) ? <Check className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{org.name}</p>
                      </div>
                    </button>
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
