"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "🏠" },
  { label: "Students", href: "/students", icon: "🎓" },
  { label: "Staff", href: "/staff", icon: "👨‍🏫" },
  { label: "Classes", href: "/classes", icon: "🏫" },
  { label: "Academics", href: "/academics", icon: "📚" },
  { label: "Assessments", href: "/assessments", icon: "📝" },
  { label: "Attendance", href: "/attendance", icon: "✅" },
  { label: "Timetable", href: "/timetable", icon: "📅" },
  { label: "Finance", href: "/finance", icon: "💰" },
  { label: "Discipline", href: "/discipline", icon: "📋" },
  { label: "Communication", href: "/communication", icon: "💬" },
  { label: "Reports", href: "/reports", icon: "📊" },
  { label: "Library", href: "/library", icon: "📖" },
  { label: "Users", href: "/users", icon: "👥" },
  { label: "Settings", href: "/settings", icon: "⚙️" },
];

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    const prefetchTargets = navItems
      .filter((item) => item.href !== pathname)
      .slice(0, 6);

    const prefetch = () => {
      for (const item of prefetchTargets) {
        router.prefetch(item.href);
      }
    };

    let idleCallbackId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleCallbackId = window.requestIdleCallback(prefetch, { timeout: 1500 });
    } else {
      timeoutId = globalThis.setTimeout(prefetch, 500);
    }

    return () => {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }

      if (
        idleCallbackId !== null &&
        typeof window !== "undefined" &&
        "cancelIdleCallback" in window
      ) {
        window.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [pathname, router]);

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
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch
                  onMouseEnter={() => router.prefetch(item.href)}
                  onFocus={() => router.prefetch(item.href)}
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
                        <span className="text-xs text-blue-600">Loading...</span>
                      ) : null}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
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
