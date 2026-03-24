import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { subMonths, addMonths } from 'date-fns';
import type { PlatformType } from '@/types/database';
import { PLATFORM_LABELS, PLATFORM_LOGOS } from '@/types/database';

// TODO: Implement weekly view when daily snapshots are available
// TODO: Implement custom date range when snapshot filtering supports date ranges
export type PeriodType = 'monthly' | 'quarterly';

export interface SelectedPeriod {
  type: PeriodType;
  month: number;
  year: number;
  startDate?: Date;
  endDate?: Date;
}

export type PlatformFilter = 'all' | PlatformType;

interface DashboardHeaderProps {
  selectedPlatform: PlatformFilter;
  onPlatformChange: (platform: PlatformFilter) => void;
  selectedPeriod: SelectedPeriod;
  onPeriodChange: (period: SelectedPeriod) => void;
  availablePlatforms: PlatformType[];
}

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const DashboardHeader = ({
  selectedPlatform,
  onPlatformChange,
  selectedPeriod,
  onPeriodChange,
  availablePlatforms,
}: DashboardHeaderProps) => {
  const platformOptions: Array<{ value: PlatformFilter; label: string }> = [
    { value: 'all', label: 'All Platforms' },
    ...availablePlatforms.map(p => ({ value: p as PlatformFilter, label: PLATFORM_LABELS[p] })),
  ];

  const periodTypes: Array<{ value: PeriodType; label: string }> = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
  ];

  const handlePrevMonth = () => {
    const d = subMonths(new Date(selectedPeriod.year, selectedPeriod.month - 1), 1);
    onPeriodChange({ ...selectedPeriod, month: d.getMonth() + 1, year: d.getFullYear() });
  };

  const handleNextMonth = () => {
    const d = addMonths(new Date(selectedPeriod.year, selectedPeriod.month - 1), 1);
    const now = new Date();
    if (d > now) return;
    onPeriodChange({ ...selectedPeriod, month: d.getMonth() + 1, year: d.getFullYear() });
  };

  const periodLabel = selectedPeriod.type === 'quarterly'
    ? `Q${Math.ceil(selectedPeriod.month / 3)} ${selectedPeriod.year}`
    : `${MONTH_NAMES[selectedPeriod.month]} ${selectedPeriod.year}`;

  return (
    <div className="space-y-4">
      {/* Platform Tabs */}
      <div className="flex flex-wrap gap-2">
        {platformOptions.map(opt => {
          const logo = PLATFORM_LOGOS[opt.value];
          return (
            <Button
              key={opt.value}
              variant={selectedPlatform === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPlatformChange(opt.value)}
              className="gap-1.5"
            >
              {logo && <img src={logo} alt="" className="h-4 w-4 object-contain" />}
              {opt.label}
            </Button>
          );
        })}
      </div>

      {/* Time Range + Navigation */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border bg-card p-1 gap-0.5">
          {periodTypes.map(pt => (
            <Button
              key={pt.value}
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-3 text-xs font-medium rounded-md',
                selectedPeriod.type === pt.value && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
              )}
              onClick={() => {
                onPeriodChange({ ...selectedPeriod, type: pt.value, startDate: undefined, endDate: undefined });
              }}
            >
              {pt.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">{periodLabel}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
