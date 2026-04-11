import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, CalendarIcon, ChevronDown, Check } from 'lucide-react';
import { subMonths, addMonths, addWeeks, subWeeks, format, startOfWeek } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { PlatformType } from '@/types/database';
import { PLATFORM_LABELS, PLATFORM_LOGOS } from '@/types/database';

const PLATFORM_CATEGORIES: Array<{ label: string; platforms: PlatformType[] }> = [
  { label: 'Organic Social', platforms: ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest'] },
  { label: 'Paid Advertising', platforms: ['google_ads', 'meta_ads', 'tiktok_ads', 'linkedin_ads'] },
  { label: 'SEO & Web Analytics', platforms: ['google_search_console', 'google_analytics', 'google_business_profile'] },
];

export type PeriodType = 'weekly' | 'monthly' | 'quarterly' | 'ytd' | 'last_year' | 'maximum' | 'custom';

export interface SelectedPeriod {
  type: PeriodType;
  month: number;
  year: number;
  startDate?: Date;
  endDate?: Date;
}

export type PlatformFilter = PlatformType[] | 'all';

interface DashboardHeaderProps {
  selectedPlatform: PlatformFilter;
  onPlatformChange: (platform: PlatformFilter) => void;
  selectedPeriod: SelectedPeriod;
  onPeriodChange: (period: SelectedPeriod) => void;
  availablePlatforms: PlatformType[];
}

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const PERIOD_OPTIONS: Array<{ value: PeriodType; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'maximum', label: 'Maximum' },
  { value: 'custom', label: 'Custom' },
];

const ARROWS_ENABLED: Set<PeriodType> = new Set(['weekly', 'monthly', 'quarterly']);

const DashboardHeader = ({
  selectedPlatform,
  onPlatformChange,
  selectedPeriod,
  onPeriodChange,
  availablePlatforms,
}: DashboardHeaderProps) => {
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);

  const isAll = selectedPlatform === 'all';
  const selectedArray = isAll ? [] : selectedPlatform;

  const handleTogglePlatform = (platform: PlatformType) => {
    if (isAll) {
      // Switching from "all" to a single platform
      onPlatformChange([platform]);
      return;
    }

    const current = [...selectedArray];
    const idx = current.indexOf(platform);

    if (idx >= 0) {
      // Deselecting — prevent empty selection
      if (current.length <= 1) return;
      current.splice(idx, 1);
    } else {
      current.push(platform);
    }

    // If all platforms are now selected, switch to "all"
    if (current.length === availablePlatforms.length) {
      onPlatformChange('all');
    } else {
      onPlatformChange(current);
    }
  };

  const handleToggleAll = () => {
    onPlatformChange('all');
  };

  const isPlatformSelected = (platform: PlatformType): boolean => {
    if (isAll) return true;
    return selectedArray.includes(platform);
  };

  const getTriggerLabel = () => {
    if (isAll) return 'All Platforms';
    if (selectedArray.length === 1) return PLATFORM_LABELS[selectedArray[0]];
    return `${selectedArray.length} Platforms`;
  };

  const handlePrev = () => {
    const { type, month, year } = selectedPeriod;
    if (type === 'quarterly') {
      const d = subMonths(new Date(year, month - 1), 3);
      onPeriodChange({ ...selectedPeriod, month: d.getMonth() + 1, year: d.getFullYear() });
    } else if (type === 'weekly') {
      const d = subWeeks(new Date(year, month - 1, 15), 1);
      onPeriodChange({ ...selectedPeriod, month: d.getMonth() + 1, year: d.getFullYear() });
    } else {
      const d = subMonths(new Date(year, month - 1), 1);
      onPeriodChange({ ...selectedPeriod, month: d.getMonth() + 1, year: d.getFullYear() });
    }
  };

  const handleNext = () => {
    const { type, month, year } = selectedPeriod;
    const now = new Date();
    let d: Date;
    if (type === 'quarterly') {
      d = addMonths(new Date(year, month - 1), 3);
    } else if (type === 'weekly') {
      d = addWeeks(new Date(year, month - 1, 15), 1);
    } else {
      d = addMonths(new Date(year, month - 1), 1);
    }
    if (d > now) return;
    onPeriodChange({ ...selectedPeriod, month: d.getMonth() + 1, year: d.getFullYear() });
  };

  const handleTypeChange = (value: string) => {
    const newType = value as PeriodType;
    const now = new Date();
    if (newType === 'ytd') {
      onPeriodChange({ type: newType, month: now.getMonth() + 1, year: now.getFullYear() });
    } else if (newType === 'last_year') {
      onPeriodChange({ type: newType, month: 1, year: now.getFullYear() - 1 });
    } else if (newType === 'maximum') {
      onPeriodChange({ type: newType, month: selectedPeriod.month, year: selectedPeriod.year });
    } else if (newType === 'custom') {
      onPeriodChange({
        type: newType,
        month: selectedPeriod.month,
        year: selectedPeriod.year,
        startDate: selectedPeriod.startDate ?? new Date(selectedPeriod.year, selectedPeriod.month - 1, 1),
        endDate: selectedPeriod.endDate ?? new Date(),
      });
    } else {
      onPeriodChange({ ...selectedPeriod, type: newType, startDate: undefined, endDate: undefined });
    }
  };

  const getPeriodLabel = (): string => {
    const { type, month, year, startDate, endDate } = selectedPeriod;
    switch (type) {
      case 'weekly': {
        const weekStart = startOfWeek(new Date(year, month - 1, 15), { weekStartsOn: 1 });
        return `Week of ${format(weekStart, 'MMM d, yyyy')}`;
      }
      case 'monthly':
        return `${MONTH_NAMES[month]} ${year}`;
      case 'quarterly':
        return `Q${Math.ceil(month / 3)} ${year}`;
      case 'ytd':
        return `Jan – ${MONTH_NAMES[new Date().getMonth() + 1]} ${year}`;
      case 'last_year':
        return `${year}`;
      case 'maximum':
        return 'All Time';
      case 'custom':
        if (startDate && endDate) {
          return `${format(startDate, 'MMM d, yyyy')} – ${format(endDate, 'MMM d, yyyy')}`;
        }
        return 'Select dates';
      default:
        return '';
    }
  };

  const showArrows = ARROWS_ENABLED.has(selectedPeriod.type);

  return (
    <div className="space-y-4">
      {/* Platform Multi-Select Dropdown + Time Range Controls on same row */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Platform Multi-Select Dropdown */}
        <Popover open={platformDropdownOpen} onOpenChange={setPlatformDropdownOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 min-w-0 sm:min-w-[180px] justify-between">
              <div className="flex items-center gap-1.5">
                {isAll ? (
                  <>
                    <img src={PLATFORM_LOGOS.all} alt="" className="h-4 w-4 object-contain" />
                    <span>All Platforms</span>
                  </>
                ) : selectedArray.length === 1 ? (
                  <>
                    <img src={PLATFORM_LOGOS[selectedArray[0]]} alt="" className="h-4 w-4 object-contain" />
                    <span>{PLATFORM_LABELS[selectedArray[0]]}</span>
                  </>
                ) : (
                  <>
                    <div className="flex -space-x-1">
                      {selectedArray.slice(0, 3).map(p => (
                        <img key={p} src={PLATFORM_LOGOS[p]} alt="" className="h-4 w-4 object-contain rounded-full border border-background" />
                      ))}
                    </div>
                    <span>{selectedArray.length} Platforms</span>
                  </>
                )}
              </div>
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-1" align="start">
            {/* All Platforms option */}
            <button
              type="button"
              onClick={handleToggleAll}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer",
                isAll && "bg-accent"
              )}
            >
              <div className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary",
                isAll ? "bg-primary text-primary-foreground" : "opacity-50"
              )}>
                {isAll && <Check className="h-3 w-3" />}
              </div>
              <img src={PLATFORM_LOGOS.all} alt="" className="h-4 w-4 object-contain" />
              <span>All Platforms</span>
            </button>

            <div className="my-1 h-px bg-border" />

            {/* Individual platforms */}
            {availablePlatforms.map(platform => {
              const selected = isPlatformSelected(platform) && !isAll;
              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => handleTogglePlatform(platform)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer",
                    selected && "bg-accent/50"
                  )}
                >
                  <div className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary",
                    selected ? "bg-primary text-primary-foreground" : "opacity-50"
                  )}>
                    {selected && <Check className="h-3 w-3" />}
                  </div>
                  <img src={PLATFORM_LOGOS[platform]} alt="" className="h-4 w-4 object-contain" />
                  <span>{PLATFORM_LABELS[platform]}</span>
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

        {/* Period Type Dropdown */}
        <Select value={selectedPeriod.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[120px] sm:w-[160px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Arrow Navigation */}
        {showArrows && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handlePrev} aria-label="Previous period">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs sm:text-sm font-medium min-w-[100px] sm:min-w-[180px] text-center">{getPeriodLabel()}</span>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleNext} aria-label="Next period">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Static label for fixed ranges */}
        {!showArrows && selectedPeriod.type !== 'custom' && (
          <span className="text-sm font-medium">{getPeriodLabel()}</span>
        )}

        {/* Custom Date Pickers */}
        {selectedPeriod.type === 'custom' && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1.5 text-sm font-normal", !selectedPeriod.startDate && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {selectedPeriod.startDate ? format(selectedPeriod.startDate, 'MMM d, yyyy') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedPeriod.startDate}
                  onSelect={(date) => {
                    if (date) onPeriodChange({ ...selectedPeriod, startDate: date });
                  }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-sm text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1.5 text-sm font-normal", !selectedPeriod.endDate && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {selectedPeriod.endDate ? format(selectedPeriod.endDate, 'MMM d, yyyy') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedPeriod.endDate}
                  onSelect={(date) => {
                    if (date) onPeriodChange({ ...selectedPeriod, endDate: date });
                  }}
                  disabled={(date) => date > new Date() || (selectedPeriod.startDate ? date < selectedPeriod.startDate : false)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Weekly disclaimer */}
      {selectedPeriod.type === 'weekly' && (
        <p className="text-xs text-muted-foreground italic">
          Showing monthly data — weekly breakdowns require daily snapshots.
        </p>
      )}
    </div>
  );
};

export default DashboardHeader;
