import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RawGrade = {
  grade_id?: string | null;
  name?: string | null;
  level_order?: number | null;
};

type RawClass = {
  class_id: string;
  name: string;
  stream?: string | null;
  grade_id?: string | null;
  grades?: RawGrade | RawGrade[] | null;
  student_count?: Array<{ count?: number | null }> | { count?: number | null } | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeClass(row: RawClass) {
  const grade = firstRelation(row.grades);
  const studentCountRelation = firstRelation(
    Array.isArray(row.student_count) ? row.student_count : row.student_count ? [row.student_count] : [],
  );

  return {
    classId: row.class_id,
    name: row.name,
    stream: row.stream ?? null,
    gradeId: row.grade_id ?? grade?.grade_id ?? null,
    gradeName: grade?.name ?? "",
    gradeLevel: grade?.level_order ?? null,
    studentCount: Number(studentCountRelation?.count ?? 0),
  };
}

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    if (!user.school_id) {
      return apiSuccess({
        classes: [],
        levels: [],
        academicYears: [],
        activeYear: null,
        activeTerm: null,
        termsByYear: {},
        learningAreas: [],
      });
    }

    const { searchParams } = new URL(request.url);
    const includeLearningAreas =
      searchParams.get("includeLearningAreas") === "true";
    const supabase = await createSupabaseServerClient();

    const queries = await Promise.all([
      supabase
        .from("classes")
        .select(
          `
          class_id,
          name,
          stream,
          grade_id,
          grades(name, level_order, grade_id),
          student_count:student_classes(count)
        `,
        )
        .eq("school_id", user.school_id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("academic_years")
        .select("academic_year_id, year, is_active")
        .eq("school_id", user.school_id)
        .order("year", { ascending: false }),
      supabase
        .from("terms")
        .select("term_id, name, academic_year_id, is_active")
        .eq("school_id", user.school_id)
        .order("start_date", { ascending: true }),
      includeLearningAreas
        ? supabase
            .from("learning_areas")
            .select("learning_area_id, name, is_core")
            .eq("school_id", user.school_id)
            .order("name")
        : Promise.resolve({ data: [], error: null }),
    ]);

    const [classesResult, yearsResult, termsResult, learningAreasResult] = queries;

    if (classesResult.error) {
      return apiError(classesResult.error.message, 500);
    }

    if (yearsResult.error) {
      return apiError(yearsResult.error.message, 500);
    }

    if (termsResult.error) {
      return apiError(termsResult.error.message, 500);
    }

    if (learningAreasResult.error) {
      return apiError(learningAreasResult.error.message, 500);
    }

    const classes = ((classesResult.data ?? []) as RawClass[])
      .map(normalizeClass)
      .sort(
        (left, right) =>
          (left.gradeLevel ?? Number.MAX_SAFE_INTEGER) -
            (right.gradeLevel ?? Number.MAX_SAFE_INTEGER) ||
          left.name.localeCompare(right.name),
      );

    const levels = Array.from(
      new Map(
        classes
          .filter((row) => row.gradeId)
          .map((row) => [
            row.gradeId,
            {
              gradeId: row.gradeId,
              name: row.gradeName || `Grade ${row.gradeLevel ?? ""}`.trim(),
              gradeLevel: row.gradeLevel,
            },
          ]),
      ).values(),
    ).sort(
      (left, right) =>
        (left.gradeLevel ?? Number.MAX_SAFE_INTEGER) -
        (right.gradeLevel ?? Number.MAX_SAFE_INTEGER),
    );

    const academicYears = (yearsResult.data ?? []).map((row: any) => ({
      id: row.academic_year_id,
      year: row.year,
      isActive: row.is_active ?? false,
    }));

    const activeYear =
      academicYears.find((row) => row.isActive) ?? academicYears[0] ?? null;

    const terms = (termsResult.data ?? []).map((row: any) => ({
      id: row.term_id,
      name: row.name,
      academicYearId: row.academic_year_id,
      isActive: row.is_active ?? false,
    }));

    const activeTerm = terms.find((row) => row.isActive) ?? null;
    const termsByYear = terms.reduce<Record<string, typeof terms>>((acc, term) => {
      if (!acc[term.academicYearId]) {
        acc[term.academicYearId] = [];
      }

      acc[term.academicYearId].push(term);
      return acc;
    }, {});

    const learningAreas = (learningAreasResult.data ?? []).map((row: any) => ({
      learningAreaId: row.learning_area_id,
      name: row.name,
      isCore: row.is_core ?? false,
    }));

    const response = apiSuccess({
      classes,
      levels,
      academicYears,
      activeYear,
      activeTerm,
      termsByYear,
      learningAreas,
    });

    response.headers.set(
      "Cache-Control",
      "private, max-age=60, stale-while-revalidate=300",
    );

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load reference data";
    return apiError(message, 500);
  }
});
