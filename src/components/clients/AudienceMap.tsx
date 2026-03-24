import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Globe } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface GeoPoint {
  lat: number;
  lng: number;
  value: number;
  label: string;
}

interface AudienceMapProps {
  geoData: GeoPoint[];
}

const REGION_VIEWS: Record<string, { center: [number, number]; zoom: number }> = {
  World: { center: [20, 0], zoom: 2 },
  UK: { center: [54.5, -3], zoom: 6 },
  Europe: { center: [50, 10], zoom: 4 },
  'N. America': { center: [40, -100], zoom: 4 },
};

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://carto.com/">CartoDB</a>';

const AudienceMap = ({ geoData }: AudienceMapProps) => {
  const [activeRegion, setActiveRegion] = useState('World');

  const totalValue = useMemo(() => geoData.reduce((s, g) => s + g.value, 0), [geoData]);
  const topLocations = useMemo(
    () => [...geoData].sort((a, b) => b.value - a.value).slice(0, 10),
    [geoData]
  );

  const maxVal = useMemo(() => Math.max(...geoData.map(g => g.value), 1), [geoData]);

  const view = REGION_VIEWS[activeRegion];

  if (geoData.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Audience Geography
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center space-y-2">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Geographic data not available for this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Audience Geography
          </CardTitle>
          <div className="flex gap-1">
            {Object.keys(REGION_VIEWS).map(region => (
              <Button
                key={region}
                variant={activeRegion === region ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setActiveRegion(region)}
              >
                {region}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 relative">
        <div className="h-[300px] md:h-[400px] relative rounded-b-lg overflow-hidden">
          <MapContainer
            key={activeRegion}
            center={view.center}
            zoom={view.zoom}
            scrollWheelZoom={false}
            className="h-full w-full"
            attributionControl={true}
          >
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
            {geoData.map((point, i) => {
              const radius = 6 + (point.value / maxVal) * 18;
              const pct = totalValue > 0 ? ((point.value / totalValue) * 100).toFixed(1) : '0';
              return (
                <CircleMarker
                  key={i}
                  center={[point.lat, point.lng]}
                  radius={radius}
                  pathOptions={{
                    fillColor: '#b32fbf',
                    fillOpacity: 0.6,
                    color: '#b32fbf',
                    weight: 1,
                    opacity: 0.8,
                  }}
                >
                  <LeafletTooltip direction="top" offset={[0, -8]}>
                    <div className="text-xs font-medium">
                      <p className="font-bold">{point.label}</p>
                      <p>{point.value.toLocaleString()} · {pct}%</p>
                    </div>
                  </LeafletTooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Sidebar overlay: Top locations */}
          {topLocations.length > 0 && (
            <div className="absolute top-3 right-3 z-[1000] bg-card/90 backdrop-blur rounded-lg p-3 w-48 shadow-lg border">
              <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">Top Locations</p>
              <div className="space-y-1.5">
                {topLocations.map((loc, i) => {
                  const barWidth = (loc.value / topLocations[0].value) * 100;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="truncate mr-2">{loc.label}</span>
                        <span className="text-muted-foreground shrink-0">{loc.value.toLocaleString()}</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full mt-0.5">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AudienceMap;
