import { NextRequest } from "next/server";
import { z } from "zod";
import {
  STUDENT_WRITE_ROLES,
  errorResponse,
  getCurrentAcademicContext,
  getStudentRequestContext,
  successResponse,
} from "@/app/api/students/_utils";
import { studentsService } from "@/features/students/services/students.service";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const lifecycleActionSchema = z.object({
  action: z.enum(["promote", "transfer"]),
  targetClassId: z.string().uuid(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return errorResponse("Invalid student identifier", 400);
  }

  const context = await getStudentRequestContext(
    parsedParams.data.id,
    STUDENT_WRITE_ROLES,
  );
  if ("error" in context) {
    return context.error;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = lifecycleActionSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      parsed.error.errors[0]?.message || "Invalid student lifecycle payload",
      422,
    );
  }

  const { action, targetClassId } = parsed.data;

  if (context.student.status !== "active") {
    return errorResponse(
      "Only active students can be promoted or transferred from this workflow.",
      400,
    );
  }

  if (!context.student.current_class_id) {
    return errorResponse(
      "This student does not currently have a class assignment.",
      400,
    );
  }

  if (context.student.current_class_id === targetClassId) {
    return errorResponse("Choose a different destination class.", 400);
  }

  let classQuery = context.supabase
    .from("classes")
    .select("class_id")
    .eq("class_id", targetClassId);

  if (context.user.role !== "super_admin" && context.schoolId) {
    classQuery = classQuery.eq("school_id", context.schoolId);
  }

  const { data: targetClass, error: classError } = await classQuery.maybeSingle();
  if (classError) {
    return errorResponse(classError.message, 500);
  }

  if (!targetClass) {
    return errorResponse(
      "Destination class not found in the current school context.",
      404,
    );
  }

  try {
    if (action === "transfer") {
      const student = await studentsService.transferStudent(
        {
          studentId: parsedParams.data.id,
          toClassId: targetClassId,
        },
        context.user,
      );

      return successResponse(
        {
          action,
          student,
        },
        "Student transferred successfully",
      );
    }

    const academicContext = await getCurrentAcademicContext(
      context.supabase,
      context.schoolId,
    );

    if (
      !academicContext.academicYear?.academic_year_id ||
      !academicContext.term?.term_id
    ) {
      return errorResponse(
        "Promotion requires an active academic year and term.",
        400,
      );
    }

    const result = await studentsService.promoteStudents(
      {
        studentIds: [parsedParams.data.id],
        fromClassId: context.student.current_class_id,
        toClassId: targetClassId,
        academicYearId: academicContext.academicYear.academic_year_id,
        termId: academicContext.term.term_id,
      },
      context.user,
    );

    if (result.failed.length > 0 || result.promoted === 0) {
      return errorResponse("Failed to promote student.", 500);
    }

    const student = await studentsService.getStudentById(
      parsedParams.data.id,
      context.user,
    );

    return successResponse(
      {
        action,
        student,
      },
      "Student promoted successfully",
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Failed to ${action} student`;
    return errorResponse(message, 400);
  }
}
