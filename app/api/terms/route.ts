import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

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
    const academicYearId = searchParams.get("academic_year_id") || "";

    let query = supabase
      .from("terms")
      .select(
        `
        *,
        academic_years (
          academic_year_id,
          year
        )
      `,
      )
      .eq("school_id", schoolId)
      .order("start_date", { ascending: false });

    if (academicYearId) {
      query = query.eq("academic_year_id", academicYearId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Terms fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const terms = (data || []).map((term: any) => ({
      ...term,
      academic_years: term.academic_years
        ? {
            ...term.academic_years,
            year_name: term.academic_years.year,
          }
        : null,
    }));

    return NextResponse.json({ data: terms });
  } catch (error) {
    console.error("Terms API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
