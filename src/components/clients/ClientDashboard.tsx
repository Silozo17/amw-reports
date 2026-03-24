import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Info } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import PlatformMetricsCard from './PlatformMetricsCard';
import { PLATFORM_LABELS } from '@/types/database';
import type { PlatformType } from '@/types/database';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const PIE_COLORS = [
  'hsl(295, 61%, 47%)', // primary purple
  'hsl(210, 53%, 59%)', // secondary blue
  'hsl(148, 58%, 57%)', // accent green
  'hsl(27, 83%, 57%)',  // warning orange
  'hsl(348, 8%, 40%)',  // muted
  'hsl(0, 84%, 60%)',   // destructive
];

interface ClientDashboardProps {
  clientId: string;
  clientName: string;
}

interface SnapshotData {
  platform: PlatformType;
  metrics_data: Record<string, number>;
  report_month: number;
  report_year: number;
}

const ClientDashboard = ({ clientId, clientName }: ClientDashboardProps) => {
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [prevSnapshots, setPrevSnapshots] = useState<SnapshotData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);

  // Current report period (previous month)
  const now = new Date();
  const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const fetchSnapshots = useCallback(async () => {
    const prevMonth = reportMonth === 1 ? 12 : reportMonth - 1;
    const prevYear = reportMonth === 1 ? reportYear - 1 : reportYear;

    const [currentRes, prevRes] = await Promise.all([
      supabase.from('monthly_snapshots').select('platform, metrics_data, report_month, report_year')
        .eq('client_id', clientId).eq('report_month', reportMonth).eq('report_year', reportYear),
      supabase.from('monthly_snapshots').select('platform, metrics_data, report_month, report_year')
        .eq('client_id', clientId).eq('report_month', prevMonth).eq('report_year', prevYear),
    ]);

    setSnapshots((currentRes.data ?? []) as SnapshotData[]);
    setPrevSnapshots((prevRes.data ?? []) as SnapshotData[]);
    setIsLoading(false);
  }, [clientId, reportMonth, reportYear]);

  useEffect(() => { fetchSnapshots(); }, [fetchSnapshots]);

  const handleAnalyse = async () => {
    setIsAnalysing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-client', {
        body: { client_id: clientId, month: reportMonth, year: reportYear },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error.includes('Rate limit')) toast.error(data.error);
        else toast.error(data.error);
        return;
      }
      setAiAnalysis(data.analysis || 'No analysis available.');
    } catch (e) {
      console.error('Analysis error:', e);
      toast.error('Failed to generate AI analysis');
    } finally {
      setIsAnalysing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No performance data available yet. Sync platform data to see your dashboard.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Build chart data
  const spendByPlatform = snapshots
    .filter(s => s.metrics_data.spend && s.metrics_data.spend > 0)
    .map(s => ({
      name: PLATFORM_LABELS[s.platform] || s.platform,
      value: s.metrics_data.spend,
    }));

  const engagementByPlatform = snapshots
    .filter(s => {
      const eng = (s.metrics_data.engagement || 0) + (s.metrics_data.likes || 0) + (s.metrics_data.comments || 0) + (s.metrics_data.shares || 0);
      return eng > 0;
    })
    .map(s => ({
      name: PLATFORM_LABELS[s.platform] || s.platform,
      value: (s.metrics_data.engagement || 0) + (s.metrics_data.likes || 0) + (s.metrics_data.comments || 0) + (s.metrics_data.shares || 0),
    }));

  const impressionsByPlatform = snapshots
    .filter(s => s.metrics_data.impressions && s.metrics_data.impressions > 0)
    .map(s => ({
      name: PLATFORM_LABELS[s.platform] || s.platform,
      impressions: s.metrics_data.impressions,
      clicks: s.metrics_data.clicks || 0,
    }));

  const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="space-y-6">
      {/* Period Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display">{MONTH_NAMES[reportMonth]} {reportYear}</h2>
          <p className="text-sm text-muted-foreground">Performance data across {snapshots.length} platform{snapshots.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Charts Row */}
      {(spendByPlatform.length > 0 || engagementByPlatform.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {spendByPlatform.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  Spend Distribution
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent><p className="text-xs">How your ad budget is split across platforms</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={spendByPlatform} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                      {spendByPlatform.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {engagementByPlatform.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  Engagement Breakdown
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent><p className="text-xs">Total interactions (likes, comments, shares) per platform</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={engagementByPlatform} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                      {engagementByPlatform.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => value.toLocaleString()} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Impressions & Clicks Bar Chart */}
      {impressionsByPlatform.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              Impressions & Clicks by Platform
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground/60" /></TooltipTrigger>
                  <TooltipContent><p className="text-xs">How many times your content was shown vs clicked</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={impressionsByPlatform}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip />
                <Bar dataKey="impressions" name="Impressions" fill={PIE_COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="clicks" name="Clicks" fill={PIE_COLORS[1]} radius={[4, 4, 0, 0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-Platform Metrics */}
      <div className="space-y-4">
        <h3 className="text-lg font-display">Platform Details</h3>
        {snapshots.map(snapshot => {
          const prevSnapshot = prevSnapshots.find(s => s.platform === snapshot.platform);
          return (
            <PlatformMetricsCard
              key={snapshot.platform}
              platform={snapshot.platform}
              metrics={snapshot.metrics_data}
              prevMetrics={prevSnapshot?.metrics_data}
            />
          );
        })}
      </div>

      {/* AI Analysis */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Performance Analysis
          </CardTitle>
          <Button
            size="sm"
            variant={aiAnalysis ? 'outline' : 'default'}
            onClick={handleAnalyse}
            disabled={isAnalysing}
            className="gap-2"
          >
            {isAnalysing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {aiAnalysis ? 'Refresh Analysis' : 'Generate Analysis'}
          </Button>
        </CardHeader>
        <CardContent>
          {aiAnalysis ? (
            <div className="prose prose-sm max-w-none text-foreground">
              {aiAnalysis.split('\n').filter(Boolean).map((para, i) => (
                <p key={i} className="text-sm leading-relaxed mb-3">{para}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Click "Generate Analysis" to get an AI-powered summary of this client&apos;s performance.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientDashboard;
