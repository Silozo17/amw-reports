import AdCampaignBreakdown from '@/components/clients/dashboard/AdCampaignBreakdown';
import type { RawDataItem } from './shared/types';

interface LinkedInAdsExtrasProps {
  rawData: Record<string, unknown>;
  currSymbol: string;
}

type RawDataProp = Parameters<typeof AdCampaignBreakdown>[0]['rawData'];

const LinkedInAdsExtras = ({ rawData, currSymbol }: LinkedInAdsExtrasProps) => {
  if (!((rawData.campaignGroups as RawDataItem[])?.length || (rawData.campaigns as RawDataItem[])?.length)) return null;

  const mapped: RawDataProp = {
    campaigns: ((rawData.campaignGroups as RawDataItem[]) || []) as RawDataProp['campaigns'],
    adSets: ((rawData.campaigns as RawDataItem[])?.map((c) => ({
      ...c,
      campaign_id: c.campaignGroupId || '',
    })) || []) as RawDataProp['adSets'],
    ads: ((rawData.ads as RawDataItem[])?.map((a) => ({
      ...a,
      adset_id: a.campaignId || '',
      adset_name: a.campaign_name || '',
    })) || []) as RawDataProp['ads'],
  };

  return (
    <AdCampaignBreakdown
      rawData={mapped}
      currSymbol={currSymbol}
      adGroupLabel="Campaigns"
    />
  );
};

export default LinkedInAdsExtras;
