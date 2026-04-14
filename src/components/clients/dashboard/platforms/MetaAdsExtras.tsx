import AdCampaignBreakdown from '@/components/clients/dashboard/AdCampaignBreakdown';
import type { RawDataItem } from './shared/types';

interface MetaAdsExtrasProps {
  rawData: Record<string, unknown>;
  currSymbol: string;
}

const MetaAdsExtras = ({ rawData, currSymbol }: MetaAdsExtrasProps) => {
  if (!(rawData.campaigns as RawDataItem[])?.length) return null;

  return (
    <AdCampaignBreakdown
      rawData={rawData as Record<string, unknown>}
      currSymbol={currSymbol}
    />
  );
};

export default MetaAdsExtras;
