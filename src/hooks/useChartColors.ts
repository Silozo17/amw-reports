import { useMemo } from 'react';

/**
 * Reads chart colours from CSS variables set by BrandingProvider.
 * Falls back to AMW defaults if not set.
 */
export function useChartColors(): string[] {
  return useMemo(() => {
    const root = document.documentElement;
    const getVar = (name: string, fallback: string) => {
      const val = getComputedStyle(root).getPropertyValue(name).trim();
      return val ? `hsl(${val})` : fallback;
    };
    return [
      getVar('--chart-1', '#b32fbf'),
      getVar('--chart-2', '#539BDB'),
      getVar('--chart-3', '#4ED68E'),
      getVar('--chart-4', '#EE8733'),
      getVar('--primary', '#b32fbf'),
      getVar('--secondary', '#539BDB'),
    ];
  }, []);
}
