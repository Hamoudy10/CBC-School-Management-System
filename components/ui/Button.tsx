// components/ui/Button.tsx
// ============================================================
// Button Component
// Variants: primary, secondary, outline, ghost, danger
// Sizes: sm, md, lg
// States: default, hover, active, disabled, loading
// ============================================================

"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ============================================================
// Button Variants (using cva for type-safe variants)
// ============================================================
const buttonVariants = cva(
  // Base styles
  `inline-flex items-center justify-center gap-2 font-medium transition-all
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
   disabled:pointer-events-none disabled:opacity-50
   active:scale-[0.98]`,
  {
    variants: {
      variant: {
        primary: `
          bg-primary-600 text-white
          hover:bg-primary-700
          focus-visible:ring-primary-500
        `,
        secondary: `
          bg-secondary-100 text-secondary-700
          hover:bg-secondary-200
          focus-visible:ring-secondary-500
        `,
        outline: `
          border-2 border-primary-600 text-primary-600 bg-transparent
          hover:bg-primary-50
          focus-visible:ring-primary-500
        `,
        ghost: `
          text-secondary-600 bg-transparent
          hover:bg-secondary-100 hover:text-secondary-900
          focus-visible:ring-secondary-500
        `,
        danger: `
          bg-error-600 text-white
          hover:bg-error-700
          focus-visible:ring-error-500
        `,
        success: `
          bg-success-600 text-white
          hover:bg-success-700
          focus-visible:ring-success-500
        `,
        link: `
          text-primary-600 underline-offset-4
          hover:underline
          focus-visible:ring-primary-500
          p-0 h-auto
        `,
      },
      size: {
        xs: "h-7 px-2.5 text-xs rounded",
        sm: "h-8 px-3 text-sm rounded-md",
        md: "h-10 px-4 text-sm rounded-lg",
        lg: "h-12 px-6 text-base rounded-lg",
        xl: "h-14 px-8 text-lg rounded-xl",
        icon: "h-10 w-10 rounded-lg",
        "icon-sm": "h-8 w-8 rounded-md",
        "icon-lg": "h-12 w-12 rounded-lg",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);

// ============================================================
// Component Props
// ============================================================
export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

// ============================================================
// Button Component
// ============================================================
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg
            className="h-4 w-4 animate-spin"
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
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
