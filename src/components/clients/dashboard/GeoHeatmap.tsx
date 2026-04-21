import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Globe, MapPin } from 'lucide-react';

interface GeoCountry {
  country: string;
  countryId: string;
  users: number;
  sessions: number;
}

interface GeoCity {
  city: string;
  country: string;
  users: number;
  sessions: number;
}

interface GeoHeatmapProps {
  countries: GeoCountry[];
  cities: GeoCity[];
}

/** Map GA4 countryId (ISO 3166-1 alpha-2 lowered, e.g. "US") to SVG path IDs */
const getColorForValue = (value: number, max: number): string => {
  if (max === 0 || value === 0) return 'hsl(var(--muted))';
  const intensity = Math.min(value / max, 1);
  // From muted to primary with varying opacity
  const alpha = 0.15 + intensity * 0.85;
  return `hsl(var(--primary) / ${alpha.toFixed(2)})`;
};

const GeoHeatmap = ({ countries, cities }: GeoHeatmapProps) => {
  const [hoveredCountry, setHoveredCountry] = useState<GeoCountry | null>(null);

  const maxUsers = useMemo(
    () => Math.max(...countries.map(c => c.users), 1),
    [countries]
  );

  const totalUsers = useMemo(
    () => countries.reduce((sum, c) => sum + c.users, 0),
    [countries]
  );

  const totalSessions = useMemo(
    () => countries.reduce((sum, c) => sum + c.sessions, 0),
    [countries]
  );

  // Build a lookup by country name for the bar chart
  const sortedCountries = useMemo(
    () => [...countries].sort((a, b) => b.users - a.users).slice(0, 15),
    [countries]
  );

  const filteredCities = useMemo(
    () => cities.filter(c => c.city && c.city !== '(not set)').slice(0, 20),
    [cities]
  );

  if (countries.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Country distribution bar chart */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold font-body">User Distribution by Country</h4>
            <span className="ml-auto text-xs text-muted-foreground">
              {totalUsers.toLocaleString()} users · {totalSessions.toLocaleString()} sessions
            </span>
          </div>

          {/* Horizontal bar chart */}
          <TooltipProvider delayDuration={100}>
            <div className="space-y-1.5">
              {sortedCountries.map((c) => {
                const pct = totalUsers > 0 ? (c.users / totalUsers) * 100 : 0;
                return (
                  <Tooltip key={c.countryId || c.country}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-3 group cursor-default">
                        <span className="text-xs text-muted-foreground w-[120px] truncate shrink-0 font-body">
                          {c.country}
                        </span>
                        <div className="flex-1 h-5 bg-muted/50 rounded-sm overflow-hidden">
                          <div
                            className="h-full rounded-sm transition-all duration-300 group-hover:opacity-80"
                            style={{
                              width: `${Math.max(pct, 1)}%`,
                              backgroundColor: 'hsl(var(--primary))',
                              opacity: 0.3 + (c.users / maxUsers) * 0.7,
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium tabular-nums w-[50px] text-right font-body">
                          {c.users.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums w-[40px] text-right">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <p className="font-medium">{c.country}</p>
                      <p>Users: {c.users.toLocaleString()}</p>
                      <p>Sessions: {c.sessions.toLocaleString()}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>

          {countries.length > 15 && (
            <p className="text-[10px] text-muted-foreground text-center">
              Showing top 15 of {countries.length} countries
            </p>
          )}
        </CardContent>
      </Card>

      {/* Top Cities Table */}
      {filteredCities.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold font-body">Top Cities</h4>
            </div>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>City</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCities.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-body">{c.city}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.country}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{c.users.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{c.sessions.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GeoHeatmap;
