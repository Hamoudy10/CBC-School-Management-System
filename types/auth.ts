// types/auth.ts
// ============================================================
// Authentication & session type definitions
// Used across services, middleware, and components
// ============================================================

import { type RoleName } from "@/types/roles";

// ============================================================
// Authenticated User Session
// ============================================================
export interface AuthUser {
  id: string; // auth.users.id / users.user_id
  user_id?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  schoolId: string | null; // null for super_admin only
  school_id?: string | null;
  status: "active" | "inactive" | "suspended" | "archived";
  emailVerified: boolean;
  lockedUntil?: string | null;
}

// ============================================================
// Login Credentials
// ============================================================
export interface LoginCredentials {
  email: string;
  password: string;
}

// ============================================================
// Signup Payload
// ============================================================
export interface SignupPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  roleId: string;
  schoolId: string;
}

// ============================================================
// Password Reset Request
// ============================================================
export interface PasswordResetRequest {
  email: string;
}

// ============================================================
// Password Update
// ============================================================
export interface PasswordUpdate {
  newPassword: string;
}

// ============================================================
// Auth Response
// ============================================================
export interface AuthResponse {
  success: boolean;
  message: string;
  user?: AuthUser;
  error?: string;
}

// ============================================================
// Session with full user context
// ============================================================
export interface SessionContext {
  user: AuthUser;
  accessToken: string;
  expiresAt: number;
}

// ============================================================
// Route protection config
// ============================================================
export interface RouteConfig {
  path: string;
  requiredRoles?: RoleName[];
  requiredModule?: string;
  requiredAction?: string;
  isPublic?: boolean;
}
