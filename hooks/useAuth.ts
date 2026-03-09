// hooks/useAuth.ts
// ============================================================
// React hook for authentication state management
// Provides: user, loading, login, logout, permission checks
// Used in client components throughout the app
// ============================================================

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  login as loginService,
  logout as logoutService,
  getCurrentUser,
  onAuthStateChange,
} from "@/services/auth.service";
import {
  hasPermission,
  hasModuleAccess,
  getAllowedActions,
  getAccessibleModules,
} from "@/lib/auth/permissions";
import type { AuthUser, LoginCredentials, AuthResponse } from "@/types/auth";
import type { ModuleName, ActionName } from "@/types/roles";

// ============================================================
// Hook Return Type
// ============================================================
interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  checkPermission: (module: ModuleName, action: ActionName) => boolean;
  checkModuleAccess: (module: ModuleName) => boolean;
  getModuleActions: (module: ModuleName) => ActionName[];
  accessibleModules: ModuleName[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isParent: boolean;
  isStudent: boolean;
}

// ============================================================
// useAuth Hook
// ============================================================
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Initialize: fetch current user on mount ───
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const currentUser = await getCurrentUser();
        if (mounted) {
          setUser(currentUser);
        }
      } catch (err) {
        if (mounted) {
          setError("Failed to initialize authentication");
          console.error("Auth init error:", err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    // ─── Listen for auth state changes ───
    const { data: subscription } = onAuthStateChange((updatedUser) => {
      if (mounted) {
        setUser(updatedUser);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

  // ─── Login ───
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<AuthResponse> => {
      setLoading(true);
      setError(null);

      const result = await loginService(credentials);

      if (result.success && result.user) {
        setUser(result.user);
      } else {
        setError(result.message);
      }

      setLoading(false);
      return result;
    },
    [],
  );

  // ─── Logout ───
  const logout = useCallback(async () => {
    setLoading(true);
    await logoutService();
    setUser(null);
    setLoading(false);
  }, []);

  // ─── Permission Checks (memoized) ───
  const checkPermission = useCallback(
    (module: ModuleName, action: ActionName): boolean => {
      if (!user) return false;
      return hasPermission(user.role, module, action);
    },
    [user],
  );

  const checkModuleAccess = useCallback(
    (module: ModuleName): boolean => {
      if (!user) return false;
      return hasModuleAccess(user.role, module);
    },
    [user],
  );

  const getModuleActions = useCallback(
    (module: ModuleName): ActionName[] => {
      if (!user) return [];
      return getAllowedActions(user.role, module);
    },
    [user],
  );

  const accessibleModules = useMemo(() => {
    if (!user) return [];
    return getAccessibleModules(user.role);
  }, [user]);

  // ─── Role convenience checks ───
  const isAuthenticated = !!user;
  const isAdmin =
    !!user &&
    ["super_admin", "school_admin", "principal", "deputy_principal"].includes(
      user.role,
    );
  const isTeacher =
    !!user &&
    ["teacher", "class_teacher", "subject_teacher"].includes(user.role);
  const isParent = !!user && user.role === "parent";
  const isStudent = !!user && user.role === "student";

  return {
    user,
    loading,
    error,
    login,
    logout,
    checkPermission,
    checkModuleAccess,
    getModuleActions,
    accessibleModules,
    isAuthenticated,
    isAdmin,
    isTeacher,
    isParent,
    isStudent,
  };
}
