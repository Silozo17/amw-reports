import type { PlatformType } from "@/types/database";

interface SnapshotLike {
  platform: PlatformType;
  metrics_data: Record<string, number>;
}

export interface SubScore {
  label: string;
  score: number;
  change?: number;
  hasData: boolean;
}

export interface HealthScoreResult {
  overall: number;
  change?: number;
  subScores: SubScore[];
}

const PAID_PLATFORMS: PlatformType[] = ["google_ads", "meta_ads", "tiktok_ads"];
const ORGANIC_PLATFORMS: PlatformType[] = ["facebook", "instagram", "tiktok", "linkedin", "youtube", "pinterest"];
const SEO_PLATFORMS: PlatformType[] = ["google_search_console", "google_analytics", "google_business_profile"];

const BENCHMARK_WEIGHT = 0.7;
const TREND_WEIGHT = 0.3;

/** Clamp a value between 0 and 100 */
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Score a single metric based on month-over-month change */
const trendScore = (current: number, previous: number, higherIsBetter = true): number => {
  if (previous === 0 && current === 0) return 50;
  if (previous === 0) return current > 0 ? 75 : 50;
  const pctChange = ((current - previous) / previous) * 100;
  const direction = higherIsBetter ? pctChange : -pctChange;
  return clamp(60 + direction * 1.5);
};

const sumMetric = (snaps: SnapshotLike[], key: string): number =>
  snaps.reduce((sum, s) => sum + (s.metrics_data[key] || 0), 0);

const maxMetric = (snaps: SnapshotLike[], key: string): number =>
  snaps.reduce((max, s) => Math.max(max, s.metrics_data[key] || 0), 0);

// ─── Benchmark scoring functions ────────────────────────────

/** CTR benchmark: >4% excellent, >2% good, >1% fair */
const benchmarkCtr = (ctr: number): number =>
  clamp(ctr >= 4 ? 90 : ctr >= 2 ? 70 : ctr >= 1 ? 50 : 30);

/** CPC benchmark: <£1 excellent, <£2 good, <£5 fair */
const benchmarkCpc = (cpc: number): number =>
  clamp(cpc <= 1 ? 90 : cpc <= 2 ? 75 : cpc <= 5 ? 55 : 35);

/** Conversion rate benchmark (conversions / clicks * 100) */
const benchmarkConvRate = (rate: number): number =>
  clamp(rate >= 5 ? 90 : rate >= 2 ? 70 : rate >= 1 ? 50 : 30);

/** Search position benchmark: top 3 = excellent, top 10 = good */
const benchmarkPosition = (pos: number): number => {
  if (pos <= 0) return 50;
  return clamp(pos <= 3 ? 90 : pos <= 10 ? 70 : pos <= 20 ? 50 : 30);
};

// ─── Hybrid sub-scorers ─────────────────────────────────────

function scorePaid(current: SnapshotLike[], prev: SnapshotLike[]): SubScore {
  const cur = current.filter(s => PAID_PLATFORMS.includes(s.platform));
  const prv = prev.filter(s => PAID_PLATFORMS.includes(s.platform));
  if (cur.length === 0) return { label: "Paid Performance", score: 0, hasData: false };

  const benchmarks: number[] = [];
  const trends: number[] = [];

  // CTR
  const impressions = sumMetric(cur, "impressions");
  const clicks = sumMetric(cur, "clicks");
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  benchmarks.push(benchmarkCtr(ctr));
  if (prv.length > 0) {
    const prevImp = sumMetric(prv, "impressions");
    const prevClicks = sumMetric(prv, "clicks");
    const prevCtr = prevImp > 0 ? (prevClicks / prevImp) * 100 : 0;
    trends.push(trendScore(ctr, prevCtr));
  }

  // CPC
  const spend = sumMetric(cur, "spend");
  const cpc = clicks > 0 ? spend / clicks : 0;
  if (cpc > 0) {
    benchmarks.push(benchmarkCpc(cpc));
    if (prv.length > 0) {
      const prevCpc = sumMetric(prv, "clicks") > 0
        ? sumMetric(prv, "spend") / sumMetric(prv, "clicks") : 0;
      if (prevCpc > 0) trends.push(trendScore(cpc, prevCpc, false));
    }
  }

  // Conversion rate
  const conversions = sumMetric(cur, "conversions");
  if (conversions > 0 && clicks > 0) {
    const convRate = (conversions / clicks) * 100;
    benchmarks.push(benchmarkConvRate(convRate));
    if (prv.length > 0) {
      const prevConv = sumMetric(prv, "conversions");
      const prevClk = sumMetric(prv, "clicks");
      if (prevClk > 0) trends.push(trendScore(convRate, (prevConv / prevClk) * 100));
    }
  }

  // Reach trend only (no universal benchmark)
  const curReach = sumMetric(cur, "reach");
  const prevReach = sumMetric(prv, "reach");
  if ((curReach > 0 || prevReach > 0) && prv.length > 0) {
    trends.push(trendScore(curReach, prevReach));
  }

  const benchmarkAvg = benchmarks.length > 0
    ? benchmarks.reduce((a, b) => a + b, 0) / benchmarks.length : 50;
  const trendAvg = trends.length > 0
    ? trends.reduce((a, b) => a + b, 0) / trends.length : 50;

  const score = Math.round(benchmarkAvg * BENCHMARK_WEIGHT + trendAvg * TREND_WEIGHT);

  return { label: "Paid Performance", score, hasData: true };
}

function scoreOrganic(current: SnapshotLike[], prev: SnapshotLike[]): SubScore {
  const cur = current.filter(s => ORGANIC_PLATFORMS.includes(s.platform));
  const prv = prev.filter(s => ORGANIC_PLATFORMS.includes(s.platform));
  if (cur.length === 0) return { label: "Social Engagement", score: 0, hasData: false };

  const benchmarks: number[] = [];
  const trends: number[] = [];

  // Engagement rate benchmark (engagement / reach or impressions)
  const curEng = sumMetric(cur, "engagement") + sumMetric(cur, "likes") + sumMetric(cur, "comments") + sumMetric(cur, "shares");
  const curReach = sumMetric(cur, "reach") + sumMetric(cur, "views");
  const engRate = curReach > 0 ? (curEng / curReach) * 100 : 0;
  // Engagement rate: >5% excellent, >2% good, >1% fair
  benchmarks.push(clamp(engRate >= 5 ? 90 : engRate >= 2 ? 70 : engRate >= 1 ? 50 : 35));

  // Engagement trend
  if (prv.length > 0) {
    const prevEng = sumMetric(prv, "engagement") + sumMetric(prv, "likes") + sumMetric(prv, "comments") + sumMetric(prv, "shares");
    trends.push(trendScore(curEng, prevEng));
  }

  // Follower growth rate benchmark
  const curFollowers = sumMetric(cur, "total_followers");
  if (curFollowers > 0 && prv.length > 0) {
    const prevFollowers = sumMetric(prv, "total_followers");
    if (prevFollowers > 0) {
      const growthRate = ((curFollowers - prevFollowers) / prevFollowers) * 100;
      // Growth rate: >5% excellent, >2% good, >0% fair
      benchmarks.push(clamp(growthRate >= 5 ? 90 : growthRate >= 2 ? 75 : growthRate >= 0 ? 55 : 35));
      trends.push(trendScore(curFollowers, prevFollowers));
    }
  }

  // Reach trend
  if (prv.length > 0) {
    const prevReach = sumMetric(prv, "reach") + sumMetric(prv, "views");
    if (curReach > 0 || prevReach > 0) trends.push(trendScore(curReach, prevReach));
  }

  const benchmarkAvg = benchmarks.length > 0
    ? benchmarks.reduce((a, b) => a + b, 0) / benchmarks.length : 50;
  const trendAvg = trends.length > 0
    ? trends.reduce((a, b) => a + b, 0) / trends.length : 50;

  const score = Math.round(benchmarkAvg * BENCHMARK_WEIGHT + trendAvg * TREND_WEIGHT);

  return { label: "Social Engagement", score, hasData: true };
}

function scoreSeo(current: SnapshotLike[], prev: SnapshotLike[]): SubScore {
  const cur = current.filter(s => SEO_PLATFORMS.includes(s.platform));
  const prv = prev.filter(s => SEO_PLATFORMS.includes(s.platform));
  if (cur.length === 0) return { label: "SEO & Web", score: 0, hasData: false };

  const benchmarks: number[] = [];
  const trends: number[] = [];

  // Search CTR benchmark
  const curImp = sumMetric(cur, "search_impressions") + sumMetric(cur, "gbp_searches");
  const curClicks = sumMetric(cur, "search_clicks") + sumMetric(cur, "sessions");
  const searchCtr = curImp > 0 ? (curClicks / curImp) * 100 : 0;
  if (curImp > 0) benchmarks.push(benchmarkCtr(searchCtr));

  // Avg position benchmark (lower is better)
  const curPos = maxMetric(cur, "search_position");
  if (curPos > 0) benchmarks.push(benchmarkPosition(curPos));

  // Search impressions trend
  if (prv.length > 0) {
    const prevImp = sumMetric(prv, "search_impressions") + sumMetric(prv, "gbp_searches");
    if (curImp > 0 || prevImp > 0) trends.push(trendScore(curImp, prevImp));
  }

  // Search clicks trend
  if (prv.length > 0) {
    const prevClicks = sumMetric(prv, "search_clicks") + sumMetric(prv, "sessions");
    if (curClicks > 0 || prevClicks > 0) trends.push(trendScore(curClicks, prevClicks));
  }

  // Position trend (lower is better)
  if (prv.length > 0) {
    const prevPos = maxMetric(prv, "search_position");
    if (curPos > 0 || prevPos > 0) trends.push(trendScore(curPos, prevPos, false));
  }

  const benchmarkAvg = benchmarks.length > 0
    ? benchmarks.reduce((a, b) => a + b, 0) / benchmarks.length : 50;
  const trendAvg = trends.length > 0
    ? trends.reduce((a, b) => a + b, 0) / trends.length : 50;

  if (benchmarks.length === 0 && trends.length === 0) {
    return { label: "SEO & Web", score: 0, hasData: false };
  }

  const score = Math.round(benchmarkAvg * BENCHMARK_WEIGHT + trendAvg * TREND_WEIGHT);

  return { label: "SEO & Web", score, hasData: true };
}

// ─── Main computation ───────────────────────────────────────

export function computeHealthScore(
  current: SnapshotLike[],
  previous: SnapshotLike[],
  prePrevious?: SnapshotLike[],
): HealthScoreResult {
  const paid = scorePaid(current, previous);
  const organic = scoreOrganic(current, previous);
  const seo = scoreSeo(current, previous);

  const activeScores = [paid, organic, seo].filter(s => s.hasData);
  const overall = activeScores.length > 0
    ? Math.round(activeScores.reduce((sum, s) => sum + s.score, 0) / activeScores.length)
    : 0;

  // Compute accurate change by scoring previous month against its own predecessor
  let change: number | undefined;
  if (previous.length > 0 && prePrevious !== undefined) {
    const prevResult = computeHealthScore(previous, prePrevious);
    const prevActive = prevResult.subScores.filter(s => s.hasData);
    if (prevActive.length > 0) {
      change = overall - prevResult.overall;

      // Also set per-category change
      for (const sub of [paid, organic, seo]) {
        if (!sub.hasData) continue;
        const prevSub = prevResult.subScores.find(ps => ps.label === sub.label);
        if (prevSub?.hasData) sub.change = sub.score - prevSub.score;
      }
    }
  }

  return {
    overall,
    change,
    subScores: [paid, organic, seo],
  };
}

export function getScoreColor(score: number): string {
  if (score >= 75) return "hsl(var(--amw-green))";
  if (score >= 50) return "hsl(var(--amw-orange))";
  return "hsl(var(--destructive))";
}

export function getScoreLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 50) return "Needs Attention";
  return "Critical";
}
