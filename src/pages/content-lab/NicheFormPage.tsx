import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import usePageMeta from '@/hooks/usePageMeta';

interface CompetitorEntry {
  handle: string;
  platform?: string;
  reason?: string;
}

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok (Phase 2)', disabled: true },
  { value: 'facebook', label: 'Facebook (Phase 2)', disabled: true },
];

const CONTENT_STYLES = ['talking head', 'B-roll/creative', 'voiceover-only', 'UGC-style', 'tutorial', 'behind-the-scenes'];
const TONES = ['professional', 'conversational', 'witty', 'bold', 'educational', 'inspiring'];
const PRODUCERS = ['internal team', 'freelancer', 'agency', 'founder-on-phone'];
const VIDEO_LENGTHS = ['15s', '30s', '60s', '90s'];
const CADENCES = ['daily', '3x week', 'weekly'];

const NicheFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const { orgId } = useOrg();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState<string>('');
  const [label, setLabel] = useState('');
  const [language, setLanguage] = useState('en');

  // Core 3 inputs
  const [ownHandle, setOwnHandle] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [platformsToScrape, setPlatformsToScrape] = useState<string[]>(['instagram']);

  // Discovered / editable
  const [nicheDescription, setNicheDescription] = useState('');
  const [topCompetitors, setTopCompetitors] = useState<CompetitorEntry[]>([]);
  const [topGlobalBenchmarks, setTopGlobalBenchmarks] = useState<CompetitorEntry[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);

  // Advanced
  const [contentStyles, setContentStyles] = useState<string[]>([]);
  const [toneOfVoice, setToneOfVoice] = useState<string>('');
  const [producerType, setProducerType] = useState<string>('');
  const [videoLength, setVideoLength] = useState<string>('');
  const [postingCadence, setPostingCadence] = useState<string>('');
  const [doNotUse, setDoNotUse] = useState<string[]>([]);
  const [doNotUseInput, setDoNotUseInput] = useState('');

  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hasDiscovered, setHasDiscovered] = useState(false);

  usePageMeta({ title: isEdit ? 'Edit niche · Content Lab' : 'New niche · Content Lab', description: 'Configure who Content Lab tracks for this client.' });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-niche', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, website, social_handles')
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
      setOwnHandle(data.own_handle ?? '');
      setWebsite(data.website ?? '');
      setLocation(data.location ?? '');
      setPlatformsToScrape(data.platforms_to_scrape ?? ['instagram']);
      setNicheDescription(data.niche_description ?? '');
      setTopCompetitors((data.top_competitors as unknown as CompetitorEntry[]) ?? []);
      setTopGlobalBenchmarks((data.top_global_benchmarks as unknown as CompetitorEntry[]) ?? []);
      setHashtags(data.tracked_hashtags ?? []);
      setKeywords(data.tracked_keywords ?? []);
      setContentStyles(data.content_styles ?? []);
      setToneOfVoice(data.tone_of_voice ?? '');
      setProducerType(data.producer_type ?? '');
      setVideoLength(data.video_length_preference ?? '');
      setPostingCadence(data.posting_cadence ?? '');
      setDoNotUse(data.do_not_use ?? []);
      setHasDiscovered(!!data.discovered_at);
    })();
  }, [id, isEdit]);

  // Auto-fill from client when picked
  useEffect(() => {
    if (!clientId || isEdit) return;
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    if (!website && client.website) setWebsite(client.website);
    const handles = client.social_handles as Record<string, string> | null;
    if (!ownHandle && handles?.instagram) setOwnHandle(handles.instagram);
  }, [clientId, clients, isEdit]);

  const handleDiscover = async () => {
    if (!ownHandle.trim() && !website.trim()) {
      return toast.error('Add at least an IG handle or website to discover');
    }
    setDiscovering(true);
    try {
      const { data, error } = await supabase.functions.invoke('content-lab-discover', {
        body: {
          own_handle: ownHandle.trim().replace(/^@/, ''),
          website: website.trim(),
          location: location.trim(),
        },
      });
      if (error) throw error;
      const result = data?.result;
      if (!result) throw new Error('No result from discovery');

      setLabel(result.niche_label ?? label);
      setNicheDescription(result.niche_description ?? '');
      setTopCompetitors(result.top_competitors ?? []);
      setTopGlobalBenchmarks(result.top_global_benchmarks ?? []);
      setHashtags(result.suggested_hashtags ?? []);
      setKeywords(result.suggested_keywords ?? []);
      const prefs = result.default_creative_prefs ?? {};
      if (prefs.content_styles) setContentStyles(prefs.content_styles);
      if (prefs.tone_of_voice) setToneOfVoice(prefs.tone_of_voice);
      if (prefs.producer_type) setProducerType(prefs.producer_type);
      if (prefs.video_length_preference) setVideoLength(prefs.video_length_preference);
      if (prefs.posting_cadence) setPostingCadence(prefs.posting_cadence);

      setHasDiscovered(true);
      setAdvancedOpen(true);
      toast.success('Discovery complete — review and edit below');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      setDiscovering(false);
    }
  };

  const togglePlatform = (p: string) => {
    setPlatformsToScrape((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const toggleStyle = (s: string) => {
    setContentStyles((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const addDoNotUse = () => {
    const v = doNotUseInput.trim();
    if (!v || doNotUse.includes(v)) return;
    setDoNotUse([...doNotUse, v]);
    setDoNotUseInput('');
  };

  const handleSave = async () => {
    if (!orgId) return;
    if (!clientId) return toast.error('Pick a client');
    if (!label.trim()) return toast.error('Run Discover first or add a niche label');
    if (platformsToScrape.length === 0) return toast.error('Pick at least one platform');

    setSaving(true);
    try {
      const tracked_handles = ownHandle.trim()
        ? [{ platform: 'instagram', handle: ownHandle.trim().replace(/^@/, '') }]
        : [];

      const competitor_urls = topCompetitors
        .map((c) => (c.handle ? `https://instagram.com/${c.handle.replace(/^@/, '')}` : ''))
        .filter(Boolean);

      const payload = {
        client_id: clientId,
        org_id: orgId,
        label: label.trim(),
        language,
        own_handle: ownHandle.trim().replace(/^@/, '') || null,
        website: website.trim() || null,
        location: location.trim() || null,
        platforms_to_scrape: platformsToScrape,
        niche_description: nicheDescription.trim() || null,
        top_competitors: topCompetitors as unknown as never,
        top_global_benchmarks: topGlobalBenchmarks as unknown as never,
        tracked_handles: tracked_handles as unknown as never,
        tracked_hashtags: hashtags,
        tracked_keywords: keywords,
        competitor_urls,
        content_styles: contentStyles,
        tone_of_voice: toneOfVoice || null,
        producer_type: producerType || null,
        video_length_preference: videoLength || null,
        posting_cadence: postingCadence || null,
        do_not_use: doNotUse,
        discovered_at: hasDiscovered ? new Date().toISOString() : null,
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
            Add your handle, website and location. We'll discover your niche, top 10 local competitors and the top 10 global benchmarks automatically.
          </p>
        </header>

        {/* Client picker */}
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
        </Card>

        {/* Core inputs */}
        <Card className="space-y-5 p-6">
          <div>
            <h2 className="font-medium">Tell us about you</h2>
            <p className="mt-1 text-xs text-muted-foreground">We need at least your IG handle or website to discover everything else.</p>
          </div>

          <div className="space-y-2">
            <Label>Your Instagram handle</Label>
            <Input value={ownHandle} onChange={(e) => setOwnHandle(e.target.value)} placeholder="@yourbrand" />
          </div>

          <div className="space-y-2">
            <Label>Your website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourbrand.com" />
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="London, UK" />
          </div>

          <div className="space-y-2">
            <Label>Platforms to scrape</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <Badge
                  key={p.value}
                  variant={platformsToScrape.includes(p.value) ? 'default' : 'outline'}
                  className={p.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                  onClick={() => !p.disabled && togglePlatform(p.value)}
                >
                  {p.label}
                </Badge>
              ))}
            </div>
          </div>

          <Button onClick={handleDiscover} disabled={discovering} className="w-full" variant="secondary">
            {discovering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {hasDiscovered ? 'Re-discover' : 'Discover niche & competitors'}
          </Button>
        </Card>

        {/* Discovered niche review */}
        {(hasDiscovered || isEdit) && (
          <Card className="space-y-5 p-6">
            <div>
              <h2 className="font-medium">Niche profile</h2>
              <p className="mt-1 text-xs text-muted-foreground">Review and edit anything that's off.</p>
            </div>

            <div className="space-y-2">
              <Label>Niche label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. London wedding photographers" />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={nicheDescription} onChange={(e) => setNicheDescription(e.target.value)} rows={2} />
            </div>

            <CompetitorList
              title="Top 10 local competitors"
              entries={topCompetitors}
              onChange={setTopCompetitors}
            />

            <CompetitorList
              title="Top 10 global benchmarks"
              entries={topGlobalBenchmarks}
              onChange={setTopGlobalBenchmarks}
            />

            <TokenSection label="Hashtags" tokens={hashtags} setTokens={setHashtags} prefix="#" />
            <TokenSection label="Keywords" tokens={keywords} setTokens={setKeywords} />
          </Card>
        )}

        {/* Advanced prefs */}
        <Card className="p-6">
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between">
                <div className="text-left">
                  <h2 className="font-medium">Creative preferences</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Optional — pre-filled from discovery, edit to taste.</p>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-5 space-y-5">
              <div className="space-y-2">
                <Label>Content styles</Label>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_STYLES.map((s) => (
                    <Badge
                      key={s}
                      variant={contentStyles.includes(s) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleStyle(s)}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tone of voice</Label>
                  <Select value={toneOfVoice} onValueChange={setToneOfVoice}>
                    <SelectTrigger><SelectValue placeholder="Pick a tone" /></SelectTrigger>
                    <SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Who's filming?</Label>
                  <Select value={producerType} onValueChange={setProducerType}>
                    <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
                    <SelectContent>{PRODUCERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Video length preference</Label>
                  <Select value={videoLength} onValueChange={setVideoLength}>
                    <SelectTrigger><SelectValue placeholder="Pick length" /></SelectTrigger>
                    <SelectContent>{VIDEO_LENGTHS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Posting cadence</Label>
                  <Select value={postingCadence} onValueChange={setPostingCadence}>
                    <SelectTrigger><SelectValue placeholder="Pick cadence" /></SelectTrigger>
                    <SelectContent>{CADENCES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Do not use</Label>
                <p className="text-xs text-muted-foreground">Banned words, topics or styles (e.g. "no dancing", "no trending audio").</p>
                <div className="flex gap-2">
                  <Input
                    value={doNotUseInput}
                    onChange={(e) => setDoNotUseInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDoNotUse())}
                    placeholder="Add a rule..."
                  />
                  <Button type="button" onClick={addDoNotUse} variant="secondary"><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {doNotUse.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1.5">
                      {t}
                      <button onClick={() => setDoNotUse(doNotUse.filter((x) => x !== t))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
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
            </CollapsibleContent>
          </Collapsible>
        </Card>

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

interface CompetitorListProps {
  title: string;
  entries: CompetitorEntry[];
  onChange: (entries: CompetitorEntry[]) => void;
}

const CompetitorList = ({ title, entries, onChange }: CompetitorListProps) => {
  const [input, setInput] = useState('');

  const add = () => {
    const h = input.trim().replace(/^@/, '');
    if (!h) return;
    onChange([...entries, { handle: h }]);
    setInput('');
  };

  return (
    <div className="space-y-2">
      <Label>{title}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="@handle"
        />
        <Button type="button" onClick={add} variant="secondary"><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {entries.map((c, i) => (
          <Badge key={`${c.handle}-${i}`} variant="secondary" className="gap-1.5" title={c.reason ?? ''}>
            @{c.handle}
            <button onClick={() => onChange(entries.filter((_, idx) => idx !== i))}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
};

interface TokenSectionProps {
  label: string;
  tokens: string[];
  setTokens: (v: string[]) => void;
  prefix?: string;
}

const TokenSection = ({ label, tokens, setTokens, prefix = '' }: TokenSectionProps) => {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim().replace(new RegExp(`^${prefix}`), '');
    if (!v || tokens.includes(v)) return;
    setTokens([...tokens, v]);
    setInput('');
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
        <Button type="button" onClick={add} variant="secondary"><Plus className="h-4 w-4" /></Button>
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
    </div>
  );
};

export default NicheFormPage;
