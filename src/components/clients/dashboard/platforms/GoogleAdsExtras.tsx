import AdCampaignBreakdown from '@/components/clients/dashboard/AdCampaignBreakdown';
import type { RawDataItem } from './shared/types';

interface GoogleAdsExtrasProps {
  rawData: Record<string, unknown>;
  currSymbol: string;
}

type RawDataProp = Parameters<typeof AdCampaignBreakdown>[0]['rawData'];

const GoogleAdsExtras = ({ rawData, currSymbol }: GoogleAdsExtrasProps) => {
  if (!(rawData.campaigns as RawDataItem[])?.length) return null;

  const mapped: RawDataProp = {
    campaigns: ((rawData.campaigns as RawDataItem[]) ?? []).map((c) => ({
      ...c, spend: c.spend ?? c.cost, cpc: c.cpc ?? c.avg_cpc,
    })) as unknown as RawDataProp['campaigns'],
    adSets: ((rawData.adGroups as RawDataItem[]) || []) as unknown as RawDataProp['adSets'],
    ads: ((rawData.ads as RawDataItem[]) || []) as unknown as RawDataProp['ads'],
  };

  return (
    <AdCampaignBreakdown
      rawData={mapped}
      currSymbol={currSymbol}
      adGroupLabel="Ad Groups"
    />
  );
};

export default GoogleAdsExtras;
