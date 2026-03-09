"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

function formatDestination(pathname: string) {
  if (!pathname || pathname === "/dashboard") {
    return "dashboard";
  }

  const segment = pathname.split("/").filter(Boolean).pop() ?? "module";
  return segment.replace(/[-_]/g, " ");
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [destination, setDestination] = useState<string | null>(null);

  const routeKey = useMemo(
    () => `${pathname}?${searchParams?.toString() ?? ""}`,
    [pathname, searchParams],
  );

  useEffect(() => {
    if (!isNavigating) {
      return;
    }

    const tick = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 88) {
          return current;
        }
        return current + (current < 35 ? 18 : current < 65 ? 10 : 4);
      });
    }, 140);

    return () => window.clearInterval(tick);
  }, [isNavigating]);

  useEffect(() => {
    setProgress(100);
    const timeout = window.setTimeout(() => {
      setIsNavigating(false);
      setProgress(0);
      setDestination(null);
    }, 240);

    return () => window.clearTimeout(timeout);
  }, [routeKey]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;

      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      try {
        const url = new URL(anchor.href, window.location.href);
        const current = new URL(window.location.href);

        if (url.origin !== current.origin) {
          return;
        }

        const nextKey = `${url.pathname}?${url.searchParams.toString()}`;
        const currentKey = `${current.pathname}?${current.searchParams.toString()}`;

        if (nextKey === currentKey) {
          return;
        }

        setDestination(formatDestination(url.pathname));
        setIsNavigating(true);
        setProgress(14);
      } catch {
        // Ignore malformed URLs.
      }
    };

    window.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("click", handleClick, true);
    };
  }, []);

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-[70] h-1 origin-left transition-opacity duration-200",
          isNavigating || progress > 0 ? "opacity-100" : "opacity-0",
        )}
      >
        <div
          className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-400 shadow-[0_0_20px_rgba(20,184,166,0.45)] transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div
        className={cn(
          "pointer-events-none fixed right-5 top-5 z-[71] transition-all duration-250",
          isNavigating || progress > 0
            ? "translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0",
        )}
      >
        <div className="rounded-full border border-white/50 bg-slate-950/88 px-4 py-2 text-xs text-white shadow-2xl backdrop-blur-xl">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {destination ? `Opening ${destination}...` : "Preparing next view..."}
          </span>
        </div>
      </div>
    </>
  );
}
