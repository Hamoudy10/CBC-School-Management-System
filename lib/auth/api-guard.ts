// lib/auth/api-guard.ts
// ============================================================
// API route protection utilities
// Used in app/api/ route handlers
// Returns proper HTTP responses instead of redirects
// ============================================================

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import type { RoleName, ModuleName, ActionName } from "@/types/roles";
import type { AuthUser } from "@/types/auth";

type UserRoleRow = { name: RoleName } | null;

type UserProfileRow = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  school_id: string | null;
  status: AuthUser["status"];
  email_verified: boolean;
  roles: UserRoleRow;
};

// ============================================================
// Standard API error responses
// ============================================================
function unauthorizedResponse(message = "Authentication required") {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

function forbiddenResponse(message = "Insufficient permissions") {
  return NextResponse.json({ success: false, error: message }, { status: 403 });
}

// ============================================================
// Authenticate API request — returns user or error response
// ============================================================
export async function authenticateRequest(): Promise<
  | { authenticated: true; user: AuthUser; supabase: any }
  | { authenticated: false; response: NextResponse }
> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) {
    return {
      authenticated: false,
      response: unauthorizedResponse(),
    };
  }

  // Fetch user profile with role
  const { data: userData, error: profileError } = await supabase
    .from("users")
    .select(
      `
      user_id,
      email,
      first_name,
      last_name,
      school_id,
      status,
      email_verified,
      roles (
        name
      )
    `,
    )
    .eq("user_id", authUser.id)
    .single();

  const profile = userData as unknown as UserProfileRow | null;

  if (profileError || !profile) {
    return {
      authenticated: false,
      response: unauthorizedResponse("User profile not found"),
    };
  }

  if (profile.status !== "active") {
    return {
      authenticated: false,
      response: forbiddenResponse(`Account is ${profile.status}`),
    };
  }

  const user: AuthUser = {
    id: profile.user_id,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    role: (profile.roles as UserRoleRow)?.name ?? "student",
    schoolId: profile.school_id,
    status: profile.status,
    emailVerified: profile.email_verified,
  };

  return { authenticated: true, user, supabase };
}

// ============================================================
// Authorize API request — checks permission after authentication
// ============================================================
export async function authorizeRequest(
  module: ModuleName,
  action: ActionName,
): Promise<
  | { authorized: true; user: AuthUser; supabase: any }
  | { authorized: false; response: NextResponse }
> {
  const authResult = await authenticateRequest();

  if (!authResult.authenticated) {
    return { authorized: false, response: authResult.response };
  }

  const { user, supabase } = authResult;

  if (!hasPermission(user.role, module, action)) {
    return {
      authorized: false,
      response: forbiddenResponse(
        `You do not have ${action} access to ${module}`,
      ),
    };
  }

  return { authorized: true, user, supabase };
}

// ============================================================
// Validate school scope in API request
// Ensures the request is scoped to the user's school
// ============================================================
export async function validateSchoolScope(
  user: AuthUser,
  requestSchoolId: string,
): Promise<{ valid: boolean; response?: NextResponse }> {
  // Super admin can access any school
  if (user.role === "super_admin") {
    return { valid: true };
  }

  if (user.schoolId !== requestSchoolId) {
    return {
      valid: false,
      response: forbiddenResponse("Cross-school access denied"),
    };
  }

  return { valid: true };
}
