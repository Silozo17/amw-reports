import { COST_METRICS, PERCENT_METRICS, DECIMAL_METRICS } from './constants';

const WHOLE_NUMBER_METRICS = new Set(['total_followers', 'follower_growth', 'follower_removes', 'subscribers']);

export const formatMetricValue = (key: string, value: number, currSymbol: string): string => {
  if (COST_METRICS.has(key)) return `${currSymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (PERCENT_METRICS.has(key)) {
    const displayVal = value <= 1 ? value * 100 : value;
    return `${displayVal.toFixed(1)}%`;
  }
  if (DECIMAL_METRICS.has(key)) return value.toFixed(1);
  if (WHOLE_NUMBER_METRICS.has(key)) return Math.round(value).toLocaleString();
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
};
