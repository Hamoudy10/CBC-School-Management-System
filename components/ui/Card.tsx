// components/ui/Card.tsx
// ============================================================
// Card Component
// Used for: dashboards, content containers, KPI cards
// Parts: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
// ============================================================

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// Card Root
// ============================================================
const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-secondary-200 bg-white shadow-card transition-shadow hover:shadow-card-hover",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

// ============================================================
// Card Header
// ============================================================
const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1.5 p-6 pb-4", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

// ============================================================
// Card Title
// ============================================================
const CardTitle = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-tight text-secondary-900",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

// ============================================================
// Card Description
// ============================================================
const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-secondary-500", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

// ============================================================
// Card Content
// ============================================================
const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

// ============================================================
// Card Footer
// ============================================================
const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center border-t border-secondary-100 px-6 py-4",
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

// ============================================================
// Stat Card (for KPIs)
// ============================================================
interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
  };
  className?: string;
}

function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-secondary-500">
              {title}
            </span>
            <span className="text-2xl font-bold text-secondary-900">
              {value}
            </span>
            {description && (
              <span className="text-xs text-secondary-400">{description}</span>
            )}
            {trend && (
              <div
                className={cn(
                  "mt-1 flex items-center gap-1 text-xs font-medium",
                  trend.direction === "up" && "text-success-600",
                  trend.direction === "down" && "text-error-600",
                  trend.direction === "neutral" && "text-secondary-500",
                )}
              >
                {trend.direction === "up" && "↑"}
                {trend.direction === "down" && "↓"}
                {trend.direction === "neutral" && "→"}
                <span>
                  {trend.value > 0 ? "+" : ""}
                  {trend.value}%
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div className="rounded-lg bg-primary-50 p-3 text-primary-600">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatCard,
};
