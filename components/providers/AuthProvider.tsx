"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  login as loginService,
  logout as logoutService,
  getCurrentUser,
  onAuthStateChange,
} from "@/services/auth.service";
import {
  getAllowedActions,
  getAccessibleModules,
} from "@/lib/auth/permissions";
import type { AuthResponse, AuthUser, LoginCredentials } from "@/types/auth";
import type { ActionName, ModuleName } from "@/types/roles";

interface AuthContextValue {
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

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: AuthUser | null;
}

export function AuthProvider({
  children,
  initialUser = null,
}: AuthProviderProps) {
  // Check sessionStorage for cached user from previous navigation
  const getCachedUser = (): AuthUser | null => {
    try {
      const cached = sessionStorage.getItem("auth_user");
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }
    return null;
  };

  const [user, setUser] = useState<AuthUser | null>(initialUser || getCachedUser());
  const [loading, setLoading] = useState(initialUser === null && !getCachedUser());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      // Skip if we already have a user (from initialUser or sessionStorage cache)
      if (initialUser || getCachedUser()) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (mounted) {
          setUser(currentUser);
          // Cache user in sessionStorage for instant access on next navigation
          if (currentUser) {
            try { sessionStorage.setItem("auth_user", JSON.stringify(currentUser)); } catch { /* ignore */ }
          }
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

    const { data: subscription } = onAuthStateChange((updatedUser) => {
      if (mounted) {
        setUser(updatedUser);
        setLoading(false);
        // Update sessionStorage cache
        if (updatedUser) {
          try { sessionStorage.setItem("auth_user", JSON.stringify(updatedUser)); } catch { /* ignore */ }
        } else {
          try { sessionStorage.removeItem("auth_user"); } catch { /* ignore */ }
        }
      }
    });

    return () => {
      mounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, [initialUser]);

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<AuthResponse> => {
      setLoading(true);
      setError(null);

      const result = await loginService(credentials);

      if (result.success && result.user) {
        setUser(result.user);
        // Cache immediately so dashboard navigation is instant
        try { sessionStorage.setItem("auth_user", JSON.stringify(result.user)); } catch { /* ignore */ }
      } else {
        setError(result.message);
      }

      setLoading(false);
      return result;
    },
    [],
  );

  const logout = useCallback(async () => {
    setLoading(true);
    await logoutService();
    setUser(null);
    setLoading(false);
    try { sessionStorage.removeItem("auth_user"); } catch { /* ignore */ }
  }, []);

  const accessibleModules = useMemo(() => {
    if (!user) {
      return [];
    }
    return getAccessibleModules(user.role);
  }, [user]);

  const accessibleModuleSet = useMemo(
    () => new Set<ModuleName>(accessibleModules),
    [accessibleModules],
  );

  const allowedActionsByModule = useMemo(() => {
    if (!user) {
      return new Map<ModuleName, ActionName[]>();
    }

    return new Map(
      accessibleModules.map((module) => [
        module,
        getAllowedActions(user.role, module),
      ]),
    );
  }, [accessibleModules, user]);

  const value = useMemo<AuthContextValue>(() => {
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
      checkPermission: (module, action) =>
        allowedActionsByModule.get(module)?.includes(action) ?? false,
      checkModuleAccess: (module) => accessibleModuleSet.has(module),
      getModuleActions: (module) => allowedActionsByModule.get(module) ?? [],
      accessibleModules,
      isAuthenticated,
      isAdmin,
      isTeacher,
      isParent,
      isStudent,
    };
  }, [
    accessibleModules,
    accessibleModuleSet,
    allowedActionsByModule,
    error,
    loading,
    login,
    logout,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
