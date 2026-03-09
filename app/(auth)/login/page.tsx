// app/(auth)/login/page.tsx
// ============================================================
// Login Page
// ============================================================

import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your account",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { redirectTo?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-primary-600 shadow-lg">
            S
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">
            CBC School Management
          </h1>
          <p className="mt-1 text-primary-200">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <LoginForm redirectTo={searchParams?.redirectTo || "/dashboard"} />
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-primary-300">
          © 2025 CBC School Management System
        </p>
      </div>
    </div>
  );
}
