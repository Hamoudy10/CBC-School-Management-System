"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { NAV_ITEMS, getNavCategories } from "@/lib/navigation/navConfig";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const { user, loading, accessibleModules } = useAuth();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const accessibleModuleSet = useMemo(
    () => new Set(accessibleModules),
    [accessibleModules],
  );

  const visibleNavItems = useMemo(() => {
    if (loading || !user) return [];
    return NAV_ITEMS.filter((item) => accessibleModuleSet.has(item.module));
  }, [accessibleModuleSet, loading, user]);

  const categories = useMemo(
    () => getNavCategories(visibleNavItems),
    [visibleNavItems],
  );

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`flex h-full flex-col border-r border-gray-200/80 bg-gradient-to-b from-white to-gray-50/50 transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Logo / Brand */}
      <div className="flex h-16 items-center border-b border-gray-200/80 px-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-gray-900 leading-tight">
                SchoolHub
              </span>
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                Management
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {!mounted ? (
          <div className="space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded-lg bg-gray-200/60"
              />
            ))}
          </div>
        ) : loading ? (
          <div className="space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded-lg bg-gray-200/60"
              />
            ))}
          </div>
        ) : !mounted ? null : categories.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-400">
            No modules available
          </p>
        ) : (
          <div className="space-y-4">
            {categories.map((category, catIdx) => (
              <div key={catIdx}>
                {!collapsed && category.label && (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {category.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {category.items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => {
                            if (!active) setPendingHref(item.href);
                          }}
                          className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
                            active
                              ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm"
                              : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
                          }`}
                        >
                          {/* Active indicator */}
                          {active && (
                            <div className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-blue-600" />
                          )}

                          {/* Icon */}
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${
                              active
                                ? "bg-blue-100 text-blue-600"
                                : "bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-700"
                            }`}
                          >
                            {pendingHref === item.href ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <Icon className="h-4 w-4" />
                            )}
                          </div>

                          {/* Label */}
                          {!collapsed && (
                            <span className="flex items-center gap-2">
                              {item.label}
                              {pendingHref === item.href && (
                                <span className="text-[10px] font-medium text-blue-500">
                                  Loading...
                                </span>
                              )}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-gray-200/80 p-3">
          <div className="rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 px-3 py-2.5">
            <p className="text-xs font-medium text-white">
              {user?.firstName ?? "User"}
            </p>
            <p className="text-[10px] text-gray-400 capitalize">
              {user?.role?.replace("_", " ") ?? "Loading..."}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
