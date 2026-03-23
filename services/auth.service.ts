// services/auth.service.ts
// ============================================================
// Core authentication service
// Handles: login, signup, logout, password reset, session
// All auth flows go through this service — never call Supabase directly
// ============================================================

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  LoginCredentials,
  PasswordResetRequest,
  PasswordUpdate,
  AuthUser,
  AuthResponse,
} from "@/types/auth";
import type { RoleName } from "@/types/roles";

// ============================================================
// Initialize browser client
// ============================================================
const supabase = createSupabaseBrowserClient();
const usersTable = () => supabase.from("users") as any;

// ============================================================
// Maximum failed login attempts before lockout
// ============================================================
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

// ============================================================
// LOGIN
// ============================================================
export async function login(
  credentials: LoginCredentials,
): Promise<AuthResponse> {
  try {
    // Step 1: Authenticate with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

    if (authError) {
      // Record failed login attempt
      await recordFailedLogin(credentials.email);
      return {
        success: false,
        message: "Invalid email or password.",
        error: authError.message,
      };
    }

    if (!authData.user) {
      return {
        success: false,
        message: "Authentication failed. No user returned.",
      };
    }

    // Step 2: Fetch user profile with role
    const userProfile = await getUserProfile(authData.user.id);

    if (!userProfile) {
      await supabase.auth.signOut();
      return {
        success: false,
        message: "User profile not found. Contact administrator.",
      };
    }

    // Step 3: Check account status
    if (userProfile.status !== "active") {
      await supabase.auth.signOut();
      return {
        success: false,
        message: `Account is ${userProfile.status}. Contact administrator.`,
      };
    }

    // Step 4: Check lockout
    if (
      userProfile.lockedUntil &&
      new Date(userProfile.lockedUntil) > new Date()
    ) {
      await supabase.auth.signOut();
      return {
        success: false,
        message: "Account is temporarily locked. Try again later.",
      };
    }

    // Step 5: Reset failed attempts on successful login
    await resetFailedAttempts(authData.user.id);

    // Step 6: Record successful login
    await recordSuccessfulLogin(authData.user.id);

    return {
      success: true,
      message: "Login successful.",
      user: userProfile,
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      message: "An unexpected error occurred during login.",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================
// LOGOUT
// ============================================================
export async function logout(): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        message: "Logout failed.",
        error: error.message,
      };
    }

    return {
      success: true,
      message: "Logged out successfully.",
    };
  } catch (error) {
    console.error("Logout error:", error);
    return {
      success: false,
      message: "An unexpected error occurred during logout.",
    };
  }
}

// ============================================================
// REQUEST PASSWORD RESET
// ============================================================
export async function requestPasswordReset(
  payload: PasswordResetRequest,
): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(payload.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      return {
        success: false,
        message: "Failed to send password reset email.",
        error: error.message,
      };
    }

    // Always return success to prevent email enumeration
    return {
      success: true,
      message:
        "If an account exists with this email, a reset link has been sent.",
    };
  } catch (error) {
    console.error("Password reset error:", error);
    return {
      success: false,
      message: "An unexpected error occurred.",
    };
  }
}

// ============================================================
// UPDATE PASSWORD (after reset)
// ============================================================
export async function updatePassword(
  payload: PasswordUpdate,
): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: payload.newPassword,
    });

    if (error) {
      return {
        success: false,
        message: "Failed to update password.",
        error: error.message,
      };
    }

    return {
      success: true,
      message: "Password updated successfully.",
    };
  } catch (error) {
    console.error("Password update error:", error);
    return {
      success: false,
      message: "An unexpected error occurred.",
    };
  }
}

// ============================================================
// GET CURRENT SESSION
// ============================================================
export async function getCurrentSession(): Promise<AuthUser | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return await getUserProfile(user.id);
  } catch {
    return null;
  }
}

// ============================================================
// GET CURRENT USER (with auth check)
// ============================================================
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return await getUserProfile(user.id);
  } catch {
    return null;
  }
}

// ============================================================
// LISTEN TO AUTH STATE CHANGES
// ============================================================
export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      const profile = await getUserProfile(session.user.id);
      callback(profile);
    } else if (event === "SIGNED_OUT") {
      callback(null);
    } else if (event === "TOKEN_REFRESHED" && session?.user) {
      const profile = await getUserProfile(session.user.id);
      callback(profile);
    }
  });
}

// ============================================================
// INTERNAL: Fetch user profile with role name
// ============================================================
async function getUserProfile(authUserId: string): Promise<AuthUser | null> {
  const { data, error } = await usersTable()
    .select(
      `
      user_id,
      email,
      first_name,
      last_name,
      school_id,
      status,
      email_verified,
      failed_login_attempts,
      locked_until,
      roles (
        name
      )
    `,
    )
    .eq("user_id", authUserId)
    .single();

  if (error || !data) {
    console.error("Failed to fetch user profile:", error);
    return null;
  }

  return {
    id: data.user_id,
    user_id: data.user_id,
    email: data.email,
    firstName: data.first_name,
    lastName: data.last_name,
    role: (data.roles as any)?.name as RoleName,
    schoolId: data.school_id,
    school_id: data.school_id,
    status: data.status as AuthUser["status"],
    emailVerified: data.email_verified,
    lockedUntil: data.locked_until,
  };
}

// ============================================================
// INTERNAL: Record failed login attempt
// ============================================================
async function recordFailedLogin(email: string): Promise<void> {
  try {
    // Fetch current attempt count
    const { data } = await usersTable()
      .select("user_id, failed_login_attempts")
      .eq("email", email)
      .single();

    if (!data) {
      return;
    }

    const newAttempts = (data.failed_login_attempts || 0) + 1;

    const updatePayload: Record<string, any> = {
      failed_login_attempts: newAttempts,
    };

    // Lock account if max attempts exceeded
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
      updatePayload.locked_until = lockUntil.toISOString();
    }

    await usersTable()
      .update(updatePayload)
      .eq("user_id", data.user_id);
  } catch (error) {
    console.error("Failed to record login attempt:", error);
  }
}

// ============================================================
// INTERNAL: Reset failed attempts on successful login
// ============================================================
async function resetFailedAttempts(userId: string): Promise<void> {
  await usersTable()
    .update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

// ============================================================
// INTERNAL: Record successful login for audit
// ============================================================
async function recordSuccessfulLogin(userId: string): Promise<void> {
  await usersTable()
    .update({
      last_login_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}
