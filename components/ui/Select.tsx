// components/ui/Select.tsx
// ============================================================
// Select Component
// Native select with custom styling
// Supports: placeholder, error state, disabled
// ============================================================

"use client";

import { forwardRef, type SelectHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

// ============================================================
// Component Props
// ============================================================
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  options?: SelectOption[];
  icon?: ReactNode;
  fullWidth?: boolean;
}

// ============================================================
// Select Component
// ============================================================
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      placeholder,
      options = [],
      icon,
      children,
      fullWidth = false,
      disabled,
      id,
      ...props
    },
    ref,
  ) => {
    const selectId = id || props.name;

    return (
      <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-secondary-700"
          >
            {label}
            {props.required && <span className="ml-0.5 text-error-500">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400">
              {icon}
            </div>
          )}
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={cn(
              `w-full appearance-none rounded-lg border bg-white px-3 py-2.5 pr-10 text-sm text-secondary-900
               transition-colors duration-200
               focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20
               disabled:cursor-not-allowed disabled:bg-secondary-50 disabled:text-secondary-500`,
              error
                ? "border-error-500 focus:border-error-500 focus:ring-error-500/20"
                : "border-secondary-300",
              icon && "pl-10",
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {children ||
              options.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </option>
              ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
        </div>
        {error && <p className="text-xs text-error-600">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-secondary-500">{helperText}</p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";

export { Select };
