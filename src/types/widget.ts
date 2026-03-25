export type WidgetType = 'number' | 'line' | 'area' | 'bar' | 'pie' | 'donut' | 'radar' | 'table';

export type WidgetCategory = 'kpi' | 'chart' | 'table' | 'platform';

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface DashboardWidget {
  id: string;
  dataSource: string;
  label: string;
  description: string;
  type: WidgetType;
  category: WidgetCategory;
  visible: boolean;
  position: WidgetPosition;
  compatibleTypes: WidgetType[];
}

export interface WidgetData {
  value?: number;
  change?: number;
  sparklineData?: Array<{ v: number; name: string }>;
  isCost?: boolean;
  currSymbol?: string;
  iconName?: string;
  chartData?: Array<Record<string, unknown>>;
  chartConfig?: {
    dataKeys: string[];
    colors: string[];
    names?: string[];
    xAxisKey?: string;
    stacked?: boolean;
    innerRadius?: number;
  };
  tableColumns?: Array<{ key: string; label: string; align?: 'left' | 'right' }>;
  tableData?: Array<Record<string, unknown>>;
  totalLabel?: string;
  totalValue?: string;
}

export const COMPATIBLE_TYPES: Record<WidgetCategory, WidgetType[]> = {
  kpi: ['number', 'line', 'area', 'bar'],
  chart: ['pie', 'donut', 'bar', 'area', 'line', 'radar'],
  table: ['table'],
  platform: ['number', 'bar', 'line', 'area'],
};
