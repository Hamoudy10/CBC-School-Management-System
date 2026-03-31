// components/layout/Header.tsx
// ============================================================
// Dashboard Header
// Contains: page title, breadcrumbs, search, notifications, user menu
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import {
  Search,
  Bell,
  Menu,
  ChevronDown,
  User,
  Settings,
  LogOut,
} from "lucide-react";

// ============================================================
// Header Component
// ============================================================
interface HeaderProps {
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
  onMenuClick?: () => void;
  className?: string;
}

function Header({
  title,
  breadcrumbs = [],
  onMenuClick,
  className,
}: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadUnreadCount() {
      if (!user) {
        if (mounted) {
          setUnreadCount(0);
        }
        return;
      }

      try {
        const response = await fetch("/api/notifications/unread-count", {
          credentials: "include",
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(
            json?.error || json?.message || "Failed to load notifications",
          );
        }

        if (mounted) {
          setUnreadCount(Number(json?.data?.total || 0));
        }
      } catch (error) {
        if (mounted) {
          setUnreadCount(0);
        }
        console.error("Failed to load unread notifications:", error);
      }
    }

    loadUnreadCount();

    return () => {
      mounted = false;
    };
  }, [user]);

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
    router.replace("/login");
  };

  const handleOpenNotifications = () => {
    setShowUserMenu(false);
    router.push("/communication?tab=notifications");
  };

  const handleOpenProfile = () => {
    setShowUserMenu(false);
    router.push("/profile");
  };

  const handleOpenSettings = () => {
    setShowUserMenu(false);
    router.push("/settings");
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-sticky flex h-header items-center justify-between border-b border-secondary-200 bg-white px-6",
        className,
      )}
    >
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle */}
        <button
          onClick={onMenuClick}
          className="lg:hidden rounded-lg p-2 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumbs / Title */}
        <div className="flex flex-col gap-0.5">
          {breadcrumbs.length > 0 && (
            <Breadcrumbs items={breadcrumbs} showHome={true} />
          )}
          {title && (
            <h1 className="text-lg font-semibold text-secondary-900">
              {title}
            </h1>
          )}
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="hidden md:flex items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
            <input
              type="text"
              placeholder="Search..."
              className="h-9 w-64 rounded-lg border border-secondary-200 bg-secondary-50 pl-9 pr-3 text-sm placeholder:text-secondary-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={handleOpenNotifications}
            className="relative rounded-lg p-2 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-semibold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-secondary-100"
          >
            <Avatar
              name={user ? `${user.firstName} ${user.lastName}` : undefined}
              size="sm"
            />
            <ChevronDown className="h-4 w-4 text-secondary-400" />
          </button>

          {/* User Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-secondary-200 bg-white shadow-lg animate-scale-in">
              {user && (
                <div className="border-b border-secondary-100 px-4 py-3">
                  <p className="font-medium text-secondary-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-sm text-secondary-500">{user.email}</p>
                </div>
              )}
              <div className="py-1">
                <button
                  onClick={handleOpenProfile}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-secondary-600 hover:bg-secondary-50"
                >
                  <User className="h-4 w-4" />
                  Profile
                </button>
                <button
                  onClick={handleOpenSettings}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-secondary-600 hover:bg-secondary-50"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
              </div>
              <div className="border-t border-secondary-100 py-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-error-600 hover:bg-error-50"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => {
            setShowUserMenu(false);
          }}
        />
      )}
    </header>
  );
}

export { Header };
