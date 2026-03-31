import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend,
} from 'recharts';
import { useChartColors } from '@/hooks/useChartColors';
import { Monitor, Smartphone, Tablet } from 'lucide-react';

interface DeviceItem {
  device: string;
  users: number;
  sessions: number;
}

interface NewVsRetItem {
  type: string;
  users: number;
  sessions: number;
}

interface DeviceBreakdownProps {
  devices: DeviceItem[];
  newVsReturning: NewVsRetItem[];
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  desktop: <Monitor className="h-3.5 w-3.5" />,
  mobile: <Smartphone className="h-3.5 w-3.5" />,
  tablet: <Tablet className="h-3.5 w-3.5" />,
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value, payload: data } = payload[0];
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-xl text-xs space-y-0.5">
      <p className="font-medium text-foreground">{name}</p>
      <p>Users: {value.toLocaleString()}</p>
      {data.sessions !== undefined && <p>Sessions: {data.sessions.toLocaleString()}</p>}
    </div>
  );
};

const DeviceBreakdown = ({ devices, newVsReturning }: DeviceBreakdownProps) => {
  const CHART_COLORS = useChartColors();

  const deviceData = useMemo(() => {
    return devices
      .filter(d => d.users > 0)
      .map(d => ({
        name: d.device.charAt(0).toUpperCase() + d.device.slice(1),
        value: d.users,
        sessions: d.sessions,
      }));
  }, [devices]);

  const nvrData = useMemo(() => {
    return newVsReturning
      .filter(d => d.users > 0)
      .map(d => ({
        name: d.type === 'new' ? 'New Users' : 'Returning Users',
        value: d.users,
        sessions: d.sessions,
      }));
  }, [newVsReturning]);

  const totalDeviceUsers = useMemo(
    () => deviceData.reduce((s, d) => s + d.value, 0),
    [deviceData]
  );

  if (deviceData.length === 0 && nvrData.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Device Category */}
      {deviceData.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <h4 className="text-sm font-semibold font-body">Device Breakdown</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {deviceData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                    formatter={(value: string) => (
                      <span className="text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Device stats below chart */}
            <div className="flex justify-center gap-6 text-xs text-muted-foreground">
              {deviceData.map((d) => {
                const pct = totalDeviceUsers > 0 ? ((d.value / totalDeviceUsers) * 100).toFixed(1) : '0';
                const icon = DEVICE_ICONS[d.name.toLowerCase()] || null;
                return (
                  <span key={d.name} className="flex items-center gap-1">
                    {icon}
                    {d.name}: {pct}%
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New vs Returning */}
      {nvrData.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <h4 className="text-sm font-semibold font-body">New vs Returning Users</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={nvrData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {nvrData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                    formatter={(value: string) => (
                      <span className="text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Summary stats */}
            <div className="flex justify-center gap-6 text-xs text-muted-foreground">
              {nvrData.map((d) => (
                <span key={d.name}>
                  {d.name}: {d.value.toLocaleString()}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DeviceBreakdown;
