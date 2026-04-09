export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiError, apiSuccess, validationErrorResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { updateSchoolProfileSchema } from "@/features/settings";
import {
  updateSchoolProfile,
} from "@/features/settings/services/school.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schoolId = user.schoolId || user.school_id;
    if (!schoolId) {
      return NextResponse.json({ error: "No school context" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("schools")
      .select("*")
      .eq("school_id", schoolId)
      .single();

    if (error) {
      console.error("School profile fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("School profile API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export const PUT = withPermission(
  { module: "settings", action: "edit" },
  async (request: NextRequest, user) => {
    try {
      const schoolId = user.school_id || user.schoolId;
      if (!schoolId) {
        return apiError("No school context", 400);
      }

      const validation = await validateBody(request, updateSchoolProfileSchema);
      if (!validation.success) {
        return validationErrorResponse(validation.errors!);
      }

      const result = await updateSchoolProfile(schoolId, validation.data);
      if (!result.success) {
        return apiError(result.message || "Failed to update school profile", 400);
      }

      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from("schools")
        .select("*")
        .eq("school_id", schoolId)
        .single();

      if (error) {
        return apiError(error.message, 500);
      }

      return apiSuccess(data, result.message);
    } catch (error) {
      console.error("School profile update API error:", error);
      return apiError("Internal server error", 500);
    }
  },
);
