import { useEffect, useRef, useState } from 'react';

/**
 * Hook that animates a number from 0 to `target` using requestAnimationFrame.
 * Returns the current displayed value as a formatted string.
 */
export function useAnimatedCounter(target: number, duration = 800): number {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(0);
  const rafId = useRef<number>();

  useEffect(() => {
    const start = prevTarget.current;
    const diff = target - start;
    if (diff === 0) return;

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(start + diff * eased);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(tick);
      } else {
        prevTarget.current = target;
      }
    };

    rafId.current = requestAnimationFrame(tick);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [target, duration]);

  return current;
}
