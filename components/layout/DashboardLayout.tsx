// components/layout/DashboardLayout.tsx
// ============================================================
// Main Dashboard Layout
// Combines: Sidebar, Header, Main Content Area
// Handles: sidebar collapse state, mobile responsiveness
// ============================================================

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { NavigationFeedback } from "./NavigationFeedback";
import type { BreadcrumbItem } from "@/components/ui/Breadcrumbs";

// ============================================================
// Layout Props
// ============================================================
interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
}

// ============================================================
// Dashboard Layout Component
// ============================================================
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

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary-50 px-6">
        <NavigationFeedback />
        <div className="w-full max-w-sm rounded-3xl border border-white/70 bg-white p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <h2 className="mt-4 text-lg font-semibold text-secondary-900">
            Loading workspace
          </h2>
          <p className="mt-2 text-sm text-secondary-500">
            Preparing your dashboard...
          </p>
        </div>
      </div>
    );
  }

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
            <div className="min-h-[calc(100vh-12rem)] rounded-[28px] border border-white/65 bg-white/92 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur sm:p-6">
              {children}
            </div>
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
