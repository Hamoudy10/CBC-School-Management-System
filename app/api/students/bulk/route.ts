export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAcademicContext } from "@/app/api/students/_utils";

const bulkActionSchema = z
  .object({
    studentIds: z.array(z.string().uuid()).min(1).max(200),
    action: z.enum(["promote", "transfer", "status"]),
    targetClassId: z.string().uuid().optional(),
    status: z
      .enum(["active", "transferred", "graduated", "withdrawn", "suspended"])
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.action === "promote" || value.action === "transfer") &&
      !value.targetClassId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetClassId"],
        message: "Target class is required for this action.",
      });
    }

    if (value.action === "status" && !value.status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Status is required for this action.",
      });
    }
  });

export const POST = withPermission(
  "students",
  "update",
  async (request: NextRequest, { user }) => {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const parsed = bulkActionSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(
        parsed.error.errors.reduce<Record<string, string[]>>((acc, error) => {
          const key = error.path.join(".") || "bulk";
          acc[key] = [...(acc[key] ?? []), error.message];
          return acc;
        }, {}),
      );
    }

    if (!user.schoolId && user.role !== "super_admin") {
      return errorResponse("School context required", 403);
    }

    const supabase = await createSupabaseServerClient();
    const { action, studentIds, targetClassId, status } = parsed.data;

    let studentQuery = supabase
      .from("students")
      .select("student_id, school_id, current_class_id, status")
      .in("student_id", studentIds);

    if (user.role !== "super_admin") {
      studentQuery = studentQuery.eq("school_id", user.schoolId!);
    }

    const { data: students, error: studentsError } = await studentQuery;

    if (studentsError) {
      return errorResponse(studentsError.message, 500);
    }

    if (!students || students.length !== studentIds.length) {
      return errorResponse(
        "One or more selected students could not be found in your school context.",
        404,
      );
    }

    let destinationClass: {
      class_id: string;
      school_id: string;
      academic_year_id: string | null;
    } | null = null;

    if (targetClassId) {
      let classQuery = supabase
        .from("classes")
        .select("class_id, school_id, academic_year_id")
        .eq("class_id", targetClassId);

      if (user.role !== "super_admin") {
        classQuery = classQuery.eq("school_id", user.schoolId!);
      }

      const { data: classRecord, error: classError } = await classQuery.maybeSingle();

      if (classError) {
        return errorResponse(classError.message, 500);
      }

      if (!classRecord) {
        return errorResponse("Target class not found.", 404);
      }

      destinationClass = classRecord;
    }

    const context = await getCurrentAcademicContext(
      supabase,
      user.schoolId ?? null,
    );

    if ((action === "promote" || action === "transfer") && !destinationClass) {
      return errorResponse("Target class not found.", 404);
    }

    if (
      action === "promote" &&
      (!context.academicYear?.academic_year_id || !context.term?.term_id)
    ) {
      return errorResponse(
        "Promotion requires an active academic year and term.",
        400,
      );
    }

    const failedStudentIds: string[] = [];
    const skippedStudentIds: string[] = [];
    let processedCount = 0;

    for (const student of students) {
      try {
        if (
          (action === "promote" || action === "transfer") &&
          student.current_class_id === targetClassId
        ) {
          skippedStudentIds.push(student.student_id);
          continue;
        }

        if (action === "status" && student.status === status) {
          skippedStudentIds.push(student.student_id);
          continue;
        }

        if (action === "status") {
          const { error: updateError } = await supabase
            .from("students")
            .update({
              status,
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            })
            .eq("student_id", student.student_id);

          if (updateError) {
            failedStudentIds.push(student.student_id);
            continue;
          }

          processedCount += 1;
          continue;
        }

        const { error: updateError } = await supabase
          .from("students")
          .update({
            current_class_id: targetClassId,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("student_id", student.student_id);

        if (updateError) {
          failedStudentIds.push(student.student_id);
          continue;
        }

        if (context.academicYear?.academic_year_id) {
          const { error: historyError } = await supabase
            .from("student_classes")
            .insert({
              school_id: destinationClass!.school_id,
              student_id: student.student_id,
              class_id: targetClassId,
              academic_year_id:
                action === "promote"
                  ? context.academicYear.academic_year_id
                  : destinationClass!.academic_year_id ??
                    context.academicYear.academic_year_id,
              term_id: context.term?.term_id ?? null,
              status: "active",
            });

          if (historyError) {
            failedStudentIds.push(student.student_id);
            continue;
          }
        }

        processedCount += 1;
      } catch {
        failedStudentIds.push(student.student_id);
      }
    }

    return successResponse({
      action,
      processedCount,
      failedCount: failedStudentIds.length,
      skippedCount: skippedStudentIds.length,
      failedStudentIds,
      skippedStudentIds,
    });
  },
);
