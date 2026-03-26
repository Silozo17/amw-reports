import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Upload, X, Search, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { formatPhone } from '@/lib/utils';
import { CURRENCY_OPTIONS } from '@/types/database';
import { TIMEZONE_OPTIONS } from '@/types/metrics';
import { useOrg } from '@/hooks/useOrg';
import { useEntitlements } from '@/hooks/useEntitlements';
import UpgradePrompt from '@/components/entitlements/UpgradePrompt';

const ClientForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgId, isLoading: isOrgLoading } = useOrg();
  const { canAddClient, currentClients, maxClients } = useEntitlements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ name: string; address: string; phone: string; website: string }>>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    position: '',
    phone: '',
    email: '',
    business_address: '',
    website: '',
    notes: '',
    is_active: true,
    preferred_currency: 'GBP',
    preferred_timezone: 'Europe/London',
    account_manager: '',
    enable_upsell: false,
    enable_mom_comparison: true,
    enable_yoy_comparison: true,
    enable_explanations: true,
    report_detail_level: 'standard',
  });

  const handleChange = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleGoogleSearch = async () => {
    if (!form.company_name.trim()) {
      toast.error('Enter a company name first');
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places-lookup', {
        body: { query: form.company_name },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setSearchResults(data.results || []);
      setSearchOpen(true);
      if ((data.results || []).length === 0) toast.info('No results found');
    } catch (e) {
      console.error('Google search error:', e);
      toast.error('Failed to search Google');
    } finally {
      setIsSearching(false);
    }
  };

  const applySearchResult = (result: { name: string; address: string; phone: string; website: string }) => {
    setForm(prev => ({
      ...prev,
      company_name: result.name || prev.company_name,
      business_address: result.address || prev.business_address,
      phone: formatPhone(result.phone) || prev.phone,
      website: result.website || prev.website,
    }));
    setSearchOpen(false);
    toast.success('Details filled from Google');
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be under 5MB');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddClient) {
      setShowUpgrade(true);
      return;
    }
    if (!form.full_name || !form.company_name) {
      toast.error('Name and company are required');
      return;
    }

    setIsSubmitting(true);

    let logoUrl: string | null = null;

    if (logoFile) {
      const ext = logoFile.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('client-logos').upload(path, logoFile);
      if (uploadErr) {
        toast.error('Failed to upload logo');
        setIsSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('client-logos').getPublicUrl(path);
      logoUrl = urlData.publicUrl;
    }

    if (isOrgLoading) {
      toast.error('Still loading organisation — please try again');
      setIsSubmitting(false);
      return;
    }

    if (!orgId) {
      toast.error('Organisation not found — please reload the page');
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from('clients').insert({
      ...form,
      phone: formatPhone(form.phone),
      logo_url: logoUrl,
      created_by: user?.id,
      org_id: orgId,
    });

    if (error) {
      console.error('Client creation error:', error);
      toast.error(error.message || 'Failed to create client');
    } else {
      toast.success('Client created');
      navigate('/clients');
    }
    setIsSubmitting(false);
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-display">New Client</h1>
            <p className="text-muted-foreground font-body mt-1">Add a new client to the platform</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Logo Upload */}
          <Card>
            <CardHeader><CardTitle className="font-display text-lg">Client Logo</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative h-20 w-20 rounded-lg border overflow-hidden bg-muted">
                    <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                      className="absolute top-0.5 right-0.5 rounded-full bg-destructive p-0.5"
                    >
                      <X className="h-3 w-3 text-destructive-foreground" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </button>
                )}
                <div>
                  <p className="text-sm font-medium">Upload a logo</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG or WEBP, max 5MB. Displayed on reports.</p>
                  {!logoPreview && (
                    <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()}>
                      Choose File
                    </Button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-display text-lg">Contact Details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={e => handleChange('full_name', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <div className="flex gap-2">
                  <Input value={form.company_name} onChange={e => handleChange('company_name', e.target.value)} required className="flex-1" />
                  <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="icon" onClick={handleGoogleSearch} disabled={isSearching} title="Search Google for business details">
                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      {searchResults.length > 0 ? (
                        <div className="max-h-64 overflow-y-auto">
                          {searchResults.map((r, i) => (
                            <button
                              key={i}
                              type="button"
                              className="w-full text-left p-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                              onClick={() => applySearchResult(r)}
                            >
                              <p className="text-sm font-medium">{r.name}</p>
                              {r.address && <p className="text-xs text-muted-foreground mt-0.5">{r.address}</p>}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="p-3 text-sm text-muted-foreground">No results</p>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Position</Label>
                <Input value={form.position} onChange={e => handleChange('position', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone (local format, no country code)</Label>
                <Input value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="e.g. 7911 123456" />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input value={form.website} onChange={e => handleChange('website', e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Business Address</Label>
                <Input value={form.business_address} onChange={e => handleChange('business_address', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Account Manager</Label>
                <Input value={form.account_manager} onChange={e => handleChange('account_manager', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={form.preferred_currency} onValueChange={v => handleChange('preferred_currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={form.preferred_timezone} onValueChange={v => handleChange('preferred_timezone', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-display text-lg">Report Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-body font-medium">Month-over-Month Comparison</p>
                  <p className="text-xs text-muted-foreground">Compare with previous month</p>
                </div>
                <Switch checked={form.enable_mom_comparison} onCheckedChange={v => handleChange('enable_mom_comparison', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-body font-medium">Year-over-Year Comparison</p>
                  <p className="text-xs text-muted-foreground">Compare with same month last year</p>
                </div>
                <Switch checked={form.enable_yoy_comparison} onCheckedChange={v => handleChange('enable_yoy_comparison', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-body font-medium">Plain-English Explanations</p>
                  <p className="text-xs text-muted-foreground">AI-generated insights in simple language</p>
                </div>
                <Switch checked={form.enable_explanations} onCheckedChange={v => handleChange('enable_explanations', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-body font-medium">Upsell Recommendations</p>
                  <p className="text-xs text-muted-foreground">Suggest relevant AMW services</p>
                </div>
                <Switch checked={form.enable_upsell} onCheckedChange={v => handleChange('enable_upsell', v)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-display text-lg">Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={form.notes}
                onChange={e => handleChange('notes', e.target.value)}
                placeholder="Internal notes about this client..."
                rows={4}
              />
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting || isOrgLoading}>
              {isOrgLoading ? 'Loading...' : isSubmitting ? 'Creating...' : 'Create Client'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/clients')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
      <UpgradePrompt open={showUpgrade} onOpenChange={setShowUpgrade} type="client" current={currentClients} max={maxClients} />
    </AppLayout>
  );
};

export default ClientForm;
