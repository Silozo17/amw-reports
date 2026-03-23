import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { Client } from '@/types/database';

interface ClientEditDialogProps {
  client: Client;
  onUpdate: () => void;
}

const ClientEditDialog = ({ client, onUpdate }: ClientEditDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    }
  }, [open, client]);

  const handleChange = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.full_name || !form.company_name) {
      toast.error('Name and company are required');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from('clients').update(form).eq('id', client.id);

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
              <Label className="text-sm">Phone</Label>
              <Input value={form.phone} onChange={e => handleChange('phone', e.target.value)} />
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
              <Input value={form.preferred_currency} onChange={e => handleChange('preferred_currency', e.target.value)} />
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
