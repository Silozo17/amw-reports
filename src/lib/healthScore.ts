import type { PlatformType } from "@/types/database";

interface SnapshotLike {
  platform: PlatformType;
  metrics_data: Record<string, number>;
}

export interface SubScore {
  label: string;
  score: number;
  change?: number; // vs last month
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

/** Clamp a value between 0 and 100 */
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Score a single metric based on month-over-month change */
const trendScore = (current: number, previous: number, higherIsBetter = true): number => {
  if (previous === 0 && current === 0) return 50;
  if (previous === 0) return current > 0 ? 75 : 50;
  const pctChange = ((current - previous) / previous) * 100;
  const direction = higherIsBetter ? pctChange : -pctChange;
  // +20% or more = 90, 0% = 60, -20% or worse = 30
  return clamp(60 + direction * 1.5);
};

const sumMetric = (snaps: SnapshotLike[], key: string): number =>
  snaps.reduce((sum, s) => sum + (s.metrics_data[key] || 0), 0);

const maxMetric = (snaps: SnapshotLike[], key: string): number =>
  snaps.reduce((max, s) => Math.max(max, s.metrics_data[key] || 0), 0);

function scorePaid(current: SnapshotLike[], prev: SnapshotLike[]): SubScore {
  const cur = current.filter(s => PAID_PLATFORMS.includes(s.platform));
  const prv = prev.filter(s => PAID_PLATFORMS.includes(s.platform));
  if (cur.length === 0) return { label: "Paid Performance", score: 0, hasData: false };

  const scores: number[] = [];

  // CTR score — >2% is good, >4% excellent
  const ctr = sumMetric(cur, "clicks") / Math.max(sumMetric(cur, "impressions"), 1) * 100;
  scores.push(clamp(ctr >= 4 ? 90 : ctr >= 2 ? 70 : ctr >= 1 ? 50 : 30));

  // CPC trend (lower is better)
  const curCpc = sumMetric(cur, "spend") / Math.max(sumMetric(cur, "clicks"), 1);
  const prevCpc = sumMetric(prv, "spend") / Math.max(sumMetric(prv, "clicks"), 1);
  if (prevCpc > 0) scores.push(trendScore(curCpc, prevCpc, false));

  // Conversions trend
  const curConv = sumMetric(cur, "conversions");
  const prevConv = sumMetric(prv, "conversions");
  if (curConv > 0 || prevConv > 0) scores.push(trendScore(curConv, prevConv));

  // Reach trend
  const curReach = sumMetric(cur, "reach");
  const prevReach = sumMetric(prv, "reach");
  if (curReach > 0 || prevReach > 0) scores.push(trendScore(curReach, prevReach));

  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  // Compute change vs prev
  const prevScore = prv.length > 0 ? computeCategoryScore(prv, prev, PAID_PLATFORMS, scorePaidRaw) : undefined;

  return { label: "Paid Performance", score, change: prevScore !== undefined ? score - prevScore : undefined, hasData: true };
}

function scorePaidRaw(cur: SnapshotLike[], _prv: SnapshotLike[]): number {
  const scores: number[] = [];
  const ctr = sumMetric(cur, "clicks") / Math.max(sumMetric(cur, "impressions"), 1) * 100;
  scores.push(clamp(ctr >= 4 ? 90 : ctr >= 2 ? 70 : ctr >= 1 ? 50 : 30));
  if (scores.length === 0) return 50;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function scoreOrganic(current: SnapshotLike[], prev: SnapshotLike[]): SubScore {
  const cur = current.filter(s => ORGANIC_PLATFORMS.includes(s.platform));
  const prv = prev.filter(s => ORGANIC_PLATFORMS.includes(s.platform));
  if (cur.length === 0) return { label: "Social Engagement", score: 0, hasData: false };

  const scores: number[] = [];

  // Engagement trend
  const curEng = sumMetric(cur, "engagement") + sumMetric(cur, "likes") + sumMetric(cur, "comments") + sumMetric(cur, "shares");
  const prevEng = sumMetric(prv, "engagement") + sumMetric(prv, "likes") + sumMetric(prv, "comments") + sumMetric(prv, "shares");
  scores.push(trendScore(curEng, prevEng));

  // Follower growth
  const curFollowers = sumMetric(cur, "total_followers");
  const prevFollowers = sumMetric(prv, "total_followers");
  if (curFollowers > 0 || prevFollowers > 0) scores.push(trendScore(curFollowers, prevFollowers));

  // Reach trend
  const curReach = sumMetric(cur, "reach") + sumMetric(cur, "views");
  const prevReach = sumMetric(prv, "reach") + sumMetric(prv, "views");
  if (curReach > 0 || prevReach > 0) scores.push(trendScore(curReach, prevReach));

  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return { label: "Social Engagement", score, hasData: true };
}

function scoreSeo(current: SnapshotLike[], prev: SnapshotLike[]): SubScore {
  const cur = current.filter(s => SEO_PLATFORMS.includes(s.platform));
  const prv = prev.filter(s => SEO_PLATFORMS.includes(s.platform));
  if (cur.length === 0) return { label: "SEO & Web", score: 0, hasData: false };

  const scores: number[] = [];

  // Search impressions trend
  const curImp = sumMetric(cur, "search_impressions") + sumMetric(cur, "gbp_searches");
  const prevImp = sumMetric(prv, "search_impressions") + sumMetric(prv, "gbp_searches");
  if (curImp > 0 || prevImp > 0) scores.push(trendScore(curImp, prevImp));

  // Search clicks trend
  const curClicks = sumMetric(cur, "search_clicks") + sumMetric(cur, "sessions");
  const prevClicks = sumMetric(prv, "search_clicks") + sumMetric(prv, "sessions");
  if (curClicks > 0 || prevClicks > 0) scores.push(trendScore(curClicks, prevClicks));

  // Avg position (lower is better)
  const curPos = maxMetric(cur, "search_position");
  const prevPos = maxMetric(prv, "search_position");
  if (curPos > 0 || prevPos > 0) scores.push(trendScore(curPos, prevPos, false));

  if (scores.length === 0) scores.push(50);
  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return { label: "SEO & Web", score, hasData: true };
}

function computeCategoryScore(
  cur: SnapshotLike[],
  _prev: SnapshotLike[],
  platforms: PlatformType[],
  scoreFn: (c: SnapshotLike[], p: SnapshotLike[]) => number,
): number {
  const filtered = cur.filter(s => platforms.includes(s.platform));
  return scoreFn(filtered, []);
}

export function computeHealthScore(
  current: SnapshotLike[],
  previous: SnapshotLike[],
): HealthScoreResult {
  const paid = scorePaid(current, previous);
  const organic = scoreOrganic(current, previous);
  const seo = scoreSeo(current, previous);

  const activeScores = [paid, organic, seo].filter(s => s.hasData);
  const overall = activeScores.length > 0
    ? Math.round(activeScores.reduce((sum, s) => sum + s.score, 0) / activeScores.length)
    : 0;

  return {
    overall,
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
