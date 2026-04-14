import AdCampaignBreakdown from '@/components/clients/dashboard/AdCampaignBreakdown';
import type { RawDataItem } from './shared/types';

interface LinkedInAdsExtrasProps {
  rawData: Record<string, unknown>;
  currSymbol: string;
}

const LinkedInAdsExtras = ({ rawData, currSymbol }: LinkedInAdsExtrasProps) => {
  if (!((rawData.campaignGroups as RawDataItem[])?.length || (rawData.campaigns as RawDataItem[])?.length)) return null;

  return (
    <AdCampaignBreakdown
      rawData={{
        campaigns: (rawData.campaignGroups as RawDataItem[]) || [],
        adSets: (rawData.campaigns as RawDataItem[])?.map((c: RawDataItem) => ({
          ...c,
          campaign_id: c.campaignGroupId || '',
        })) || [],
        ads: (rawData.ads as RawDataItem[])?.map((a: RawDataItem) => ({
          ...a,
          adset_id: a.campaignId || '',
          adset_name: a.campaign_name || '',
        })) || [],
      }}
      currSymbol={currSymbol}
      adGroupLabel="Campaigns"
    />
  );
};

export default LinkedInAdsExtras;
