// app/api/parent-consents/[id]/route.ts
// ============================================================
// GET /api/parent-consents/:id - Get consent details
// PUT /api/parent-consents/:id - Update consent
// DELETE /api/parent-consents/:id - Delete consent
// ============================================================

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { validateBody, validateUuid } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  forbiddenResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateConsentSchema = z.object({
  status: z.enum(["granted", "denied", "pending", "withdrawn"]).optional(),
  notes: z.string().max(1000).optional(),
});

export const GET = withAuth(async (request, { user, params }) => {
  const consentId = params?.id;
  if (!consentId) {
    return notFoundResponse("Consent ID required");
  }

  const validation = validateUuid(consentId);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  try {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("parent_consents")
      .select(
        `
        *,
        students (
          first_name,
          last_name,
          admission_number
        ),
        guardian:users!guardian_user_id (
          first_name,
          last_name,
          email
        )
      `
      )
      .eq("id", consentId);

    if (user.role !== "super_admin") {
      query = query.eq("school_id", user.schoolId!);
    }

    if (user.role === "parent") {
      query = query.eq("guardian_user_id", user.id);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      return notFoundResponse("Consent record not found");
    }

    return successResponse(data);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load consent record.",
      500
    );
  }
});

export const PUT = withAuth(async (request, { user, params }) => {
  const consentId = params?.id;
  if (!consentId) {
    return notFoundResponse("Consent ID required");
  }

  const idValidation = validateUuid(consentId);
  if (!idValidation.success) {
    return validationErrorResponse(idValidation.errors!);
  }

  const bodyValidation = await validateBody(request, updateConsentSchema);
  if (!bodyValidation.success) {
    return validationErrorResponse(bodyValidation.errors!);
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("parent_consents")
      .select("id, school_id, guardian_user_id, student_id, status")
      .eq("id", consentId)
      .maybeSingle();

    if (!existing) {
      return notFoundResponse("Consent record not found");
    }

    if (user.role !== "super_admin" && existing.school_id !== user.schoolId) {
      return forbiddenResponse("Access denied");
    }

    if (user.role === "parent" && existing.guardian_user_id !== user.id) {
      return forbiddenResponse("You can only update your own consent records");
    }

    const updateData: Record<string, unknown> = {};
    if (bodyValidation.data.status !== undefined) {
      updateData.status = bodyValidation.data.status;
      if (bodyValidation.data.status === "granted") {
        updateData.date_given = new Date().toISOString();
      }
      if (bodyValidation.data.status === "withdrawn") {
        updateData.date_withdrawn = new Date().toISOString();
      }
    }
    if (bodyValidation.data.notes !== undefined) {
      updateData.notes = bodyValidation.data.notes || null;
    }

    const { error } = await supabase
      .from("parent_consents")
      .update(updateData)
      .eq("id", consentId);

    if (error) {
      return errorResponse(`Failed to update consent: ${error.message}`, 500);
    }

    return successResponse({ message: "Consent updated successfully." });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to update consent.",
      500
    );
  }
});

export const DELETE = withAuth(async (request, { user, params }) => {
  const consentId = params?.id;
  if (!consentId) {
    return notFoundResponse("Consent ID required");
  }

  const validation = validateUuid(consentId);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("parent_consents")
      .select("id, school_id, guardian_user_id")
      .eq("id", consentId)
      .maybeSingle();

    if (!existing) {
      return notFoundResponse("Consent record not found");
    }

    if (user.role !== "super_admin" && existing.school_id !== user.schoolId) {
      return forbiddenResponse("Access denied");
    }

    if (user.role === "parent" && existing.guardian_user_id !== user.id) {
      return forbiddenResponse("You can only delete your own consent records");
    }

    const { error } = await supabase
      .from("parent_consents")
      .delete()
      .eq("id", consentId);

    if (error) {
      return errorResponse(`Failed to delete consent: ${error.message}`, 500);
    }

    return successResponse({ message: "Consent record deleted successfully." });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to delete consent.",
      500
    );
  }
});
