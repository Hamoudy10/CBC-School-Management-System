// hooks/useMediaQuery.ts
// ============================================================
// Responsive Media Query Hook
// ============================================================

"use client";

import { useState, useEffect } from "react";

const breakpoints = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
  "2xl": "(min-width: 1536px)",
};

type Breakpoint = keyof typeof breakpoints;

/**
 * Hook to check if a media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * Hook to check if viewport is at least a certain breakpoint
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  return useMediaQuery(breakpoints[breakpoint]);
}

/**
 * Hook to get current breakpoint
 */
export function useCurrentBreakpoint(): Breakpoint | "xs" {
  const sm = useMediaQuery(breakpoints.sm);
  const md = useMediaQuery(breakpoints.md);
  const lg = useMediaQuery(breakpoints.lg);
  const xl = useMediaQuery(breakpoints.xl);
  const xxl = useMediaQuery(breakpoints["2xl"]);

  if (xxl) return "2xl";
  if (xl) return "xl";
  if (lg) return "lg";
  if (md) return "md";
  if (sm) return "sm";
  return "xs";
}

/**
 * Hook to check if mobile
 */
export function useIsMobile(): boolean {
  return !useBreakpoint("md");
}

/**
 * Hook to check if tablet
 */
export function useIsTablet(): boolean {
  const md = useBreakpoint("md");
  const lg = useBreakpoint("lg");
  return md && !lg;
}

/**
 * Hook to check if desktop
 */
export function useIsDesktop(): boolean {
  return useBreakpoint("lg");
}
