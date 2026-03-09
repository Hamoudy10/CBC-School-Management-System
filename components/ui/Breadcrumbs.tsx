// components/ui/Breadcrumbs.tsx
// ============================================================
// Breadcrumbs Component
// Navigation aid showing current location in hierarchy
// ============================================================

import { type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronRight, Home } from "lucide-react";

// ============================================================
// Types
// ============================================================
export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: ReactNode;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  separator?: ReactNode;
  className?: string;
}

// ============================================================
// Breadcrumbs Component
// ============================================================
function Breadcrumbs({
  items,
  showHome = true,
  separator,
  className,
}: BreadcrumbsProps) {
  const allItems: BreadcrumbItem[] = showHome
    ? [
        {
          label: "Home",
          href: "/dashboard",
          icon: <Home className="h-4 w-4" />,
        },
        ...items,
      ]
    : items;

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center", className)}>
      <ol className="flex items-center gap-1 text-sm">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;

          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <span className="text-secondary-300">
                  {separator || <ChevronRight className="h-4 w-4" />}
                </span>
              )}

              {isLast || !item.href ? (
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    isLast
                      ? "font-medium text-secondary-900"
                      : "text-secondary-500",
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.icon}
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 text-secondary-500 hover:text-secondary-900 transition-colors"
                >
                  {item.icon}
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { Breadcrumbs };
