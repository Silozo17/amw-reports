import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BarChart3, TrendingUp, Activity, PieChart, Hash, Table2 } from 'lucide-react';
import type { WidgetType } from '@/types/widget';

const CHART_TYPE_ICONS: Record<WidgetType, React.ElementType> = {
  number: Hash,
  line: TrendingUp,
  area: Activity,
  bar: BarChart3,
  pie: PieChart,
  donut: PieChart,
  radar: Activity,
  table: Table2,
};

const CHART_TYPE_LABELS: Record<WidgetType, string> = {
  number: 'Number',
  line: 'Line Chart',
  area: 'Area Chart',
  bar: 'Bar Chart',
  pie: 'Pie Chart',
  donut: 'Donut Chart',
  radar: 'Radar Chart',
  table: 'Table',
};

interface ChartTypeSelectorProps {
  currentType: WidgetType;
  compatibleTypes: WidgetType[];
  onChange: (type: WidgetType) => void;
}

const ChartTypeSelector = ({ currentType, compatibleTypes, onChange }: ChartTypeSelectorProps) => {
  const CurrentIcon = CHART_TYPE_ICONS[currentType];

  if (compatibleTypes.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-50 hover:opacity-100">
          <CurrentIcon className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {compatibleTypes.map((type) => {
          const Icon = CHART_TYPE_ICONS[type];
          return (
            <DropdownMenuItem
              key={type}
              onClick={() => onChange(type)}
              className={currentType === type ? 'bg-accent/20 font-medium' : ''}
            >
              <Icon className="h-4 w-4 mr-2" />
              {CHART_TYPE_LABELS[type]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ChartTypeSelector;
