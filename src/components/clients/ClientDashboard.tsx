import { useMemo, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles, BarChart3, PieChartIcon, AlertCircle, Clock, Loader2,
  DollarSign, Share2, Search, MessageCircle,
} from "lucide-react";
import { PLATFORM_LABELS, PLATFORM_CATEGORIES } from "@/types/database";
import type { PlatformType } from "@/types/database";
import DashboardHeader from "./DashboardHeader";
import HeroKPIs from "./dashboard/HeroKPIs";
import HealthScore from "./dashboard/HealthScore";
import OpportunityAlerts from "./dashboard/OpportunityAlerts";
import PlatformSection from "./dashboard/PlatformSection";
import PerformanceOverview from "./dashboard/PerformanceOverview";
import AiChatDrawer from "./dashboard/AiChatDrawer";
import VoiceBriefing from "./dashboard/VoiceBriefing";
import { useClientDashboard } from "@/hooks/useClientDashboard";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Paid Advertising': DollarSign,
  'Organic Social': Share2,
  'SEO & Web Analytics': Search,
};

// ─── Dashboard Skeleton ────────────────────────────────────────
const DashboardSkeleton = () => (
  <div className="space-y-8">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5"><Skeleton className="h-[220px] w-full rounded" /></CardContent>
        </Card>
      ))}
    </div>
    {Array.from({ length: 2 }).map((_, i) => (
      <Card key={i}>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-16 rounded" />)}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

/** Parse structured AI analysis JSON or fall back to markdown sections */
const parseAnalysis = (analysis: string): {
  keyTakeaway: string;
  sections: { heading: string; highlights: string[]; recommendation: string }[];
  raw: string;
} => {
  // Try JSON parse first (new structured format)
  try {
    const parsed = JSON.parse(analysis);
    if (parsed.key_takeaway && Array.isArray(parsed.sections)) {
      return {
        keyTakeaway: parsed.key_takeaway,
        sections: parsed.sections.map((s: any) => ({
          heading: s.heading || "",
          highlights: Array.isArray(s.highlights) ? s.highlights : [],
          recommendation: s.recommendation || "",
        })),
        raw: analysis,
      };
    }
  } catch {
    // Not JSON, fall back to markdown parsing
  }

  // Fallback: parse markdown ## sections
  const sections: { heading: string; highlights: string[]; recommendation: string }[] = [];
  let keyTakeaway = "";
  const parts = analysis.split(/^## /m);

  for (const part of parts) {
    if (!part.trim()) continue;
    const newlineIdx = part.indexOf('\n');
    if (newlineIdx === -1) continue;
    const heading = part.slice(0, newlineIdx).trim();
    const body = part.slice(newlineIdx + 1).trim();

    if (heading.toLowerCase().includes("overall") || heading.toLowerCase().includes("summary")) {
      keyTakeaway = body.split('\n')[0] || body;
      sections.push({
        heading: "Overall Summary",
        highlights: body.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•')).map(l => l.replace(/^[-•]\s*/, '').trim()).slice(0, 4),
        recommendation: "",
      });
    } else if (body) {
      const lines = body.split('\n').filter(l => l.trim());
      sections.push({
        heading,
        highlights: lines.filter(l => l.trim().startsWith('-') || l.trim().startsWith('•')).map(l => l.replace(/^[-•]\s*/, '').trim()).slice(0, 4),
        recommendation: lines.find(l => l.toLowerCase().includes('recommend')) || "",
      });
    }
  }

  if (!keyTakeaway && analysis) {
    keyTakeaway = analysis.split('\n').find(l => l.trim()) || analysis.slice(0, 200);
  }

  return { keyTakeaway, sections, raw: analysis };
};

interface ClientDashboardProps {
  clientId: string;
  clientName: string;
  currencyCode?: string;
  portalToken?: string;
  initialMonth?: number;
  initialYear?: number;
  showHealthScore?: boolean;
}

const ClientDashboard = ({ clientId, clientName, currencyCode = "GBP", portalToken, initialMonth, initialYear, showHealthScore = true }: ClientDashboardProps) => {
  const dashboard = useClientDashboard({ clientId, currencyCode, portalToken, initialMonth, initialYear });
  const [chatOpen, setChatOpen] = useState(false);

  const {
    selectedPlatform, setSelectedPlatform,
    selectedPeriod, setSelectedPeriod,
    isLoading, isPortal, currSymbol,
    availablePlatforms, connections, platformConfigs,
    snapshots, filtered, filteredPrev, trendData,
    kpis, sparklineMap,
    spendByPlatform, totalSpend,
    engagementStackedData, impressionsByPlatform,
    trendChartData, platformTrendMap, gscTrendData,
    allPosts, lastSyncedAt,
    hasData, hasFilteredData, allZeros,
    aiAnalysis, aiAnalysisDate, analysisDialogOpen, setAnalysisDialogOpen,
    isAnalysing, cooldownRemaining, handleAnalyse,
    matchesPlatformFilter,
    prevSnapshots,
  } = dashboard;

  const trendPlatforms = useMemo(() =>
    [...new Set((selectedPlatform === "all" ? trendData : trendData.filter(s => matchesPlatformFilter(selectedPlatform, s.platform))).map(s => s.platform))] as PlatformType[],
    [trendData, selectedPlatform, matchesPlatformFilter]
  );

  const analysisData = useMemo(() => parseAnalysis(aiAnalysis), [aiAnalysis]);

  // Build a map of category heading -> analysis section for inline rendering
  const categorySections = useMemo(() => {
    const map = new Map<string, { highlights: string[]; recommendation: string }>();
    for (const section of analysisData.sections) {
      for (const cat of PLATFORM_CATEGORIES) {
        if (section.heading.toLowerCase().includes(cat.label.toLowerCase()) ||
            cat.label.toLowerCase().includes(section.heading.toLowerCase())) {
          map.set(cat.label, { highlights: section.highlights, recommendation: section.recommendation });
        }
      }
    }
    return map;
  }, [analysisData]);

  return (
    <div className="space-y-8">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DashboardHeader
          selectedPlatform={selectedPlatform}
          onPlatformChange={setSelectedPlatform}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          availablePlatforms={availablePlatforms}
        />
        <div className="flex items-center gap-2 flex-wrap">
          {!isPortal && lastSyncedAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Synced {formatDistanceToNow(lastSyncedAt, { addSuffix: true })}</span>
            </div>
          )}
          <VoiceBriefing
            clientId={clientId}
            month={selectedPeriod.month}
            year={selectedPeriod.year}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setChatOpen(true)}
            className="gap-2"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Ask AI
          </Button>
          <Button
            size="sm"
            variant={aiAnalysis ? "outline" : "default"}
            onClick={handleAnalyse}
            disabled={isAnalysing || cooldownRemaining > 0}
            className="gap-2"
          >
            {isAnalysing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {isAnalysing ? "Analysing..." : cooldownRemaining > 0 ? `Wait ${cooldownRemaining}s` : aiAnalysis ? "Refresh Analysis" : "AI Analysis"}
          </Button>
        </div>
      </div>

      {/* AI Analysis Card — key takeaway */}
      {aiAnalysis && aiAnalysisDate && analysisData.keyTakeaway && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold font-body">AI Analysis</CardTitle>
              <span className="text-[10px] text-muted-foreground">{format(aiAnalysisDate, "dd MMM yyyy, HH:mm")}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setAnalysisDialogOpen(true)}>View Full Analysis</Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {analysisData.keyTakeaway}
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis Dialog — structured cards with tabs */}
      <Dialog open={analysisDialogOpen} onOpenChange={setAnalysisDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Performance Analysis
            </DialogTitle>
          </DialogHeader>

          {analysisData.sections.length > 1 ? (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                {analysisData.sections.filter(s => !s.heading.toLowerCase().includes("overall") && !s.heading.toLowerCase().includes("summary")).map(s => (
                  <TabsTrigger key={s.heading} value={s.heading}>{s.heading}</TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="space-y-3 mt-4">
                <p className="text-sm text-foreground leading-relaxed">
                  {analysisData.keyTakeaway}
                </p>
                {analysisData.sections.find(s => s.heading.toLowerCase().includes("overall") || s.heading.toLowerCase().includes("summary"))?.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{h}</span>
                  </div>
                ))}
              </TabsContent>

              {analysisData.sections.filter(s => !s.heading.toLowerCase().includes("overall") && !s.heading.toLowerCase().includes("summary")).map(section => (
                <TabsContent key={section.heading} value={section.heading} className="space-y-3 mt-4">
                  {section.highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{h}</span>
                    </div>
                  ))}
                  {section.recommendation && (
                    <Card className="border-accent/20 bg-accent/5">
                      <CardContent className="p-3">
                        <p className="text-sm text-foreground">
                          <span className="font-semibold text-accent">💡 Recommendation: </span>
                          {section.recommendation}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="prose prose-sm max-w-none text-foreground [&_strong]:font-bold [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4">
              <p className="text-sm leading-relaxed">{analysisData.keyTakeaway}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Chat Drawer */}
      <AiChatDrawer
        open={chatOpen}
        onOpenChange={setChatOpen}
        clientId={clientId}
        clientName={clientName}
        month={selectedPeriod.month}
        year={selectedPeriod.year}
        portalToken={portalToken}
      />

      {/* Main Content */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : !hasData ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">No performance data available</p>
            <p className="text-sm text-muted-foreground/70">
              {isPortal ? "No data available for this period." : "Sync platform data for this period to see your dashboard."}
            </p>
          </CardContent>
        </Card>
      ) : !hasFilteredData ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <PieChartIcon className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">No data for this platform</p>
            <p className="text-sm text-muted-foreground/70">Try selecting "All Platforms" or a different period.</p>
          </CardContent>
        </Card>
      ) : allZeros ? (
        <Card className="border-dashed border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-12 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-amber-500" />
            <p className="text-muted-foreground font-medium">No activity recorded for this period</p>
            <p className="text-sm text-muted-foreground/70">Try selecting a different period.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Health Score */}
          {showHealthScore && <HealthScore current={filtered} previous={filteredPrev} />}

          {/* Opportunity Alerts */}
          <OpportunityAlerts current={filtered} previous={filteredPrev} currSymbol={currSymbol} selectedPeriod={selectedPeriod} />

          <HeroKPIs kpis={kpis} currSymbol={currSymbol} sparklineMap={sparklineMap} />
          <PerformanceOverview
            spendByPlatform={spendByPlatform}
            totalSpend={totalSpend}
            currSymbol={currSymbol}
            engagementStackedData={engagementStackedData as unknown as Array<Record<string, unknown>>}
            impressionsByPlatform={impressionsByPlatform as unknown as Array<Record<string, unknown>>}
            trendChartData={trendChartData as unknown as Array<Record<string, unknown>>}
            trendPlatforms={trendPlatforms}
            gscTrendData={(selectedPlatform === "all" || matchesPlatformFilter(selectedPlatform, "google_search_console")) ? gscTrendData as unknown as Array<Record<string, unknown>> : []}
          />

          {/* Platform Breakdown — grouped by category */}
          <div className="space-y-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-body">Platform Breakdown</h2>
            {PLATFORM_CATEGORIES.map(({ label, platforms }) => {
              const categorySnapshots = filtered.filter(s => platforms.includes(s.platform));
              if (categorySnapshots.length === 0) return null;

              const CategoryIcon = CATEGORY_ICONS[label] || BarChart3;
              const categoryAi = categorySections.get(label);

              return (
                <div key={label} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CategoryIcon className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold font-body text-foreground">{label}</h3>
                  </div>

                  {/* Per-category AI insight card — bullet points */}
                  {categoryAi && categoryAi.highlights.length > 0 && (
                    <Card className="border-primary/10 bg-primary/[0.03]">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2">
                          <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          <div className="space-y-1.5">
                            {categoryAi.highlights.map((h, i) => (
                              <p key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                                <span className="text-primary shrink-0">•</span>
                                <span>{h}</span>
                              </p>
                            ))}
                            {categoryAi.recommendation && (
                              <p className="text-sm text-foreground font-medium mt-2">
                                💡 {categoryAi.recommendation}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {categorySnapshots.map(snapshot => {
                    const prevSnapshot = filteredPrev.find(s => s.platform === snapshot.platform);
                    const connection = isPortal ? undefined : connections.find(c => c.platform === snapshot.platform);
                    const config = platformConfigs.get(snapshot.platform);
                    const platformPosts = allPosts.filter(p => p.platform === snapshot.platform);
                    const platformTrend = platformTrendMap.get(snapshot.platform);
                    return (
                      <PlatformSection
                        key={snapshot.platform}
                        platform={snapshot.platform}
                        metricsData={snapshot.metrics_data}
                        prevMetricsData={prevSnapshot?.metrics_data}
                        connection={connection}
                        topContent={platformPosts}
                        trendData={platformTrend}
                        currSymbol={currSymbol}
                        enabledMetrics={config?.enabled_metrics}
                        reportMonth={selectedPeriod.month}
                        reportYear={selectedPeriod.year}
                        rawData={snapshot.raw_data}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;
