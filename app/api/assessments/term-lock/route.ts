export const dynamic = 'force-dynamic';

// app/api/assessments/term-lock/route.ts
// ============================================================
// GET /api/assessments/term-lock - Check if current term is locked for assessment edits
// POST /api/assessments/term-lock - Lock/unlock term for assessment edits
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateQuery } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  forbiddenResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const lockSchema = z.object({
  termId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  locked: z.boolean(),
  reason: z.string().max(500).optional(),
});

const querySchema = z.object({
  termId: z.string().uuid(),
  academicYearId: z.string().uuid(),
});

const ADMIN_ROLES = new Set(["super_admin", "school_admin", "principal"]);

export const GET = withPermission(
  "assessments",
  "view",
  async (request: NextRequest, { user }) => {
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(searchParams, querySchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const { termId, academicYearId } = validation.data!;

    try {
      const supabase = await createSupabaseServerClient();

      if (!user.schoolId) {
        return errorResponse("School context is required.", 400);
      }

      // Check if term is locked
      const { data: lockRecord, error } = await supabase
        .from("term_locks")
        .select("lock_id, locked_at, locked_by, reason")
        .eq("term_id", termId)
        .eq("academic_year_id", academicYearId)
        .eq("school_id", user.schoolId)
        .eq("is_active", true)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        return errorResponse(`Failed to check lock status: ${error.message}`, 500);
      }

      // Get term info
      const { data: term } = await supabase
        .from("terms")
        .select("term_id, name, is_active")
        .eq("term_id", termId)
        .eq("school_id", user.schoolId)
        .maybeSingle();

      return successResponse({
        termId,
        termName: term?.name,
        isLocked: !!lockRecord,
        lockedAt: lockRecord?.locked_at,
        lockedBy: lockRecord?.locked_by,
        reason: lockRecord?.reason,
        isCurrentTerm: term?.is_active ?? false,
      });
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to check term lock status.",
        500
      );
    }
  },
);

export const POST = withPermission(
  "assessments",
  "update",
  async (request: NextRequest, { user }) => {
    // Only admin roles can lock/unlock terms
    if (!ADMIN_ROLES.has(user.role)) {
      return forbiddenResponse("Only administrators can lock or unlock assessment terms.");
    }

    const validation = await validateBody(request, lockSchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const { termId, academicYearId, locked, reason } = validation.data!;

    try {
      const supabase = await createSupabaseServerClient();

      if (!user.schoolId) {
        return errorResponse("School context is required.", 400);
      }

      // Verify term exists
      const { data: term } = await supabase
        .from("terms")
        .select("term_id, name")
        .eq("term_id", termId)
        .eq("academic_year_id", academicYearId)
        .eq("school_id", user.schoolId)
        .maybeSingle();

      if (!term) {
        return errorResponse("Term not found for this school and academic year.", 404);
      }

      if (locked) {
        // Lock the term
        const { data: existingLock } = await supabase
          .from("term_locks")
          .select("lock_id")
          .eq("term_id", termId)
          .eq("academic_year_id", academicYearId)
          .eq("school_id", user.schoolId)
          .eq("is_active", true)
          .maybeSingle();

        if (existingLock) {
          return errorResponse("This term is already locked.", 409);
        }

        const { error } = await supabase
          .from("term_locks")
          .insert({
            school_id: user.schoolId,
            term_id: termId,
            academic_year_id: academicYearId,
            locked_by: user.id,
            reason: reason ?? null,
            is_active: true,
          });

        if (error) {
          return errorResponse(`Failed to lock term: ${error.message}`, 500);
        }

        return successResponse({
          message: `Term "${term.name}" is now locked. Assessment edits are restricted.`,
          isLocked: true,
        });
      } else {
        // Unlock the term
        const { error } = await supabase
          .from("term_locks")
          .update({ is_active: false })
          .eq("term_id", termId)
          .eq("academic_year_id", academicYearId)
          .eq("school_id", user.schoolId)
          .eq("is_active", true);

        if (error) {
          return errorResponse(`Failed to unlock term: ${error.message}`, 500);
        }

        return successResponse({
          message: `Term "${term.name}" is now unlocked. Assessment edits are allowed.`,
          isLocked: false,
        });
      }
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to update term lock.",
        500
      );
    }
  },
);
