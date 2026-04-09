export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.schoolId && !user?.school_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schoolId = user.schoolId || user.school_id;
    const supabase = await createServerSupabaseClient();

    const { data: students, error } = await supabase
      .from("students")
      .select("status, gender, has_special_needs, enrollment_date")
      .eq("school_id", schoolId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const stats = {
      total: students?.length ?? 0,
      active: 0,
      transferred: 0,
      graduated: 0,
      withdrawn: 0,
      suspended: 0,
      byGender: {
        male: 0,
        female: 0,
        other: 0,
      },
      byGrade: [],
      withSpecialNeeds: 0,
      newEnrollmentsThisTerm: 0,
    };

    for (const student of students || []) {
      if (student.status === "active") {stats.active += 1;}
      if (student.status === "transferred") {stats.transferred += 1;}
      if (student.status === "graduated") {stats.graduated += 1;}
      if (student.status === "withdrawn") {stats.withdrawn += 1;}
      if (student.status === "suspended") {stats.suspended += 1;}

      if (student.gender === "male") {stats.byGender.male += 1;}
      else if (student.gender === "female") {stats.byGender.female += 1;}
      else {stats.byGender.other += 1;}

      if (student.has_special_needs) {stats.withSpecialNeeds += 1;}

      if (student.enrollment_date) {
        const enrollmentDate = new Date(student.enrollment_date);
        if (
          enrollmentDate.getFullYear() === currentYear &&
          enrollmentDate.getMonth() === currentMonth
        ) {
          stats.newEnrollmentsThisTerm += 1;
        }
      }
    }

    return NextResponse.json({ data: stats });
  } catch {
    return NextResponse.json(
      { error: "Failed to load student stats" },
      { status: 500 },
    );
  }
}
