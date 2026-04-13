import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, ImageOff, Filter } from 'lucide-react';
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
  campaign_id: string;
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
}

// ─── Helpers ───────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-accent/20 text-accent border-accent/30',
  PAUSED: 'bg-muted text-muted-foreground border-border',
  ARCHIVED: 'bg-muted text-muted-foreground/60 border-border',
  DELETED: 'bg-destructive/20 text-destructive border-destructive/30',
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={cn(
    'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
    STATUS_COLORS[status] || 'bg-muted text-muted-foreground border-border',
  )}>
    {status?.charAt(0) + status?.slice(1).toLowerCase()}
  </span>
);

const fmtCurrency = (val: number, sym: string) =>
  `${sym}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtNum = (val: number) => {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return Math.round(val).toLocaleString();
};

const fmtPct = (val: number) => `${val.toFixed(2)}%`;

// ─── Component ─────────────────────────────────────────────────

const AdCampaignBreakdown = ({ rawData, currSymbol }: AdCampaignBreakdownProps) => {
  const [open, setOpen] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());

  const allCampaigns = rawData.campaigns || [];
  const allAdSets = rawData.adSets || [];
  const allAds = rawData.ads || [];

  const campaigns = useMemo(() => {
    const filtered = showActiveOnly
      ? allCampaigns.filter(c => c.status === 'ACTIVE')
      : allCampaigns;
    return [...filtered].sort((a, b) => b.spend - a.spend);
  }, [allCampaigns, showActiveOnly]);

  const adSetsByCampaign = useMemo(() => {
    const map = new Map<string, AdSetItem[]>();
    for (const as of allAdSets) {
      if (showActiveOnly && as.status !== 'ACTIVE') continue;
      const list = map.get(as.campaign_id) || [];
      list.push(as);
      map.set(as.campaign_id, list);
    }
    for (const [key, list] of map) {
      map.set(key, list.sort((a, b) => b.spend - a.spend));
    }
    return map;
  }, [allAdSets, showActiveOnly]);

  const adsByAdSet = useMemo(() => {
    const map = new Map<string, AdItem[]>();
    for (const ad of allAds) {
      if (showActiveOnly && ad.status !== 'ACTIVE') continue;
      const list = map.get(ad.adset_id) || [];
      list.push(ad);
      map.set(ad.adset_id, list);
    }
    for (const [key, list] of map) {
      map.set(key, list.sort((a, b) => b.spend - a.spend));
    }
    return map;
  }, [allAds, showActiveOnly]);

  if (allCampaigns.length === 0) return null;

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAdSet = (id: string) => {
    setExpandedAdSets(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        Campaign Breakdown ({allCampaigns.length} campaigns, {allAdSets.length} ad sets, {allAds.length} ads)
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
          <span className="text-xs text-muted-foreground">
            Showing {campaigns.length} of {allCampaigns.length} campaigns
          </span>
        </div>

        {/* Campaign Table */}
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 px-2" />
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
              {campaigns.map(campaign => {
                const isExpanded = expandedCampaigns.has(campaign.id);
                const campaignAdSets = adSetsByCampaign.get(campaign.id) || [];

                return (
                  <>
                    <TableRow
                      key={campaign.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleCampaign(campaign.id)}
                    >
                      <TableCell className="w-8 px-2">
                        {campaignAdSets.length > 0 ? (
                          isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : <span className="h-3.5 w-3.5" />}
                      </TableCell>
                      <TableCell className="text-sm font-medium max-w-[250px] truncate">{campaign.name}</TableCell>
                      <TableCell><StatusBadge status={campaign.status} /></TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{fmtCurrency(campaign.spend, currSymbol)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{fmtNum(campaign.impressions)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{fmtNum(campaign.clicks)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{fmtPct(campaign.ctr)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{fmtCurrency(campaign.cpc, currSymbol)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{campaign.leads > 0 ? fmtNum(campaign.leads) : '—'}</TableCell>
                    </TableRow>

                    {/* Ad Sets drill-down */}
                    {isExpanded && campaignAdSets.map(adSet => {
                      const isAdSetExpanded = expandedAdSets.has(adSet.id);
                      const adSetAds = adsByAdSet.get(adSet.id) || [];

                      return (
                        <>
                          <TableRow
                            key={`adset-${adSet.id}`}
                            className="bg-muted/20 cursor-pointer hover:bg-muted/40"
                            onClick={(e) => { e.stopPropagation(); toggleAdSet(adSet.id); }}
                          >
                            <TableCell className="w-8 px-2" />
                            <TableCell className="text-sm max-w-[230px] truncate pl-6">
                              <div className="flex items-center gap-1.5">
                                {adSetAds.length > 0 ? (
                                  isAdSetExpanded
                                    ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                    : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                ) : <span className="w-3" />}
                                <span className="truncate">{adSet.name}</span>
                              </div>
                            </TableCell>
                            <TableCell><StatusBadge status={adSet.status} /></TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{fmtCurrency(adSet.spend, currSymbol)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{fmtNum(adSet.impressions)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{fmtNum(adSet.clicks)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{fmtPct(adSet.ctr)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{fmtCurrency(adSet.cpc, currSymbol)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{adSet.leads > 0 ? fmtNum(adSet.leads) : '—'}</TableCell>
                          </TableRow>

                          {/* Ads drill-down */}
                          {isAdSetExpanded && adSetAds.map(ad => (
                            <TableRow
                              key={`ad-${ad.id}`}
                              className="bg-muted/10"
                            >
                              <TableCell className="w-8 px-2" />
                              <TableCell className="text-sm max-w-[220px] pl-12">
                                <div className="flex items-center gap-2">
                                  {ad.creative?.thumbnail_url ? (
                                    <img
                                      src={ad.creative.thumbnail_url}
                                      alt=""
                                      className="h-8 w-8 rounded object-cover shrink-0"
                                      loading="lazy"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  ) : (
                                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                                      <ImageOff className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-sm truncate">{ad.name}</p>
                                    {ad.creative?.body && (
                                      <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                                        {ad.creative.body.slice(0, 60)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell><StatusBadge status={ad.status} /></TableCell>
                              <TableCell className="text-right text-sm tabular-nums">{fmtCurrency(ad.spend, currSymbol)}</TableCell>
                              <TableCell className="text-right text-sm tabular-nums">{fmtNum(ad.impressions)}</TableCell>
                              <TableCell className="text-right text-sm tabular-nums">{fmtNum(ad.clicks)}</TableCell>
                              <TableCell className="text-right text-sm tabular-nums">{fmtPct(ad.ctr)}</TableCell>
                              <TableCell className="text-right text-sm tabular-nums">{fmtCurrency(ad.cpc, currSymbol)}</TableCell>
                              <TableCell className="text-right text-sm tabular-nums">{ad.leads > 0 ? fmtNum(ad.leads) : '—'}</TableCell>
                            </TableRow>
                          ))}
                        </>
                      );
                    })}
                  </>
                );
              })}

              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">
                    No {showActiveOnly ? 'active ' : ''}campaigns found for this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default AdCampaignBreakdown;
