// ═══════════════════════════════════════════════════════════════════════════════
// USE IS MOBILE - Hook for Responsive Design
// ═══════════════════════════════════════════════════════════════════════════════

"use client";

import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Check on mount
    checkMobile();

    // Listen for resize
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

export function useBreakpoint(breakpoint: number): boolean {
  const [isBelow, setIsBelow] = React.useState(false);

  React.useEffect(() => {
    const check = () => {
      setIsBelow(window.innerWidth < breakpoint);
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);

  return isBelow;
}
