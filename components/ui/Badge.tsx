// components/ui/Badge.tsx
// ============================================================
// Badge Component
// Used for: status indicators, labels, counts
// Variants: default, success, warning, error, info
// Special: CBC performance level badges
// ============================================================

import { type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { PerformanceLevelLabel } from "@/features/assessments/types";

// ============================================================
// Badge Variants
// ============================================================
const badgeVariants = cva(
  "inline-flex items-center justify-center font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-secondary-100 text-secondary-700",
        primary: "bg-primary-100 text-primary-700",
        success: "bg-success-100 text-success-700",
        warning: "bg-warning-100 text-warning-700",
        error: "bg-error-100 text-error-700",
        danger: "bg-error-100 text-error-700",
        info: "bg-primary-100 text-primary-700",
        outline:
          "border border-secondary-300 text-secondary-700 bg-transparent",
        // CBC Performance Levels
        exceeding: "bg-blue-100 text-blue-700 border border-blue-300",
        meeting: "bg-green-100 text-green-700 border border-green-300",
        approaching: "bg-amber-100 text-amber-700 border border-amber-300",
        below_expectation: "bg-red-100 text-red-700 border border-red-300",
        // Status badges
        active: "bg-success-100 text-success-700",
        inactive: "bg-secondary-100 text-secondary-600",
        suspended: "bg-error-100 text-error-700",
        pending: "bg-warning-100 text-warning-700",
        // Fee status
        paid: "bg-success-100 text-success-700",
        partial: "bg-warning-100 text-warning-700",
        overdue: "bg-error-100 text-error-700",
      },
      size: {
        xs: "px-1.5 py-0.5 text-2xs rounded",
        sm: "px-2 py-0.5 text-xs rounded-md",
        md: "px-2.5 py-1 text-xs rounded-md",
        lg: "px-3 py-1 text-sm rounded-lg",
      },
      dot: {
        true: "pl-1.5",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
      dot: false,
    },
  },
);

// ============================================================
// Component Props
// ============================================================
export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
  showDot?: boolean;
  color?: "green" | "gray" | "yellow" | "red" | "blue" | "amber";
}

// ============================================================
// Badge Component
// ============================================================
function Badge({
  children,
  variant,
  size,
  showDot = false,
  color,
  className,
}: BadgeProps) {
  const resolvedVariant =
    variant ||
    (color === "green"
      ? "success"
      : color === "yellow" || color === "amber"
        ? "warning"
        : color === "red"
          ? "error"
          : color === "blue"
            ? "info"
            : color === "gray"
              ? "inactive"
              : undefined);

  return (
    <span
      className={cn(
        badgeVariants({ variant: resolvedVariant, size, dot: showDot }),
        className,
      )}
    >
      {showDot && (
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}

// ============================================================
// Performance Level Badge (specialized for CBC)
// ============================================================
interface PerformanceBadgeProps {
  level: PerformanceLevelLabel;
  showLabel?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const levelLabels: Record<PerformanceLevelLabel, string> = {
  exceeding: "Exceeding",
  meeting: "Meeting",
  approaching: "Approaching",
  below_expectation: "Below Expectation",
};

const levelShortLabels: Record<PerformanceLevelLabel, string> = {
  exceeding: "EE",
  meeting: "ME",
  approaching: "AE",
  below_expectation: "BE",
};

function PerformanceBadge({
  level,
  showLabel = true,
  size = "sm",
  className,
}: PerformanceBadgeProps) {
  return (
    <Badge variant={level} size={size} className={className}>
      {showLabel ? levelLabels[level] : levelShortLabels[level]}
    </Badge>
  );
}

// ============================================================
// Status Badge (for user/student status)
// ============================================================
interface StatusBadgeProps {
  status: "active" | "inactive" | "suspended" | "archived" | "pending";
  size?: "xs" | "sm" | "md" | "lg";
  showDot?: boolean;
  className?: string;
}

function StatusBadge({
  status,
  size = "sm",
  showDot = true,
  className,
}: StatusBadgeProps) {
  const labels: Record<StatusBadgeProps["status"], string> = {
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
    archived: "Archived",
    pending: "Pending",
  };

  return (
    <Badge
      variant={status as any}
      size={size}
      showDot={showDot}
      className={className}
    >
      {labels[status]}
    </Badge>
  );
}

// ============================================================
// Fee Status Badge
// ============================================================
interface FeeStatusBadgeProps {
  status: "paid" | "partial" | "pending" | "overdue" | "waived";
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

function FeeStatusBadge({
  status,
  size = "sm",
  className,
}: FeeStatusBadgeProps) {
  const labels: Record<FeeStatusBadgeProps["status"], string> = {
    paid: "Paid",
    partial: "Partial",
    pending: "Pending",
    overdue: "Overdue",
    waived: "Waived",
  };

  const variant = status === "waived" ? "info" : status;

  return (
    <Badge variant={variant as any} size={size} className={className}>
      {labels[status]}
    </Badge>
  );
}

export { Badge, badgeVariants, PerformanceBadge, StatusBadge, FeeStatusBadge };
