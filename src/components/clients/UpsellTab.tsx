import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PortalUpsellsSettings from './PortalUpsellsSettings';

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Upsell {
  id: string;
  org_id: string;
  client_id: string;
  report_month: number;
  report_year: number;
  service_name: string;
  headline: string;
  body_content: string;
  comparison_data: { label: string; option_a: string; option_b: string }[] | null;
  is_active: boolean;
  created_at: string;
}

interface ComparisonRow {
  label: string;
  option_a: string;
  option_b: string;
}

const SERVICE_TEMPLATES: Record<string, { headline: string; body: string }> = {
  'SEO Package': {
    headline: 'Ready to grow your Google presence?',
    body: `Search Engine Optimisation (SEO) is the process of improving your website so it appears higher in Google search results when people look for the products or services you offer.

Based on your current data, there's a clear opportunity to capture more of the search traffic already looking for businesses like yours. SEO is a long-term investment — most businesses start seeing meaningful results within 3-6 months, with improvements compounding over time.

Our SEO package includes:
- Full website audit and keyword research
- Monthly on-page optimisation
- Content strategy and creation
- Local SEO setup and management
- Monthly progress reporting

Unlike paid ads, SEO builds lasting visibility. Once you rank for a search term, every click is free.`,
  },
  'Social Media Management': {
    headline: 'Let us handle your social media so you can focus on your business',
    body: `Managing social media consistently takes time — planning content, creating posts, engaging with your audience, and keeping up with trends. Our social media management service takes all of that off your plate.

We'll create and publish content across your chosen platforms, respond to comments and messages, and grow your audience with a clear strategy tailored to your business goals.

What's included:
- Content calendar planning
- Post creation and scheduling (images, videos, stories)
- Community management and engagement
- Monthly analytics and strategy adjustments
- Platform-specific optimisation

Consistency is the key to social media success. We ensure your business shows up regularly and professionally.`,
  },
  'Content Production': {
    headline: 'Professional content that tells your story',
    body: `Great content is the foundation of every successful marketing strategy. Whether it's blog articles, social media graphics, video content, or photography — we create content that connects with your audience and drives results.

What's included:
- Professional photography and video production
- Graphic design for social media and ads
- Blog and article writing
- Brand storytelling and copywriting
- Content repurposing across platforms

High-quality content builds trust with your audience and gives every other marketing channel more to work with.`,
  },
  'Google Ads': {
    headline: 'Get in front of customers the moment they search for you',
    body: `Google Ads puts your business at the top of search results for the exact terms your potential customers are searching. It's the fastest way to drive qualified traffic to your website.

We handle everything — keyword research, ad creation, bid management, and ongoing optimisation to maximise your return on investment.

What's included:
- Campaign strategy and setup
- Keyword research and selection
- Ad copywriting and testing
- Bid management and budget optimisation
- Conversion tracking setup
- Monthly performance reporting

Most campaigns start generating leads within the first week. We continuously optimise to reduce your cost per lead over time.`,
  },
  'Email Marketing': {
    headline: 'Turn your contact list into a revenue channel',
    body: `Email marketing remains one of the highest-ROI channels available. For every £1 spent, businesses typically see £36 back. We'll help you build, segment, and engage your email list to drive repeat business and nurture new leads.

What's included:
- Email template design
- Campaign strategy and planning
- List segmentation and management
- Automated email sequences
- A/B testing and optimisation
- Performance analytics

Your email list is an asset you own — unlike social media followers, you control the relationship directly.`,
  },
  'Website Redesign': {
    headline: 'A website that works as hard as you do',
    body: `Your website is your digital shopfront. If it's slow, outdated, or hard to navigate, you're losing potential customers every day. A modern, well-designed website builds trust and makes it easy for visitors to take action.

What's included:
- Custom design tailored to your brand
- Mobile-responsive development
- Fast loading speeds (optimised for Google)
- SEO-friendly structure
- Contact forms and call-to-action placement
- Content management system for easy updates

A well-built website pays for itself by converting more of your existing traffic into enquiries and customers.`,
  },
};

interface UpsellTabProps {
  clientId: string;
}

const UpsellTab = ({ clientId }: UpsellTabProps) => {
  const { orgId } = useOrg();
  const { user } = useAuth();
  const [upsells, setUpsells] = useState<Upsell[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUpsell, setEditingUpsell] = useState<Upsell | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formMonth, setFormMonth] = useState<number>(new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2);
  const [formYear, setFormYear] = useState<number>(new Date().getMonth() + 2 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear());
  const [formServiceName, setFormServiceName] = useState('');
  const [formHeadline, setFormHeadline] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formIncludeComparison, setFormIncludeComparison] = useState(false);
  const [formComparison, setFormComparison] = useState<ComparisonRow[]>([{ label: '', option_a: '', option_b: '' }]);

  const fetchUpsells = useCallback(async () => {
    if (!orgId) return;
    const { data, error } = await supabase
      .from('report_upsells')
      .select('*')
      .eq('client_id', clientId)
      .eq('org_id', orgId)
      .order('report_year', { ascending: false })
      .order('report_month', { ascending: false });

    if (error) {
      toast.error('Failed to load upsells');
      return;
    }
    setUpsells((data ?? []).map((d: Record<string, unknown>) => ({
      ...d,
      comparison_data: d.comparison_data as Upsell['comparison_data'],
    })) as Upsell[]);
    setIsLoading(false);
  }, [clientId, orgId]);

  useEffect(() => { fetchUpsells(); }, [fetchUpsells]);

  const resetForm = () => {
    const nextMonth = new Date().getMonth() + 2;
    setFormMonth(nextMonth > 12 ? nextMonth - 12 : nextMonth);
    setFormYear(nextMonth > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear());
    setFormServiceName('');
    setFormHeadline('');
    setFormBody('');
    setFormIncludeComparison(false);
    setFormComparison([{ label: '', option_a: '', option_b: '' }]);
    setEditingUpsell(null);
  };

  const loadTemplate = (templateName: string) => {
    const template = SERVICE_TEMPLATES[templateName];
    if (template) {
      setFormServiceName(templateName);
      setFormHeadline(template.headline);
      setFormBody(template.body);
    }
  };

  const openEdit = (upsell: Upsell) => {
    setEditingUpsell(upsell);
    setFormMonth(upsell.report_month);
    setFormYear(upsell.report_year);
    setFormServiceName(upsell.service_name);
    setFormHeadline(upsell.headline);
    setFormBody(upsell.body_content);
    setFormIncludeComparison(!!upsell.comparison_data && upsell.comparison_data.length > 0);
    setFormComparison(upsell.comparison_data ?? [{ label: '', option_a: '', option_b: '' }]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!orgId || !user) return;
    if (!formServiceName.trim() || !formHeadline.trim() || !formBody.trim()) {
      toast.error('Please fill in service name, headline, and body content');
      return;
    }
    setIsSaving(true);

    const payload = {
      org_id: orgId,
      client_id: clientId,
      report_month: formMonth,
      report_year: formYear,
      service_name: formServiceName.trim(),
      headline: formHeadline.trim(),
      body_content: formBody.trim(),
      comparison_data: formIncludeComparison ? JSON.parse(JSON.stringify(formComparison.filter(r => r.label.trim()))) : null,
      is_active: true,
      created_by: user.id,
    };

    let error;
    if (editingUpsell) {
      ({ error } = await supabase.from('report_upsells').update(payload).eq('id', editingUpsell.id));
    } else {
      ({ error } = await supabase.from('report_upsells').insert(payload));
    }

    if (error) {
      toast.error(`Failed to save upsell: ${error.message}`);
    } else {
      toast.success(editingUpsell ? 'Upsell updated' : 'Upsell scheduled');
      setDialogOpen(false);
      resetForm();
      fetchUpsells();
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('report_upsells').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete upsell');
    } else {
      toast.success('Upsell deleted');
      fetchUpsells();
    }
  };

  const getStatus = (month: number, year: number): { label: string; variant: 'default' | 'secondary' | 'outline' } => {
    const now = new Date();
    const upsellDate = new Date(year, month - 1);
    const currentDate = new Date(now.getFullYear(), now.getMonth());
    if (upsellDate > currentDate) return { label: 'Upcoming', variant: 'secondary' };
    if (upsellDate.getTime() === currentDate.getTime()) return { label: 'This month', variant: 'default' };
    return { label: 'Past', variant: 'outline' };
  };

  const addComparisonRow = () => {
    setFormComparison([...formComparison, { label: '', option_a: '', option_b: '' }]);
  };

  const updateComparisonRow = (idx: number, field: keyof ComparisonRow, value: string) => {
    const updated = [...formComparison];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormComparison(updated);
  };

  const removeComparisonRow = (idx: number) => {
    setFormComparison(formComparison.filter((_, i) => i !== idx));
  };

  // Month options - current month onwards for 12 months
  const monthOptions: { month: number; year: number }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i);
    monthOptions.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading upsells...</div>;
  }

  return (
    <div className="space-y-4">
      <PortalUpsellsSettings clientId={clientId} />
      <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-lg">Scheduled Upsells</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Schedule Upsell</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editingUpsell ? 'Edit Upsell' : 'Schedule New Upsell'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Template picker */}
              {!editingUpsell && (
                <div>
                  <Label>Use template</Label>
                  <Select onValueChange={loadTemplate}>
                    <SelectTrigger><SelectValue placeholder="Start from a template..." /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(SERVICE_TEMPLATES).map(name => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Month & Year */}
              <div>
                <Label>Report Month</Label>
                <Select
                  value={`${formMonth}-${formYear}`}
                  onValueChange={v => {
                    const [m, yr] = v.split('-').map(Number);
                    setFormMonth(m);
                    setFormYear(yr);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(opt => (
                      <SelectItem key={`${opt.month}-${opt.year}`} value={`${opt.month}-${opt.year}`}>
                        {MONTH_NAMES[opt.month]} {opt.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service name */}
              <div>
                <Label>Service Name</Label>
                <Input
                  value={formServiceName}
                  onChange={e => setFormServiceName(e.target.value)}
                  placeholder='e.g. "SEO Package — £350+VAT/month"'
                />
              </div>

              {/* Headline */}
              <div>
                <Label>Headline</Label>
                <Input
                  value={formHeadline}
                  onChange={e => setFormHeadline(e.target.value)}
                  placeholder='e.g. "Ready to grow your Google presence?"'
                />
              </div>

              {/* Body content */}
              <div>
                <Label>Body Content</Label>
                <Textarea
                  value={formBody}
                  onChange={e => setFormBody(e.target.value)}
                  rows={10}
                  placeholder="Write this as if speaking directly to the client. Reference their actual results where possible. Explain the service in plain English, what's included, realistic expectations, and a clear next step."
                />
              </div>

              {/* Comparison table toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Include comparison table</p>
                  <p className="text-xs text-muted-foreground">Add a simple comparison for the client</p>
                </div>
                <Switch checked={formIncludeComparison} onCheckedChange={setFormIncludeComparison} />
              </div>

              {/* Comparison table builder */}
              {formIncludeComparison && (
                <div className="space-y-2 border rounded-md p-3">
                  <p className="text-sm font-medium text-muted-foreground">Comparison Table</p>
                  {formComparison.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                      <Input
                        value={row.label}
                        onChange={e => updateComparisonRow(idx, 'label', e.target.value)}
                        placeholder="Feature"
                        className="text-sm"
                      />
                      <Input
                        value={row.option_a}
                        onChange={e => updateComparisonRow(idx, 'option_a', e.target.value)}
                        placeholder="Option A"
                        className="text-sm"
                      />
                      <Input
                        value={row.option_b}
                        onChange={e => updateComparisonRow(idx, 'option_b', e.target.value)}
                        placeholder="Option B"
                        className="text-sm"
                      />
                      <Button size="icon" variant="ghost" onClick={() => removeComparisonRow(idx)} className="h-8 w-8">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={addComparisonRow} className="gap-1">
                    <Plus className="h-3 w-3" /> Add Row
                  </Button>
                </div>
              )}

              <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {isSaving ? 'Saving...' : editingUpsell ? 'Update Upsell' : 'Schedule Upsell'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {upsells.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No upsells scheduled</p>
            <p className="text-xs text-muted-foreground mt-1">Schedule an upsell to include a service recommendation in a future report</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upsells.map(upsell => {
              const status = getStatus(upsell.report_month, upsell.report_year);
              return (
                <div key={upsell.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-body font-medium">{upsell.service_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {MONTH_NAMES[upsell.report_month]} {upsell.report_year}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(upsell)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this upsell?</AlertDialogTitle>
                          <AlertDialogDescription>This will remove the scheduled upsell for {MONTH_NAMES[upsell.report_month]} {upsell.report_year}.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(upsell.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
};

export default UpsellTab;
