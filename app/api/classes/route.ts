import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

async function ensureGradeExists(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  schoolId: string,
  rawGradeLevel: unknown,
) {
  const normalizedGradeLevel = String(rawGradeLevel ?? "").trim();
  const matchedDigits = normalizedGradeLevel.match(/\d+/);
  const parsedLevel = matchedDigits
    ? Number.parseInt(matchedDigits[0], 10)
    : Number.parseInt(normalizedGradeLevel, 10);

  if (!Number.isFinite(parsedLevel) || parsedLevel < 1 || parsedLevel > 12) {
    return { success: false as const, message: "Valid grade level is required" };
  }

  const { data: existingGrade, error: existingGradeError } = await supabase
    .from("grades")
    .select("grade_id")
    .eq("school_id", schoolId)
    .eq("level_order", parsedLevel)
    .maybeSingle();

  if (existingGradeError) {
    return { success: false as const, message: existingGradeError.message };
  }

  if (existingGrade) {
    return { success: true as const, gradeId: existingGrade.grade_id as string };
  }

  const { data: createdGrade, error: createGradeError } = await (supabase
    .from("grades") as any)
    .insert({
      school_id: schoolId,
      name: `Grade ${parsedLevel}`,
      level_order: parsedLevel,
    })
    .select("grade_id")
    .single();

  if (!createGradeError && createdGrade?.grade_id) {
    return { success: true as const, gradeId: createdGrade.grade_id as string };
  }

  const { data: retriedGrade, error: retriedGradeError } = await supabase
    .from("grades")
    .select("grade_id")
    .eq("school_id", schoolId)
    .eq("level_order", parsedLevel)
    .maybeSingle();

  if (retriedGradeError || !retriedGrade) {
    return {
      success: false as const,
      message:
        createGradeError?.message ||
        retriedGradeError?.message ||
        "Failed to create grade",
    };
  }

  return { success: true as const, gradeId: retriedGrade.grade_id as string };
}

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
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const academicYearId = searchParams.get("academic_year_id") || "";

    let query = supabase
      .from("classes")
      .select(
        `
        class_id,
        name,
        stream,
        capacity,
        academic_year_id,
        class_teacher_id,
        grade_id,
        is_active,
        academic_years (
          academic_year_id,
          year
        ),
        grades (
          grade_id,
          name,
          level_order
        ),
        class_teacher:users!classes_class_teacher_id_fkey (
          user_id,
          first_name,
          last_name
        ),
        student_count:student_classes(count)
      `,
      )
      .eq("school_id", schoolId)
      .order("name", { ascending: true });

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    if (academicYearId) {
      query = query.eq("academic_year_id", academicYearId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Classes fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const classes = (data || []).map((row: any) => ({
      class_id: row.class_id,
      class_name: row.name,
      grade_level: row.grades?.name ?? null,
      stream: row.stream,
      capacity: row.capacity,
      academic_year_id: row.academic_year_id,
      class_teacher_id: row.class_teacher_id,
      is_active: row.is_active,
      student_count: row.student_count?.[0]?.count ?? 0,
      academic_years: row.academic_years
        ? {
            academic_year_id: row.academic_years.academic_year_id,
            year_name: row.academic_years.year,
          }
        : null,
      class_teacher: row.class_teacher ?? null,
    }));

    return NextResponse.json({ data: classes });
  } catch (error) {
    console.error("Classes API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schoolId = user.schoolId || user.school_id;
    if (!schoolId) {
      return NextResponse.json({ error: "No school context" }, { status: 400 });
    }

    const body = await request.json();
    const supabase = await createServerSupabaseClient();

    const gradeResult = await ensureGradeExists(
      supabase,
      schoolId,
      body.grade_level,
    );
    if (!gradeResult.success) {
      return NextResponse.json(
        { error: gradeResult.message },
        { status: 400 },
      );
    }

    let academicYearId = body.academic_year_id || null;
    if (!academicYearId) {
      const { data: activeYear } = await supabase
        .from("academic_years")
        .select("academic_year_id")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .maybeSingle();

      academicYearId = activeYear?.academic_year_id ?? null;
    }

    if (!academicYearId) {
      return NextResponse.json(
        { error: "An active academic year is required before creating classes" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("classes")
      .insert({
        school_id: schoolId,
        name: body.class_name,
        academic_year_id: academicYearId,
        class_teacher_id: body.class_teacher_id || null,
        capacity: body.capacity || null,
        stream: body.stream || null,
        grade_id: gradeResult.gradeId,
      })
      .select()
      .single();

    if (error) {
      console.error("Class create error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Classes POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
