import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { PORTAL_UPSELL_CATEGORY_LABELS, type ClientPortalUpsell, type PortalUpsellCategory } from '@/types/database';

interface PortalUpsellsSettingsProps {
  clientId: string;
  showPortalUpsells: boolean;
  onToggleShow: (value: boolean) => void;
}

const emptyForm = (): Omit<ClientPortalUpsell, 'id' | 'org_id' | 'client_id' | 'created_at' | 'updated_at' | 'sort_order'> => ({
  category: 'other',
  title: '',
  description: '',
  price_label: '',
  cta_label: 'Get in touch',
  cta_url: '',
  is_active: true,
});

const PortalUpsellsSettings = ({ clientId, showPortalUpsells, onToggleShow }: PortalUpsellsSettingsProps) => {
  const { orgId } = useOrg();
  const [items, setItems] = useState<ClientPortalUpsell[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientPortalUpsell | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const fetchItems = useCallback(async () => {
    if (!orgId) return;
    const { data, error } = await supabase
      .from('client_portal_upsells')
      .select('*')
      .eq('client_id', clientId)
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) { toast.error('Failed to load offers'); return; }
    setItems((data ?? []) as ClientPortalUpsell[]);
    setIsLoading(false);
  }, [clientId, orgId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openNew = () => { setEditing(null); setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (item: ClientPortalUpsell) => {
    setEditing(item);
    setForm({
      category: item.category,
      title: item.title,
      description: item.description ?? '',
      price_label: item.price_label ?? '',
      cta_label: item.cta_label,
      cta_url: item.cta_url ?? '',
      is_active: item.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!orgId) return;
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setIsSaving(true);
    const payload = {
      org_id: orgId,
      client_id: clientId,
      category: form.category,
      title: form.title.trim(),
      description: form.description?.trim() || null,
      price_label: form.price_label?.trim() || null,
      cta_label: form.cta_label.trim() || 'Get in touch',
      cta_url: form.cta_url?.trim() || null,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from('client_portal_upsells').update(payload).eq('id', editing.id)
      : await supabase.from('client_portal_upsells').insert({ ...payload, sort_order: items.length });
    if (error) toast.error(`Save failed: ${error.message}`);
    else {
      toast.success(editing ? 'Offer updated' : 'Offer added');
      setDialogOpen(false);
      fetchItems();
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('client_portal_upsells').delete().eq('id', id);
    if (error) toast.error('Delete failed');
    else { toast.success('Offer deleted'); fetchItems(); }
  };

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[idx]; const b = items[target];
    await Promise.all([
      supabase.from('client_portal_upsells').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('client_portal_upsells').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    fetchItems();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Portal Offers</CardTitle>
        <p className="text-xs text-muted-foreground">
          Persistent service offers shown on the client's shared portal link, grouped by category.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Show offers on share link</p>
            <p className="text-xs text-muted-foreground">Master toggle for this client</p>
          </div>
          <Switch checked={showPortalUpsells} onCheckedChange={onToggleShow} />
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm font-medium">Offers ({items.length})</p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" onClick={openNew}>
                <Plus className="h-3.5 w-3.5" /> Add Offer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">{editing ? 'Edit Offer' : 'New Offer'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v as PortalUpsellCategory })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PORTAL_UPSELL_CATEGORY_LABELS) as PortalUpsellCategory[]).map(k => (
                        <SelectItem key={k} value={k}>{PORTAL_UPSELL_CATEGORY_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder='e.g. "SEO Growth Package"' />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Short pitch describing what's included and the benefit." />
                </div>
                <div>
                  <Label>Price label</Label>
                  <Input value={form.price_label ?? ''} onChange={e => setForm({ ...form, price_label: e.target.value })} placeholder='e.g. "£350+VAT/month" or "From £500"' />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>CTA label</Label>
                    <Input value={form.cta_label} onChange={e => setForm({ ...form, cta_label: e.target.value })} placeholder="Book a call" />
                  </div>
                  <div>
                    <Label>CTA URL</Label>
                    <Input value={form.cta_url ?? ''} onChange={e => setForm({ ...form, cta_url: e.target.value })} placeholder="https://… or mailto:…" />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Inactive offers are hidden from the portal</p>
                  </div>
                  <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? 'Update Offer' : 'Add Offer'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-6">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">No offers yet. Add one to start showing recommendations on the share link.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3 rounded-md border p-3">
                <div className="flex flex-col gap-0.5">
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleMove(idx, -1)} disabled={idx === 0}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleMove(idx, 1)} disabled={idx === items.length - 1}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {PORTAL_UPSELL_CATEGORY_LABELS[item.category]}
                    </span>
                    {!item.is_active && <span className="text-[10px] text-amber-600 dark:text-amber-400">Inactive</span>}
                  </div>
                  {item.price_label && <p className="text-xs text-muted-foreground">{item.price_label}</p>}
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete offer?</AlertDialogTitle>
                      <AlertDialogDescription>"{item.title}" will be permanently removed.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(item.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PortalUpsellsSettings;
