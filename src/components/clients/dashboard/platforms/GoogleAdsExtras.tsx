import AdCampaignBreakdown from '@/components/clients/dashboard/AdCampaignBreakdown';
import type { RawDataItem } from './shared/types';

interface GoogleAdsExtrasProps {
  rawData: Record<string, unknown>;
  currSymbol: string;
}

const GoogleAdsExtras = ({ rawData, currSymbol }: GoogleAdsExtrasProps) => {
  if (!(rawData.campaigns as RawDataItem[])?.length) return null;

  return (
    <AdCampaignBreakdown
      rawData={{
        campaigns: (rawData.campaigns as RawDataItem[])?.map((c: RawDataItem) => ({
          ...c, spend: c.spend ?? c.cost, cpc: c.cpc ?? c.avg_cpc,
        })),
        adSets: (rawData.adGroups as RawDataItem[]) || [],
        ads: (rawData.ads as RawDataItem[]) || [],
      }}
      currSymbol={currSymbol}
      adGroupLabel="Ad Groups"
    />
  );
};

export default GoogleAdsExtras;
