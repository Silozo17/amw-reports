import type { PlatformType, JobStatus } from '@/types/database';

export interface RawDataItem {
  [key: string]: string | number | boolean | null | undefined;
}

export interface TopContentItem {
  type?: string;
  page_name?: string;
  message?: string;
  caption?: string;
  full_picture?: string | null;
  permalink_url?: string | null;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  reach?: number;
  clicks?: number;
  total_engagement?: number;
  query?: string;
  page?: string;
  impressions?: number;
  ctr?: number;
  position?: number;
  sessions?: number;
  views?: number;
  users?: number;
  source?: string;
  title?: string;
  videoId?: string;
  video_views?: number;
  is_promoted?: boolean;
  reactions?: number;
  reaction_like?: number;
  reaction_love?: number;
  reaction_wow?: number;
  reaction_haha?: number;
  reaction_sorry?: number;
  reaction_anger?: number;
  country?: string;
  countryId?: string;
  device?: string;
  // GBP reviews
  author?: string;
  rating?: number;
  text?: string;
  relative_time?: string;
  // GBP keywords
  keyword?: string;
}

export interface ConnectionInfo {
  last_sync_at: string | null;
  last_sync_status: JobStatus | null;
  last_error: string | null;
}

export interface PlatformSectionProps {
  platform: PlatformType;
  metricsData: Record<string, number>;
  prevMetricsData?: Record<string, number>;
  connection?: ConnectionInfo;
  topContent?: TopContentItem[];
  trendData?: Array<{ name: string; [key: string]: number | string }>;
  currSymbol: string;
  enabledMetrics?: string[];
  reportMonth: number;
  reportYear: number;
  rawData?: Record<string, unknown>;
}
