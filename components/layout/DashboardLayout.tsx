// components/layout/DashboardLayout.tsx
// ============================================================
// Main Dashboard Layout — Optimized for instant shell rendering
// Shell (sidebar + header) renders immediately; content streams in
// ============================================================

"use client";

import { useEffect, useState, type ReactNode, Suspense } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { NavigationFeedback } from "./NavigationFeedback";
import type { BreadcrumbItem } from "@/components/ui/Breadcrumbs";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
}

function DashboardLayout({
  children,
  title,
  breadcrumbs,
}: DashboardLayoutProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  // Show shell immediately with skeleton content while auth loads
  // This gives instant visual feedback instead of a blank spinner
  const isAuthLoading = loading && !user;

  return (
    <div className="min-h-screen bg-secondary-50">
      <NavigationFeedback />

      {/* Sidebar - Desktop */}
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-modal-backdrop bg-secondary-900/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-modal w-sidebar transform transition-transform duration-300 lg:hidden",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar
          collapsed={false}
          onToggle={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* Main Content */}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-all duration-300",
          sidebarCollapsed ? "lg:pl-sidebar-collapsed" : "lg:pl-sidebar",
        )}
      >
        {/* Header */}
        <Header
          title={title}
          breadcrumbs={breadcrumbs}
          onMenuClick={() => setMobileSidebarOpen(true)}
        />

        {/* Page Content */}
        <main className="flex-1 px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-content">
            {isAuthLoading ? (
              // Skeleton — renders instantly while auth resolves
              <div className="min-h-[calc(100vh-12rem)] animate-pulse rounded-[28px] border border-white/65 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
                <div className="h-8 w-64 rounded-lg bg-gray-200" />
                <div className="mt-4 h-4 w-96 rounded bg-gray-100" />
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-28 rounded-xl bg-gray-100" />
                  ))}
                </div>
                <div className="mt-6 h-64 rounded-xl bg-gray-100" />
              </div>
            ) : (
              <div className="min-h-[calc(100vh-12rem)] rounded-[28px] border border-white/65 bg-white/92 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur sm:p-6">
                {children}
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-secondary-200 bg-white px-6 py-4">
          <div className="mx-auto max-w-content flex items-center justify-between text-sm text-secondary-500">
            <p>© 2025 CBC School Management System</p>
            <p>Version 1.0.0</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export { DashboardLayout };
