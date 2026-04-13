import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ImageOff, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────

interface CampaignItem {
  name: string;
  id: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  leads: number;
  ctr: number;
  cpc: number;
  status: string;
  objective?: string | null;
}

interface AdSetItem {
  name: string;
  id: string;
  campaign_id: string;
  campaign_name?: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  leads: number;
  ctr: number;
  cpc: number;
  status: string;
}

interface AdItem {
  name: string;
  id: string;
  adset_id: string;
  adset_name?: string;
  campaign_id: string;
  campaign_name?: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  leads: number;
  ctr: number;
  cpc: number;
  status: string;
  creative?: {
    thumbnail_url?: string | null;
    title?: string | null;
    body?: string | null;
    image_url?: string | null;
  } | null;
}

interface AdCampaignBreakdownProps {
  rawData: {
    campaigns?: CampaignItem[];
    adSets?: AdSetItem[];
    ads?: AdItem[];
    creatives?: Record<string, unknown>;
  };
  currSymbol: string;
  adGroupLabel?: string;
}

// ─── Helpers ───────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-accent/20 text-accent border-accent/30',
  ENABLED: 'bg-accent/20 text-accent border-accent/30',
  PAUSED: 'bg-muted text-muted-foreground border-border',
  ARCHIVED: 'bg-muted text-muted-foreground/60 border-border',
  DELETED: 'bg-destructive/20 text-destructive border-destructive/30',
  REMOVED: 'bg-destructive/20 text-destructive border-destructive/30',
  DRAFT: 'bg-muted text-muted-foreground/80 border-border',
};

const StatusBadge = ({ status }: { status: string | undefined | null }) => {
  const s = status?.toUpperCase() || 'UNKNOWN';
  const label = s.charAt(0) + s.slice(1).toLowerCase();
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
      STATUS_COLORS[s] || 'bg-muted text-muted-foreground border-border',
    )}>
      {label}
    </span>
  );
};

const safe = (v: number | undefined | null): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtCurrency = (val: number | undefined | null, sym: string) => {
  const v = safe(val);
  return `${sym}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtNum = (val: number | undefined | null) => {
  const v = safe(val);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return Math.round(v).toLocaleString();
};

const fmtPct = (val: number | undefined | null) => `${safe(val).toFixed(2)}%`;

// ─── Sub-components ────────────────────────────────────────────

const CampaignsTable = ({ items, currSymbol }: { items: CampaignItem[]; currSymbol: string }) => (
  <div className="rounded-lg border overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Campaign</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Objective</TableHead>
          <TableHead className="text-right">Spend</TableHead>
          <TableHead className="text-right">Impressions</TableHead>
          <TableHead className="text-right">Clicks</TableHead>
          <TableHead className="text-right">CTR</TableHead>
          <TableHead className="text-right">CPC</TableHead>
          <TableHead className="text-right">Leads</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">No campaigns found.</TableCell>
          </TableRow>
        ) : items.map(c => (
          <TableRow key={c.id}>
            <TableCell className="text-sm font-medium max-w-[250px] truncate">{c.name}</TableCell>
            <TableCell><StatusBadge status={c.status} /></TableCell>
            <TableCell className="text-sm text-muted-foreground capitalize">{c.objective?.toLowerCase().replace(/_/g, ' ') || '—'}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{fmtCurrency(c.spend, currSymbol)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{fmtNum(c.impressions)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{fmtNum(c.clicks)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{fmtPct(c.ctr)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{fmtCurrency(c.cpc, currSymbol)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{safe(c.leads) > 0 ? fmtNum(c.leads) : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const AdSetsTable = ({ items, currSymbol, label = 'Ad Set' }: { items: AdSetItem[]; currSymbol: string; label?: string }) => (
  <div className="rounded-lg border overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{label}</TableHead>
          <TableHead>Campaign</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Spend</TableHead>
          <TableHead className="text-right">Impressions</TableHead>
          <TableHead className="text-right">Clicks</TableHead>
          <TableHead className="text-right">CTR</TableHead>
          <TableHead className="text-right">CPC</TableHead>
          <TableHead className="text-right">Leads</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">No ad sets found.</TableCell>
          </TableRow>
        ) : items.map(a => (
          <TableRow key={a.id}>
            <TableCell className="text-sm font-medium max-w-[220px] truncate">{a.name}</TableCell>
            <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{a.campaign_name || '—'}</TableCell>
            <TableCell><StatusBadge status={a.status} /></TableCell>
            <TableCell className="text-right text-sm tabular-nums">{fmtCurrency(a.spend, currSymbol)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{fmtNum(a.impressions)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{fmtNum(a.clicks)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{fmtPct(a.ctr)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{fmtCurrency(a.cpc, currSymbol)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{safe(a.leads) > 0 ? fmtNum(a.leads) : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const AdCard = ({ ad, currSymbol }: { ad: AdItem; currSymbol: string }) => {
  const thumbUrl = ad.creative?.thumbnail_url || ad.creative?.image_url;
  return (
    <Card className="overflow-hidden">
      {/* Creative image */}
      <div className="relative aspect-video bg-muted">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <StatusBadge status={ad.status} />
        </div>
      </div>

      <CardContent className="p-3 space-y-2">
        <p className="text-sm font-medium truncate">{ad.name}</p>
        {ad.creative?.body && (
          <p className="text-xs text-muted-foreground line-clamp-2">{ad.creative.body}</p>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Spend</span>
            <span className="tabular-nums font-medium">{fmtCurrency(ad.spend, currSymbol)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Clicks</span>
            <span className="tabular-nums font-medium">{fmtNum(ad.clicks)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CTR</span>
            <span className="tabular-nums font-medium">{fmtPct(ad.ctr)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CPC</span>
            <span className="tabular-nums font-medium">{fmtCurrency(ad.cpc, currSymbol)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Impr.</span>
            <span className="tabular-nums font-medium">{fmtNum(ad.impressions)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Reach</span>
            <span className="tabular-nums font-medium">{fmtNum(ad.reach)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Main Component ────────────────────────────────────────────

const AdCampaignBreakdown = ({ rawData, currSymbol, adGroupLabel = 'Ad Sets' }: AdCampaignBreakdownProps) => {
  const [open, setOpen] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const allCampaigns = rawData.campaigns || [];
  const allAdSets = rawData.adSets || [];
  const allAds = rawData.ads || [];

  const isActive = (status: string | undefined | null) => {
    const s = status?.toUpperCase() || '';
    return s === 'ACTIVE' || s === 'ENABLED';
  };

  const campaigns = useMemo(() => {
    const filtered = showActiveOnly ? allCampaigns.filter(c => isActive(c.status)) : allCampaigns;
    return [...filtered].sort((a, b) => safe(b.spend) - safe(a.spend));
  }, [allCampaigns, showActiveOnly]);

  const adSets = useMemo(() => {
    const filtered = showActiveOnly ? allAdSets.filter(a => isActive(a.status)) : allAdSets;
    return [...filtered].sort((a, b) => safe(b.spend) - safe(a.spend));
  }, [allAdSets, showActiveOnly]);

  const ads = useMemo(() => {
    const filtered = showActiveOnly ? allAds.filter(a => isActive(a.status)) : allAds;
    return [...filtered].sort((a, b) => safe(b.spend) - safe(a.spend));
  }, [allAds, showActiveOnly]);

  if (allCampaigns.length === 0 && allAdSets.length === 0 && allAds.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        Campaign Breakdown ({allCampaigns.length} campaigns, {allAdSets.length} {adGroupLabel.toLowerCase()}, {allAds.length} ads)
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-3">
        {/* Filter toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={showActiveOnly ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setShowActiveOnly(!showActiveOnly)}
          >
            <Filter className="h-3 w-3" />
            {showActiveOnly ? 'Active Only' : 'All Statuses'}
          </Button>
        </div>

        <Tabs defaultValue="campaigns" className="w-full">
          <TabsList>
            <TabsTrigger value="campaigns">Campaigns ({campaigns.length})</TabsTrigger>
            <TabsTrigger value="adsets">{adGroupLabel} ({adSets.length})</TabsTrigger>
            <TabsTrigger value="ads">Ads ({ads.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns">
            <CampaignsTable items={campaigns} currSymbol={currSymbol} />
          </TabsContent>

          <TabsContent value="adsets">
            <AdSetsTable items={adSets} currSymbol={currSymbol} label={adGroupLabel === 'Ad Groups' ? 'Ad Group' : 'Ad Set'} />
          </TabsContent>

          <TabsContent value="ads">
            {ads.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">No ads found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {ads.map(ad => (
                  <AdCard key={ad.id} ad={ad} currSymbol={currSymbol} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default AdCampaignBreakdown;
