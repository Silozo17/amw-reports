import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import usePageMeta from '@/hooks/usePageMeta';

interface TrackedHandle {
  platform: string;
  handle: string;
}

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
];

const NicheFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const { orgId } = useOrg();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState<string>('');
  const [label, setLabel] = useState('');
  const [language, setLanguage] = useState('en');
  const [handles, setHandles] = useState<TrackedHandle[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [handleInput, setHandleInput] = useState('');
  const [handlePlatform, setHandlePlatform] = useState('instagram');
  const [hashtagInput, setHashtagInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [competitorInput, setCompetitorInput] = useState('');

  usePageMeta({ title: isEdit ? 'Edit niche · Content Lab' : 'New niche · Content Lab', description: 'Configure who Content Lab tracks for this client.' });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-niche', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('org_id', orgId!)
        .eq('is_active', true)
        .order('company_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      const { data, error } = await supabase
        .from('content_lab_niches')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) return;
      setClientId(data.client_id);
      setLabel(data.label);
      setLanguage(data.language);
      setHandles((data.tracked_handles as unknown as TrackedHandle[]) ?? []);
      setHashtags(data.tracked_hashtags ?? []);
      setKeywords(data.tracked_keywords ?? []);
      setCompetitors(data.competitor_urls ?? []);
    })();
  }, [id, isEdit]);

  const addHandle = () => {
    const h = handleInput.trim().replace(/^@/, '');
    if (!h) return;
    setHandles((prev) => [...prev, { platform: handlePlatform, handle: h }]);
    setHandleInput('');
  };

  const addToken = (value: string, list: string[], setter: (v: string[]) => void, clear: () => void, prefix = '') => {
    const v = value.trim().replace(new RegExp(`^${prefix}`), '');
    if (!v) return;
    if (list.includes(v)) return;
    setter([...list, v]);
    clear();
  };

  const handleSave = async () => {
    if (!orgId) return;
    if (!clientId) return toast.error('Pick a client');
    if (!label.trim()) return toast.error('Give the niche a label');

    setSaving(true);
    try {
      const payload = {
        client_id: clientId,
        org_id: orgId,
        label: label.trim(),
        language,
        tracked_handles: handles as unknown as never,
        tracked_hashtags: hashtags,
        tracked_keywords: keywords,
        competitor_urls: competitors,
      };

      if (isEdit && id) {
        const { error } = await supabase.from('content_lab_niches').update(payload).eq('id', id).eq('org_id', orgId);
        if (error) throw error;
        toast.success('Niche updated');
      } else {
        const { error } = await supabase.from('content_lab_niches').insert(payload);
        if (error) throw error;
        toast.success('Niche created');
      }
      await queryClient.invalidateQueries({ queryKey: ['content-lab-niches'] });
      navigate('/content-lab');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/content-lab')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Content Lab
        </Button>

        <header>
          <h1 className="font-display text-3xl">{isEdit ? 'Edit Niche' : 'New Niche'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell Content Lab who to watch. The more sources you give, the sharper the ideas.
          </p>
        </header>

        <Card className="space-y-5 p-6">
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={isEdit}>
              <SelectTrigger><SelectValue placeholder="Pick a client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Niche label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Sustainable skincare UK" />
          </div>

          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="da">Danish</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div>
            <Label>Tracked handles</Label>
            <p className="mt-1 text-xs text-muted-foreground">Competitor or inspiration accounts to scrape.</p>
          </div>
          <div className="flex gap-2">
            <Select value={handlePlatform} onValueChange={setHandlePlatform}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHandle())}
              placeholder="@username"
            />
            <Button type="button" onClick={addHandle} variant="secondary"><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {handles.map((h, i) => (
              <Badge key={`${h.platform}-${h.handle}-${i}`} variant="secondary" className="gap-1.5">
                {h.platform} · @{h.handle}
                <button onClick={() => setHandles(handles.filter((_, idx) => idx !== i))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </Card>

        <TokenSection
          label="Hashtags"
          help="Hashtags to monitor (without #)."
          input={hashtagInput}
          setInput={setHashtagInput}
          tokens={hashtags}
          setTokens={setHashtags}
          onAdd={() => addToken(hashtagInput, hashtags, setHashtags, () => setHashtagInput(''), '#')}
          prefix="#"
        />

        <TokenSection
          label="Keywords"
          help="Topics or phrases to listen for."
          input={keywordInput}
          setInput={setKeywordInput}
          tokens={keywords}
          setTokens={setKeywords}
          onAdd={() => addToken(keywordInput, keywords, setKeywords, () => setKeywordInput(''))}
        />

        <TokenSection
          label="Competitor URLs"
          help="Direct profile or page URLs."
          input={competitorInput}
          setInput={setCompetitorInput}
          tokens={competitors}
          setTokens={setCompetitors}
          onAdd={() => addToken(competitorInput, competitors, setCompetitors, () => setCompetitorInput(''))}
        />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate('/content-lab')}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create niche'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

interface TokenSectionProps {
  label: string;
  help: string;
  input: string;
  setInput: (v: string) => void;
  tokens: string[];
  setTokens: (v: string[]) => void;
  onAdd: () => void;
  prefix?: string;
}

const TokenSection = ({ label, help, input, setInput, tokens, setTokens, onAdd, prefix = '' }: TokenSectionProps) => (
  <Card className="space-y-4 p-6">
    <div>
      <Label>{label}</Label>
      <p className="mt-1 text-xs text-muted-foreground">{help}</p>
    </div>
    <div className="flex gap-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAdd())}
      />
      <Button type="button" onClick={onAdd} variant="secondary"><Plus className="h-4 w-4" /></Button>
    </div>
    <div className="flex flex-wrap gap-2">
      {tokens.map((t) => (
        <Badge key={t} variant="secondary" className="gap-1.5">
          {prefix}{t}
          <button onClick={() => setTokens(tokens.filter((x) => x !== t))}>
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  </Card>
);

export default NicheFormPage;
