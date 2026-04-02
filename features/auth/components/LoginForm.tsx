// features/auth/components/LoginForm.tsx
// ============================================================
// Login Form Component
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const { login } = useAuth();
  const { error: showError } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    router.prefetch(redirectTo);
  }, [redirectTo, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsRedirecting(false);
    setLoading(true);
    let loginSucceeded = false;

    try {
      const result = await login({ email, password });

      if (result.success) {
        loginSucceeded = true;
        setIsRedirecting(true);
        // Use full page navigation to ensure cookies are properly set
        // before middleware runs on the next request
        window.location.href = redirectTo;
      } else {
        setError(result.message);
        showError("Login Failed", result.message);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      showError("Error", "An unexpected error occurred");
    } finally {
      if (!loginSucceeded) {
        setLoading(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-error-50 border border-error-200 p-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <Input
        label="Email Address"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@school.ac.ke"
        required
        fullWidth
        autoComplete="email"
      />

      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        required
        fullWidth
        autoComplete="current-password"
      />

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-secondary-600">Remember me</span>
        </label>
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-primary-600 hover:text-primary-500"
        >
          Forgot password?
        </Link>
      </div>

      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={loading}
        disabled={!email || !password || isRedirecting}
      >
        {isRedirecting ? "Opening Dashboard..." : "Sign In"}
      </Button>

      {isRedirecting && (
        <p className="text-center text-sm text-primary-600">
          Signing you in and preparing your dashboard...
        </p>
      )}
    </form>
  );
}
