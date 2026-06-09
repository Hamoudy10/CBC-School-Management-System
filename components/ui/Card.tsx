"use client";

import { forwardRef, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass";
  hoverable?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", hoverable = false, ...props }, ref) => {
    const baseStyles =
      variant === "glass"
        ? "rounded-xl border border-white/40 bg-white/85 shadow-card backdrop-blur-sm"
        : "rounded-xl border border-secondary-200 bg-white shadow-card transition-shadow";

    return (
      <motion.div
        ref={ref}
        className={cn(baseStyles, hoverable && "cursor-pointer", className)}
        whileHover={hoverable ? { y: -2, boxShadow: "0 12px 40px rgba(15,23,42,0.1)" } : undefined}
        transition={{ duration: 0.2, ease: "easeOut" }}
        {...(props as any)}
      />
    );
  },
);
Card.displayName = "Card";

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

const CardTitle = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-tight tracking-tight text-secondary-900",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm leading-relaxed text-secondary-500", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

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

function AnimatedCounter({ value, duration = 600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    }

    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

type AccentColor = "primary" | "success" | "warning" | "error" | "info";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
  };
  animate?: boolean;
  accent?: AccentColor;
  className?: string;
}

const accentGradients: Record<AccentColor, string> = {
  primary: "from-primary-500/10 via-primary-500/5 to-transparent",
  success: "from-success-500/10 via-success-500/5 to-transparent",
  warning: "from-warning-500/10 via-warning-500/5 to-transparent",
  error: "from-error-500/10 via-error-500/5 to-transparent",
  info: "from-blue-500/10 via-blue-500/5 to-transparent",
};

const accentIconStyles: Record<AccentColor, string> = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  error: "bg-error-50 text-error-600",
  info: "bg-blue-50 text-blue-600",
};

const accentTopBorder: Record<AccentColor, string> = {
  primary: "before:bg-primary-500",
  success: "before:bg-success-500",
  warning: "before:bg-warning-500",
  error: "before:bg-error-500",
  info: "before:bg-blue-500",
};

function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  animate = false,
  accent = "primary",
  className,
}: StatCardProps) {
  const numericValue = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, "")) || 0;

  return (
    <motion.div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-secondary-200 bg-white shadow-card transition-all before:absolute before:inset-x-0 before:top-0 before:h-1",
        accentTopBorder[accent],
        className,
      )}
      initial={animate ? { opacity: 0, y: 16 } : undefined}
      animate={animate ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -2, boxShadow: "0 12px 40px rgba(15,23,42,0.1)" }}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100", accentGradients[accent])} />
      <div className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-secondary-500">
              {title}
            </span>
            <span className="text-2xl font-bold tracking-tight text-secondary-900">
              {animate ? <AnimatedCounter value={numericValue} /> : value}
            </span>
            {description && (
              <span className="text-xs text-secondary-400">{description}</span>
            )}
            {trend && (
              <div
                className={cn(
                  "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  trend.direction === "up" && "bg-success-50 text-success-700",
                  trend.direction === "down" && "bg-error-50 text-error-700",
                  trend.direction === "neutral" && "bg-secondary-100 text-secondary-600",
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
            <div className={cn("rounded-lg p-3 transition-transform group-hover:scale-110", accentIconStyles[accent])}>
              {icon}
            </div>
          )}
        </div>
      </div>
    </motion.div>
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
