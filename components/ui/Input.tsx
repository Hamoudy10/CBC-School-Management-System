// components/ui/Input.tsx
// ============================================================
// Input Component
// Supports: text, email, password, number, search, tel, url
// Features: labels, error messages, helper text, icons
// ============================================================

"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

// ============================================================
// Component Props
// ============================================================
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

// ============================================================
// Input Component
// ============================================================
const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      id,
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || props.name;

    const isPassword = type === "password";
    const inputType = isPassword && showPassword ? "text" : type;

    return (
      <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-secondary-700"
          >
            {label}
            {props.required && <span className="ml-0.5 text-error-500">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            disabled={disabled}
            className={cn(
              `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-secondary-900
               placeholder:text-secondary-400
               transition-colors duration-200
               focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20
               disabled:cursor-not-allowed disabled:bg-secondary-50 disabled:text-secondary-500`,
              error
                ? "border-error-500 focus:border-error-500 focus:ring-error-500/20"
                : "border-secondary-300",
              leftIcon && "pl-10",
              (rightIcon || isPassword) && "pr-10",
              className,
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}
          {rightIcon && !isPassword && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-error-600">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-secondary-500">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
