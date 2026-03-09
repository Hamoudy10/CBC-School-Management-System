// components/ui/Spinner.tsx
// ============================================================
// Loading Spinner Component
// Sizes: xs, sm, md, lg, xl
// ============================================================

import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================
interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  label?: string;
}

// ============================================================
// Size Classes
// ============================================================
const sizeClasses = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

// ============================================================
// Spinner Component
// ============================================================
function Spinner({ size = "md", className, label }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label || "Loading"}
      className={cn("flex items-center justify-center", className)}
    >
      <svg
        className={cn("animate-spin text-primary-600", sizeClasses[size])}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}

// ============================================================
// Full Page Loader
// ============================================================
interface PageLoaderProps {
  message?: string;
}

function PageLoader({ message = "Loading..." }: PageLoaderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary-50">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="xl" />
        <p className="text-sm text-secondary-600">{message}</p>
      </div>
    </div>
  );
}

// ============================================================
// Inline Loader (for sections)
// ============================================================
interface SectionLoaderProps {
  message?: string;
  className?: string;
}

function SectionLoader({ message, className }: SectionLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 gap-3",
        className,
      )}
    >
      <Spinner size="lg" />
      {message && <p className="text-sm text-secondary-500">{message}</p>}
    </div>
  );
}

export { Spinner, PageLoader, SectionLoader };
