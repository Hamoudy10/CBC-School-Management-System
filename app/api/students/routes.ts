// app/api/students/route.ts
// ============================================================
// GET /api/students - List students (paginated, filtered)
// POST /api/students - Create new student
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateQuery } from "@/lib/api/validation";
import {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================================
// Filter Schema
// ============================================================
const studentFiltersSchema = z.object({
  search: z.string().optional(),
  classId: z.string().uuid().optional(),
  gradeId: z.string().uuid().optional(),
  status: z
    .enum(["active", "transferred", "graduated", "withdrawn", "suspended"])
    .optional(),
  academicYearId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// Create Schema
// ============================================================
const createStudentSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(["male", "female", "other"]),
  admissionNumber: z.string().min(1).max(50).optional(),
  currentClassId: z.string().uuid().optional(),
  enrollmentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  hasSpecialNeeds: z.boolean().default(false),
  specialNeedsDetails: z.string().optional(),
  previousSchool: z.string().optional(),
  nemisNumber: z.string().optional(),
  birthCertificateNo: z.string().optional(),
});

// ============================================================
// GET Handler - List Students
// ============================================================
export const GET = withPermission(
  "students",
  "view",
  async (request, { user }) => {
    const { searchParams } = new URL(request.url);

    const validation = validateQuery(searchParams, studentFiltersSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const filters = validation.data!;
    const { page, pageSize } = filters;
    const offset = (page - 1) * pageSize;

    const supabase = await createSupabaseServerClient();

    let query = supabase.from("students").select(
      `
      *,
      classes (
        name,
        grades (
          name
        )
      )
    `,
      { count: "exact" },
    );

    // School scoping
    if (user.role !== "super_admin") {
      query = query.eq("school_id", user.schoolId!);
    }

    // Filters
    if (filters.search) {
      query = query.or(
        `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,admission_number.ilike.%${filters.search}%`,
      );
    }
    if (filters.classId) {
      query = query.eq("current_class_id", filters.classId);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    // Pagination
    query = query
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
      .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      return errorResponse(`Failed to fetch students: ${error.message}`);
    }

    const total = count || 0;

    return successResponse(data, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  },
);

// ============================================================
// POST Handler - Create Student
// ============================================================
export const POST = withPermission(
  "students",
  "create",
  async (request, { user }) => {
    const validation = await validateBody(request, createStudentSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const data = validation.data!;
    const supabase = await createSupabaseServerClient();
    const schoolId = user.schoolId!;

    // Generate admission number if not provided
    let admissionNumber = data.admissionNumber;
    if (!admissionNumber) {
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from("students")
        .select("student_id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .gte("enrollment_date", `${year}-01-01`);

      admissionNumber = `ADM-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
    }

    const { data: student, error } = await (supabase
      .from("students") as any)
      .insert({
        school_id: schoolId,
        first_name: data.firstName,
        last_name: data.lastName,
        middle_name: data.middleName || null,
        date_of_birth: data.dateOfBirth,
        gender: data.gender,
        admission_number: admissionNumber,
        current_class_id: data.currentClassId || null,
        enrollment_date:
          data.enrollmentDate || new Date().toISOString().split("T")[0],
        status: "active",
        has_special_needs: data.hasSpecialNeeds,
        special_needs_details: data.specialNeedsDetails || null,
        previous_school: data.previousSchool || null,
        nemis_number: data.nemisNumber || null,
        birth_certificate_no: data.birthCertificateNo || null,
        created_by: user.id,
      })
      .select("student_id, admission_number")
      .single();

    if (error) {
      return errorResponse(`Failed to create student: ${error.message}`);
    }

    return createdResponse({
      studentId: (student as any).student_id,
      admissionNumber: (student as any).admission_number,
      message: "Student created successfully",
    });
  },
);
