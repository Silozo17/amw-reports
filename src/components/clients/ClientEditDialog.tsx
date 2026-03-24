import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatPhone } from '@/lib/utils';
import type { Client } from '@/types/database';
import { CURRENCY_OPTIONS } from '@/types/database';

interface ClientEditDialogProps {
  client: Client;
  onUpdate: () => void;
}

const ClientEditDialog = ({ client, onUpdate }: ClientEditDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: client.full_name,
    company_name: client.company_name,
    position: client.position ?? '',
    phone: client.phone ?? '',
    email: client.email ?? '',
    business_address: client.business_address ?? '',
    website: client.website ?? '',
    notes: client.notes ?? '',
    is_active: client.is_active,
    preferred_currency: client.preferred_currency,
    preferred_timezone: client.preferred_timezone,
    account_manager: client.account_manager ?? '',
    enable_upsell: client.enable_upsell,
    enable_mom_comparison: client.enable_mom_comparison,
    enable_yoy_comparison: client.enable_yoy_comparison,
    enable_explanations: client.enable_explanations,
    report_detail_level: client.report_detail_level,
  });

  useEffect(() => {
    if (open) {
      setForm({
        full_name: client.full_name,
        company_name: client.company_name,
        position: client.position ?? '',
        phone: client.phone ?? '',
        email: client.email ?? '',
        business_address: client.business_address ?? '',
        website: client.website ?? '',
        notes: client.notes ?? '',
        is_active: client.is_active,
        preferred_currency: client.preferred_currency,
        preferred_timezone: client.preferred_timezone,
        account_manager: client.account_manager ?? '',
        enable_upsell: client.enable_upsell,
        enable_mom_comparison: client.enable_mom_comparison,
        enable_yoy_comparison: client.enable_yoy_comparison,
        enable_explanations: client.enable_explanations,
        report_detail_level: client.report_detail_level,
      });
      setLogoFile(null);
      setLogoPreview(client.logo_url ?? null);
    }
  }, [open, client]);

  const handleChange = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
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

  const handleSave = async () => {
    if (!form.full_name || !form.company_name) {
      toast.error('Name and company are required');
      return;
    }

    setIsSubmitting(true);

    let logoUrl = client.logo_url;

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
    } else if (!logoPreview) {
      logoUrl = null;
    }

    const { error } = await supabase.from('clients').update({
      ...form,
      phone: formatPhone(form.phone),
      logo_url: logoUrl,
    }).eq('id', client.id);

    if (error) {
      toast.error('Failed to update client');
    } else {
      toast.success('Client updated');
      setOpen(false);
      onUpdate();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Edit Client</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {logoPreview ? (
              <div className="relative h-14 w-14 rounded-lg border overflow-hidden bg-muted shrink-0">
                <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                <button
                  type="button"
                  onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                  className="absolute top-0 right-0 rounded-full bg-destructive p-0.5"
                >
                  <X className="h-2.5 w-2.5 text-destructive-foreground" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
              </button>
            )}
            <div>
              <p className="text-xs font-medium">Client Logo</p>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => fileInputRef.current?.click()}>
                {logoPreview ? 'Change' : 'Upload'}
              </Button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
          </div>

          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Full Name *</Label>
              <Input value={form.full_name} onChange={e => handleChange('full_name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Company *</Label>
              <Input value={form.company_name} onChange={e => handleChange('company_name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Position</Label>
              <Input value={form.position} onChange={e => handleChange('position', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Email</Label>
              <Input type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Phone (no country code)</Label>
              <Input value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="e.g. 7911 123456" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Website</Label>
              <Input value={form.website} onChange={e => handleChange('website', e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm">Business Address</Label>
              <Input value={form.business_address} onChange={e => handleChange('business_address', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Account Manager</Label>
              <Input value={form.account_manager} onChange={e => handleChange('account_manager', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Currency</Label>
              <Select value={form.preferred_currency} onValueChange={v => handleChange('preferred_currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Notes</Label>
            <Textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)} rows={3} />
          </div>

          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm font-body font-semibold">Report Settings</p>
            {[
              { key: 'is_active', label: 'Active Client', desc: 'Include in monthly reporting' },
              { key: 'enable_mom_comparison', label: 'MoM Comparison', desc: 'Compare with previous month' },
              { key: 'enable_yoy_comparison', label: 'YoY Comparison', desc: 'Compare with same month last year' },
              { key: 'enable_explanations', label: 'AI Explanations', desc: 'Plain-English insights' },
              { key: 'enable_upsell', label: 'Upsell Section', desc: 'Recommend AMW services' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-body">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  checked={form[item.key as keyof typeof form] as boolean}
                  onCheckedChange={v => handleChange(item.key, v)}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientEditDialog;
