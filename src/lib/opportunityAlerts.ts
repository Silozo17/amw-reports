import type { PlatformType } from "@/types/database";
import { PLATFORM_LABELS } from "@/types/database";

interface SnapshotLike {
  platform: PlatformType;
  metrics_data: Record<string, number>;
}

export type AlertType = "opportunity" | "warning" | "win";

export interface OpportunityAlert {
  id: string;
  type: AlertType;
  title: string;
  description: string;
  platform: PlatformType;
}

const pctChange = (curr: number, prev: number): number => {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
};

const fmt = (v: number): string => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return Math.round(v).toLocaleString();
};

export function computeOpportunityAlerts(
  current: SnapshotLike[],
  previous: SnapshotLike[],
  currSymbol: string,
  partialMonthRatio: number = 1,
): OpportunityAlert[] {
  const alerts: OpportunityAlert[] = [];

  for (const snap of current) {
    const prev = previous.find(p => p.platform === snap.platform);
    if (!prev) continue;
    const label = PLATFORM_LABELS[snap.platform] || snap.platform;
    const m = snap.metrics_data;
    const pm = prev.metrics_data;

    // CPC Drop (opportunity)
    if (m.cpc && pm.cpc && m.cpc < pm.cpc) {
      const drop = Math.abs(pctChange(m.cpc, pm.cpc));
      if (drop >= 10) {
        alerts.push({
          id: `cpc-drop-${snap.platform}`,
          type: "opportunity",
          title: `CPC dropped ${Math.round(drop)}%`,
          description: `${label} cost per click fell to ${currSymbol}${m.cpc.toFixed(2)} — good time to increase budget and capture more traffic.`,
          platform: snap.platform,
        });
      }
    }

    // Engagement Spike (win)
    const curEng = (m.engagement || 0) + (m.likes || 0) + (m.comments || 0) + (m.shares || 0);
    const prevEng = (pm.engagement || 0) + (pm.likes || 0) + (pm.comments || 0) + (pm.shares || 0);
    if (curEng > 0 && prevEng > 0) {
      const engChange = pctChange(curEng, prevEng);
      if (engChange >= 25) {
        alerts.push({
          id: `eng-spike-${snap.platform}`,
          type: "win",
          title: `Engagement up ${Math.round(engChange)}%`,
          description: `${label} engagement jumped to ${fmt(curEng)} — your content is resonating with your audience.`,
          platform: snap.platform,
        });
      }
    }

    // Reach Decline (warning)
    const curReach = m.reach || m.views || 0;
    const prevReach = pm.reach || pm.views || 0;
    if (curReach > 0 && prevReach > 0) {
      const reachChange = pctChange(curReach, prevReach);
      if (reachChange <= -20) {
        alerts.push({
          id: `reach-drop-${snap.platform}`,
          type: "warning",
          title: `Reach down ${Math.abs(Math.round(reachChange))}%`,
          description: `${label} reach dropped to ${fmt(curReach)} — consider boosting your top-performing post.`,
          platform: snap.platform,
        });
      }
    }

    // CTR below threshold (warning)
    const rawCtr = m.ctr || (m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0);
    const ctr = rawCtr <= 1 ? rawCtr * 100 : rawCtr;
    if (m.spend > 0 && ctr > 0 && ctr < 2) {
      alerts.push({
        id: `ctr-low-${snap.platform}`,
        type: "warning",
        title: "CTR below 2%",
        description: `${label} click-through rate is ${ctr.toFixed(1)}% — ad copy or targeting may need a refresh.`,
        platform: snap.platform,
      });
    }

    // Conversion improvement (win)
    if (m.cost_per_lead && pm.cost_per_lead && m.cost_per_lead < pm.cost_per_lead) {
      const improvement = Math.abs(pctChange(m.cost_per_lead, pm.cost_per_lead));
      if (improvement >= 10) {
        alerts.push({
          id: `cpl-drop-${snap.platform}`,
          type: "win",
          title: `Cost per lead dropped ${Math.round(improvement)}%`,
          description: `${label} CPL fell to ${currSymbol}${m.cost_per_lead.toFixed(2)} — great efficiency improvement.`,
          platform: snap.platform,
        });
      }
    }

    // Follower growth (win)
    const curFollowers = m.total_followers || 0;
    const prevFollowers = pm.total_followers || 0;
    if (curFollowers > 0 && prevFollowers > 0) {
      const growth = pctChange(curFollowers, prevFollowers);
      if (growth >= 5) {
        alerts.push({
          id: `follower-growth-${snap.platform}`,
          type: "win",
          title: `Followers up ${Math.round(growth)}%`,
          description: `${label} audience grew to ${fmt(curFollowers)} — momentum is building.`,
          platform: snap.platform,
        });
      }
    }
  }

  // Sort: wins first, then opportunities, then warnings. Max 4.
  const typeOrder: Record<AlertType, number> = { win: 0, opportunity: 1, warning: 2 };
  alerts.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
  return alerts.slice(0, 4);
}
