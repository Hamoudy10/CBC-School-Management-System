"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { NAV_ITEMS, type NavItem } from "@/lib/navigation/navConfig";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, checkModuleAccess } = useAuth();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const visibleNavItems = useMemo(() => {
    if (loading || !user) {
      return [];
    }
    return NAV_ITEMS.filter((item) => checkModuleAccess(item.module));
  }, [loading, user, checkModuleAccess]);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    if (visibleNavItems.length === 0) {
      return;
    }

    // Only prefetch 2 most likely destinations based on current path
    const getLikelyDestinations = (): NavItem[] => {
      // If on dashboard, prefetch students and attendance (most common)
      if (pathname === "/dashboard") {
        return [
          visibleNavItems.find((item) => item.href === "/students"),
          visibleNavItems.find((item) => item.href === "/attendance"),
        ].filter((item): item is NavItem => item !== undefined);
      }

      // If on a specific section, prefetch related sections and dashboard
      const currentSection = visibleNavItems.find((item) =>
        pathname.startsWith(item.href)
      );

      if (currentSection) {
        const currentIndex = visibleNavItems.findIndex(
          (item) => item.href === currentSection.href
        );
        const adjacentSections = [
          visibleNavItems[currentIndex - 1],
          visibleNavItems[currentIndex + 1],
        ].filter((item): item is NavItem => item !== undefined);

        const dashboardItem = visibleNavItems.find(
          (item) => item.href === "/dashboard"
        );
        const items = [dashboardItem, ...adjacentSections].filter(
          (item): item is NavItem =>
            item !== undefined && item.href !== pathname
        );
        return items.slice(0, 2);
      }

      // Default: just prefetch dashboard
      const dashboardItem = visibleNavItems.find(
        (item) => item.href === "/dashboard"
      );
      return dashboardItem ? [dashboardItem] : [];
    };

    const likelyDestinations = getLikelyDestinations();

    // Delay prefetching to avoid competing with initial page load
    const timeoutId = setTimeout(() => {
      for (const item of likelyDestinations) {
        router.prefetch(item.href);
      }
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [pathname, router, visibleNavItems]);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`flex h-full flex-col border-r border-gray-200 bg-white ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Logo / Brand */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold text-blue-600">SMS</span>
          {!collapsed && (
            <span className="text-sm font-medium text-gray-500">
              School Management
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {visibleNavItems.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gray-400">
              {loading ? "Loading modules..." : "No modules available"}
            </li>
          ) : (
            visibleNavItems.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    onClick={() => {
                      if (!active) {
                        setPendingHref(item.href);
                      }
                    }}
                    className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      active
                        ? "bg-gradient-to-r from-teal-50 to-cyan-50 text-teal-800 shadow-sm ring-1 ring-teal-100"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base transition-transform duration-200 group-hover:scale-110">
                      {pendingHref === item.href ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        item.icon
                      )}
                    </span>
                    {!collapsed && (
                      <span className="flex items-center gap-2">
                        {item.label}
                        {pendingHref === item.href ? (
                          <span className="text-xs text-blue-600">
                            Loading...
                          </span>
                        ) : null}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 px-3 py-3 text-xs text-slate-200">
          <p className="font-medium text-white">
            {pendingHref ? "Preparing module..." : "Fast navigation enabled"}
          </p>
          <p className="mt-1 text-slate-400">
            {pendingHref
              ? "Keeping the shell visible while the next page loads."
              : "Frequently used modules are prefetched in the background."}
          </p>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
