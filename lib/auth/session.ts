// lib/auth/session.ts
// ============================================================
// Server-side session utilities
// Uses cookies to retrieve the current user
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthUser } from "@/types/auth";
import { RoleName } from "@/types/roles";

/**
 * Server Component / API Route utility to get the currently authenticated user
 * This must be used in a server-side context
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    // Fetch user profile with role from your custom 'users' table
    const { data: profile, error: profileError } = await supabase
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
      `
      )
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      return null;
    }

    return {
      id: profile.user_id,
      email: profile.email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      role: (profile.roles as any)?.name as RoleName,
      schoolId: profile.school_id,
      status: profile.status as AuthUser["status"],
      emailVerified: profile.email_verified,
    };
  } catch (error) {
    console.error("Session error:", error);
    return null;
  }
}
