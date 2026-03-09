// app/api/parent-consents/route.ts
// ============================================================
// GET /api/parent-consents - List consent records
// POST /api/parent-consents - Create/Update consent
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/withAuth";
import { validateBody, validateQuery } from "@/lib/api/validation";
import {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
  forbiddenResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================================
// Filter Schema
// ============================================================
const consentFiltersSchema = z.object({
  studentId: z.string().uuid().optional(),
  consentType: z.string().optional(),
  status: z.enum(["granted", "denied", "pending", "withdrawn"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// ============================================================
// Create/Update Schema
// ============================================================
const upsertConsentSchema = z.object({
  studentId: z.string().uuid(),
  consentType: z.string().min(1).max(100),
  status: z.enum(["granted", "denied", "pending", "withdrawn"]),
  notes: z.string().max(1000).optional(),
});

// ============================================================
// GET Handler
// ============================================================
export const GET = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url);

  const validation = validateQuery(searchParams, consentFiltersSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const filters = validation.data!;
  const { page, pageSize } = filters;
  const offset = (page - 1) * pageSize;

  const supabase = await createSupabaseServerClient();

  let query = supabase.from("parent_consents").select(
    `
      *,
      students (
        first_name,
        last_name,
        admission_number
      ),
      users!guardian_user_id (
        first_name,
        last_name
      )
    `,
    { count: "exact" },
  );

  if (user.role !== "super_admin") {
    query = query.eq("school_id", user.schoolId!);
  }

  // Parents see only their own consents
  if (user.role === "parent") {
    query = query.eq("guardian_user_id", user.id);
  }

  if (filters.studentId) {
    query = query.eq("student_id", filters.studentId);
  }
  if (filters.consentType) {
    query = query.eq("consent_type", filters.consentType);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    return errorResponse(`Failed to fetch consents: ${error.message}`);
  }

  return successResponse(data, {
    page,
    pageSize,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
  });
});

// ============================================================
// POST Handler
// ============================================================
export const POST = withAuth(async (request, { user }) => {
  // Parents can only manage their own children's consents
  // Admins can manage any consent

  const validation = await validateBody(request, upsertConsentSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const data = validation.data!;
  const supabase = await createSupabaseServerClient();

  // For parents, verify they are linked to this student
  if (user.role === "parent") {
    const { data: guardianLink } = await supabase
      .from("student_guardians")
      .select("id")
      .eq("guardian_user_id", user.id)
      .eq("student_id", data.studentId)
      .maybeSingle();

    if (!guardianLink) {
      return forbiddenResponse(
        "You can only manage consent for your own children",
      );
    }
  }

  const guardianUserId = user.role === "parent" ? user.id : user.id;

  // Upsert consent
  const { data: consent, error } = await (supabase
    .from("parent_consents") as any)
    .upsert(
      {
        school_id: user.schoolId!,
        student_id: data.studentId,
        guardian_user_id: guardianUserId,
        consent_type: data.consentType,
        status: data.status,
        date_given: data.status === "granted" ? new Date().toISOString() : null,
        date_withdrawn:
          data.status === "withdrawn" ? new Date().toISOString() : null,
        notes: data.notes || null,
      },
      {
        onConflict: "student_id,guardian_user_id,consent_type",
      },
    )
    .select("id")
    .single();

  if (error) {
    return errorResponse(`Failed to save consent: ${error.message}`);
  }

  return createdResponse({
    consentId: (consent as any).id,
    message: "Consent saved successfully",
  });
});
