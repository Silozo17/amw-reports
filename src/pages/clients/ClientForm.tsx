import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const ClientForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    preferred_currency: 'AUD',
    preferred_timezone: 'Australia/Sydney',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.company_name) {
      toast.error('Name and company are required');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from('clients').insert({
      ...form,
      created_by: user?.id,
    });

    if (error) {
      toast.error('Failed to create client');
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
          <Card>
            <CardHeader><CardTitle className="font-display text-lg">Contact Details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={e => handleChange('full_name', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input value={form.company_name} onChange={e => handleChange('company_name', e.target.value)} required />
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
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => handleChange('phone', e.target.value)} />
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
                <Input value={form.preferred_currency} onChange={e => handleChange('preferred_currency', e.target.value)} />
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Client'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/clients')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default ClientForm;
