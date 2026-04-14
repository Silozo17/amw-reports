import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import GeoHeatmap from '@/components/clients/dashboard/GeoHeatmap';
import DeviceBreakdown from '@/components/clients/dashboard/DeviceBreakdown';
import type { RawDataItem } from './shared/types';

interface GoogleAnalyticsExtrasProps {
  rawData: Record<string, unknown>;
}

const GoogleAnalyticsExtras = ({ rawData }: GoogleAnalyticsExtrasProps) => {
  return (
    <>
      {((rawData.geoCountries as RawDataItem[])?.length > 0 || (rawData.geoCities as RawDataItem[])?.length > 0) && (
        <GeoHeatmap
          countries={(rawData.geoCountries as RawDataItem[]) || []}
          cities={(rawData.geoCities as RawDataItem[]) || []}
        />
      )}
      {((rawData.devices as RawDataItem[])?.length > 0 || (rawData.newVsReturning as RawDataItem[])?.length > 0) && (
        <DeviceBreakdown
          devices={(rawData.devices as RawDataItem[]) || []}
          newVsReturning={(rawData.newVsReturning as RawDataItem[]) || []}
        />
      )}
      {(rawData.landingPages as RawDataItem[])?.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <h4 className="text-sm font-semibold font-body">Top Landing Pages</h4>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Landing Page</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Bounce Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rawData.landingPages as RawDataItem[]).slice(0, 15).map((lp: RawDataItem, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-body max-w-[300px] truncate">{String(lp.page ?? '')}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{(Number(lp.sessions) || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{(Number(lp.bounceRate) || 0).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default GoogleAnalyticsExtras;
