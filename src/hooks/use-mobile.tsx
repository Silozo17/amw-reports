import * as React from "react";

// Includes phones AND tablet portrait (iPad ≤1023px). At 768–1023px the fixed
// 256px sidebar would otherwise leave only ~512px of content, squeezing every
// card and dashboard. Switching to the hamburger sheet at <1024px gives the
// content the full viewport and is the single biggest responsive fix.
const MOBILE_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
