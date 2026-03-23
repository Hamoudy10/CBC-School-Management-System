import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AttendanceFilters,
  AttendanceRecord,
  AttendanceStats,
  AttendanceStatus,
  BulkAttendanceEntry,
  ClassAttendanceSummary,
  DailyAttendanceReport,
  DailySchoolAttendance,
  SchoolClassAttendanceSummary,
  StudentAttendanceSummary,
} from "../types";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type AttendanceRow = {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  term_id: string;
  date: string;
  status: AttendanceStatus;
  reason: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
  arrival_time?: string | null;
  student?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  class?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  recorder?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  term?: Record<string, unknown> | Array<Record<string, unknown>> | null;
};

type AttendanceContext = {
  termId: string | null;
  academicYearId: string | null;
};

type RosterStudent = {
  student_id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
};

const ATTENDANCE_SELECT = `
  id,
  school_id,
  student_id,
  class_id,
  term_id,
  date,
  status,
  reason,
  recorded_by,
  created_at,
  updated_at,
  arrival_time,
  student:students(student_id, first_name, last_name, admission_number, photo_url),
  class:classes(class_id, name, stream),
  recorder:users(user_id, first_name, last_name),
  term:terms(term_id, name, academic_year_id)
`;

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toAttendanceRate(present: number, late: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((((present + late) / total) * 100 + Number.EPSILON) * 10) / 10;
}

function buildStats(
  total: number,
  records: Array<{ status: AttendanceStatus | null }>,
): AttendanceStats {
  const present = records.filter((row) => row.status === "present").length;
  const absent = records.filter((row) => row.status === "absent").length;
  const late = records.filter((row) => row.status === "late").length;
  const excused = records.filter((row) => row.status === "excused").length;

  return {
    total,
    present,
    absent,
    late,
    excused,
    attendance_rate: toAttendanceRate(present, late, total),
  };
}

function normalizeAttendanceRow(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    student_id: row.student_id,
    class_id: row.class_id,
    term_id: row.term_id,
    date: row.date,
    status: row.status,
    reason: row.reason ?? null,
    arrival_time: row.arrival_time ?? null,
    recorded_by: row.recorded_by,
    school_id: row.school_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    student: firstRelation(row.student) as AttendanceRecord["student"],
    class: firstRelation(row.class) as AttendanceRecord["class"],
    recorder: firstRelation(row.recorder) as AttendanceRecord["recorder"],
    term: firstRelation(row.term) as AttendanceRecord["term"],
  };
}

async function resolveAttendanceContext(
  supabase: SupabaseClient,
  schoolId: string,
  date?: string,
): Promise<AttendanceContext> {
  if (date) {
    const { data: datedTerm } = await supabase
      .from("terms")
      .select("term_id, academic_year_id")
      .eq("school_id", schoolId)
      .lte("start_date", date)
      .gte("end_date", date)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (datedTerm) {
      return {
        termId: datedTerm.term_id,
        academicYearId: datedTerm.academic_year_id,
      };
    }
  }

  const { data: activeTerm } = await supabase
    .from("terms")
    .select("term_id, academic_year_id")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeTerm) {
    return {
      termId: activeTerm.term_id,
      academicYearId: activeTerm.academic_year_id,
    };
  }

  const { data: latestTerm } = await supabase
    .from("terms")
    .select("term_id, academic_year_id")
    .eq("school_id", schoolId)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    termId: latestTerm?.term_id ?? null,
    academicYearId: latestTerm?.academic_year_id ?? null,
  };
}

async function getRosterForClass(
  supabase: SupabaseClient,
  schoolId: string,
  classId: string,
  context: AttendanceContext,
): Promise<RosterStudent[]> {
  let rosterQuery = supabase
    .from("student_classes")
    .select(
      `
      student_id,
      students!inner(
        student_id,
        admission_number,
        first_name,
        last_name,
        photo_url,
        status
      )
    `,
    )
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("status", "active");

  if (context.termId) {
    rosterQuery = rosterQuery.eq("term_id", context.termId);
  }

  if (context.academicYearId) {
    rosterQuery = rosterQuery.eq("academic_year_id", context.academicYearId);
  }

  const { data: rosterRows, error: rosterError } = await rosterQuery;
  if (rosterError) {
    throw new Error(rosterError.message);
  }

  const roster = (rosterRows ?? [])
    .map((row: any) => firstRelation(row.students))
    .filter((student: any) => student && student.status === "active")
    .map(
      (student: any): RosterStudent => ({
        student_id: student.student_id,
        admission_number: student.admission_number ?? "",
        first_name: student.first_name ?? "",
        last_name: student.last_name ?? "",
        photo_url: student.photo_url ?? null,
      }),
    );

  if (roster.length > 0) {
    return roster;
  }

  const { data: fallbackRows, error: fallbackError } = await supabase
    .from("students")
    .select("student_id, admission_number, first_name, last_name, photo_url")
    .eq("school_id", schoolId)
    .eq("current_class_id", classId)
    .eq("status", "active")
    .order("first_name", { ascending: true });

  if (fallbackError) {
    throw new Error(fallbackError.message);
  }

  return (fallbackRows ?? []) as RosterStudent[];
}

async function getAttendanceRowsForDate(
  supabase: SupabaseClient,
  schoolId: string,
  date: string,
  classId?: string,
  termId?: string | null,
) {
  let query = supabase
    .from("attendance")
    .select(ATTENDANCE_SELECT)
    .eq("school_id", schoolId)
    .eq("date", date);

  if (classId) {
    query = query.eq("class_id", classId);
  }

  if (termId) {
    query = query.eq("term_id", termId);
  }

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AttendanceRow[]).map(normalizeAttendanceRow);
}

async function getTermIdsForAcademicYear(
  supabase: SupabaseClient,
  schoolId: string,
  academicYearId: string,
) {
  const { data, error } = await supabase
    .from("terms")
    .select("term_id")
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => row.term_id as string);
}

async function getClassRows(
  supabase: SupabaseClient,
  schoolId: string,
  academicYearId?: string | null,
) {
  let query = supabase
    .from("classes")
    .select(
      `
      class_id,
      name,
      stream,
      academic_year_id,
      grade:grades(name, level_order)
    `,
    )
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (academicYearId) {
    query = query.eq("academic_year_id", academicYearId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getAttendanceById(
  attendanceId: string,
  schoolId: string,
): Promise<{ success: boolean; data?: AttendanceRecord; message?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("attendance")
      .select(ATTENDANCE_SELECT)
      .eq("id", attendanceId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (error) {
      return { success: false, message: error.message };
    }

    if (!data) {
      return { success: false, message: "Attendance record not found" };
    }

    return { success: true, data: normalizeAttendanceRow(data as AttendanceRow) };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch attendance",
    };
  }
}

export async function recordAttendance(entry: {
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  reason?: string | null;
  arrival_time?: string | null;
  recorded_by: string;
  school_id: string;
  term_id?: string | null;
}): Promise<{ success: boolean; id?: string; message: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const context = entry.term_id
      ? { termId: entry.term_id, academicYearId: null }
      : await resolveAttendanceContext(supabase, entry.school_id, entry.date);

    if (!context.termId) {
      return { success: false, message: "No active term found for the selected date" };
    }

    const payload = {
      student_id: entry.student_id,
      class_id: entry.class_id,
      date: entry.date,
      status: entry.status,
      reason: entry.reason ?? null,
      arrival_time: entry.arrival_time ?? null,
      recorded_by: entry.recorded_by,
      school_id: entry.school_id,
      term_id: context.termId,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: existingError } = await supabase
      .from("attendance")
      .select("id")
      .eq("school_id", entry.school_id)
      .eq("student_id", entry.student_id)
      .eq("date", entry.date)
      .maybeSingle();

    if (existingError) {
      return { success: false, message: existingError.message };
    }

    if (existing?.id) {
      const { error } = await supabase
        .from("attendance")
        .update(payload)
        .eq("id", existing.id)
        .eq("school_id", entry.school_id);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, id: existing.id, message: "Attendance updated" };
    }

    const { data, error } = await supabase
      .from("attendance")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, id: data.id, message: "Attendance recorded" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to record attendance",
    };
  }
}

export async function updateAttendance(
  attendanceId: string,
  schoolId: string,
  updates: {
    class_id?: string;
    date?: string;
    status?: AttendanceStatus;
    reason?: string | null;
    arrival_time?: string | null;
    term_id?: string | null;
    recorded_by: string;
  },
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: existing, error: existingError } = await supabase
      .from("attendance")
      .select("id, date")
      .eq("id", attendanceId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (existingError) {
      return { success: false, message: existingError.message };
    }

    if (!existing) {
      return { success: false, message: "Attendance record not found" };
    }

    const nextDate = updates.date ?? existing.date;
    const context = updates.term_id
      ? { termId: updates.term_id, academicYearId: null }
      : await resolveAttendanceContext(supabase, schoolId, nextDate);

    if (!context.termId) {
      return { success: false, message: "No active term found for the selected date" };
    }

    const payload: Record<string, unknown> = {
      recorded_by: updates.recorded_by,
      updated_at: new Date().toISOString(),
      term_id: context.termId,
    };

    if (updates.class_id !== undefined) {
      payload.class_id = updates.class_id;
    }
    if (updates.date !== undefined) {
      payload.date = updates.date;
    }
    if (updates.status !== undefined) {
      payload.status = updates.status;
    }
    if (updates.reason !== undefined) {
      payload.reason = updates.reason;
    }
    if (updates.arrival_time !== undefined) {
      payload.arrival_time = updates.arrival_time;
    }

    const { error } = await supabase
      .from("attendance")
      .update(payload)
      .eq("id", attendanceId)
      .eq("school_id", schoolId);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: "Attendance updated" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update attendance",
    };
  }
}

export async function deleteAttendance(
  attendanceId: string,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("id", attendanceId)
      .eq("school_id", schoolId);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: "Attendance deleted" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete attendance",
    };
  }
}

export async function recordBulkAttendance(
  entries: BulkAttendanceEntry,
  schoolId: string,
  recordedBy: string,
): Promise<{
  success: boolean;
  message: string;
  recorded: number;
  updated: number;
}> {
  try {
    if (entries.entries.length === 0) {
      return { success: false, message: "No attendance entries provided", recorded: 0, updated: 0 };
    }

    const supabase = await createSupabaseServerClient();
    const context = entries.term_id
      ? { termId: entries.term_id, academicYearId: null }
      : await resolveAttendanceContext(supabase, schoolId, entries.date);

    if (!context.termId) {
      return { success: false, message: "No active term found for the selected date", recorded: 0, updated: 0 };
    }

    const roster = await getRosterForClass(supabase, schoolId, entries.class_id, context);
    const rosterIds = new Set(roster.map((student) => student.student_id));
    const filteredEntries = entries.entries.filter((entry) => rosterIds.has(entry.student_id));

    if (filteredEntries.length === 0) {
      return {
        success: false,
        message: "No valid students found in the selected class",
        recorded: 0,
        updated: 0,
      };
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("attendance")
      .select("id, student_id")
      .eq("school_id", schoolId)
      .eq("class_id", entries.class_id)
      .eq("date", entries.date)
      .in(
        "student_id",
        filteredEntries.map((entry) => entry.student_id),
      );

    if (existingError) {
      return { success: false, message: existingError.message, recorded: 0, updated: 0 };
    }

    const existingIds = new Set((existingRows ?? []).map((row: any) => row.student_id));
    const rows = filteredEntries.map((entry) => ({
      school_id: schoolId,
      student_id: entry.student_id,
      class_id: entries.class_id,
      term_id: context.termId,
      date: entries.date,
      status: entry.status,
      reason: entry.reason ?? null,
      arrival_time: entry.arrival_time ?? null,
      recorded_by: recordedBy,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("attendance")
      .upsert(rows, { onConflict: "student_id,date" });

    if (error) {
      return { success: false, message: error.message, recorded: 0, updated: 0 };
    }

    const updated = filteredEntries.filter((entry) => existingIds.has(entry.student_id)).length;
    const recorded = filteredEntries.length - updated;

    return {
      success: true,
      message: `Processed ${filteredEntries.length} attendance records`,
      recorded,
      updated,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to record bulk attendance",
      recorded: 0,
      updated: 0,
    };
  }
}

export async function getAttendanceList(
  filters: AttendanceFilters,
  schoolId: string,
  page = 1,
  pageSize = 50,
): Promise<{
  success: boolean;
  data: AttendanceRecord[];
  total: number;
  message?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(1, pageSize), 200);
    const offset = (safePage - 1) * safePageSize;

    let query = supabase
      .from("attendance")
      .select(ATTENDANCE_SELECT, { count: "exact" })
      .eq("school_id", schoolId);

    if (filters.student_id) {
      query = query.eq("student_id", filters.student_id);
    }
    if (filters.class_id) {
      query = query.eq("class_id", filters.class_id);
    }
    if (filters.date) {
      query = query.eq("date", filters.date);
    }
    if (filters.date_from) {
      query = query.gte("date", filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte("date", filters.date_to);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    const termId = filters.term_id ?? filters.term;
    if (termId) {
      query = query.eq("term_id", termId);
    }

    const academicYearId = filters.academic_year_id ?? filters.academic_year;
    if (academicYearId) {
      const termIds = await getTermIdsForAcademicYear(supabase, schoolId, academicYearId);
      if (termIds.length === 0) {
        return { success: true, data: [], total: 0 };
      }

      query = query.in("term_id", termIds);
    }

    const { data, error, count } = await query
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + safePageSize - 1);

    if (error) {
      return { success: false, data: [], total: 0, message: error.message };
    }

    return {
      success: true,
      data: ((data ?? []) as AttendanceRow[]).map(normalizeAttendanceRow),
      total: count ?? 0,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      total: 0,
      message: error instanceof Error ? error.message : "Failed to fetch attendance",
    };
  }
}

export async function getClassAttendanceForDate(
  classId: string,
  date: string,
  schoolId: string,
): Promise<{
  success: boolean;
  data: Array<
    AttendanceRecord & {
      full_name: string;
      admission_number: string;
      photo_url: string | null;
      record_id: string | null;
    }
  >;
  stats: AttendanceStats;
  message?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const context = await resolveAttendanceContext(supabase, schoolId, date);
    const roster = await getRosterForClass(supabase, schoolId, classId, context);
    const records = await getAttendanceRowsForDate(supabase, schoolId, date, classId, context.termId);
    const recordMap = new Map(records.map((record) => [record.student_id, record]));

    const merged = roster.map((student) => {
      const record = recordMap.get(student.student_id);

      return {
        id: record?.id ?? "",
        record_id: record?.id ?? null,
        school_id: schoolId,
        student_id: student.student_id,
        class_id: classId,
        term_id: record?.term_id ?? context.termId ?? "",
        date,
        status: record?.status ?? null,
        reason: record?.reason ?? null,
        arrival_time: record?.arrival_time ?? null,
        recorded_by: record?.recorded_by ?? "",
        created_at: record?.created_at ?? "",
        updated_at: record?.updated_at ?? "",
        student: {
          student_id: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          admission_number: student.admission_number,
          photo_url: student.photo_url,
        },
        class: null,
        recorder: null,
        term: null,
        full_name: `${student.first_name} ${student.last_name}`.trim(),
        admission_number: student.admission_number,
        photo_url: student.photo_url,
      };
    });

    return {
      success: true,
      data: merged as Array<
        AttendanceRecord & {
          full_name: string;
          admission_number: string;
          photo_url: string | null;
          record_id: string | null;
        }
      >,
      stats: buildStats(roster.length, records),
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      stats: buildStats(0, []),
      message: error instanceof Error ? error.message : "Failed to fetch class attendance",
    };
  }
}

export async function getStudentAttendanceSummary(
  studentId: string,
  schoolId: string,
  termId?: string,
  academicYearId?: string,
): Promise<{
  success: boolean;
  data?: StudentAttendanceSummary;
  message?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("attendance")
      .select("student_id, date, status, term_id")
      .eq("student_id", studentId)
      .eq("school_id", schoolId)
      .order("date", { ascending: true });

    if (termId) {
      query = query.eq("term_id", termId);
    } else if (academicYearId) {
      const termIds = await getTermIdsForAcademicYear(supabase, schoolId, academicYearId);
      if (termIds.length === 0) {
        return {
          success: true,
          data: {
            student_id: studentId,
            total_days: 0,
            present_days: 0,
            absent_days: 0,
            late_days: 0,
            excused_days: 0,
            attendance_rate: 0,
            monthly_breakdown: [],
            consecutive_absences: [],
          },
        };
      }

      query = query.in("term_id", termIds);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, message: error.message };
    }

    const records = (data ?? []) as Array<{ student_id: string; date: string; status: AttendanceStatus }>;
    const totalDays = records.length;
    const presentDays = records.filter((row) => row.status === "present").length;
    const absentDays = records.filter((row) => row.status === "absent").length;
    const lateDays = records.filter((row) => row.status === "late").length;
    const excusedDays = records.filter((row) => row.status === "excused").length;

    const monthlyMap = new Map<
      string,
      { present: number; absent: number; late: number; excused: number; total: number }
    >();

    for (const record of records) {
      const month = record.date.slice(0, 7);
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { present: 0, absent: 0, late: 0, excused: 0, total: 0 });
      }

      const monthStats = monthlyMap.get(month)!;
      monthStats.total += 1;
      monthStats[record.status] += 1;
    }

    const monthly_breakdown = Array.from(monthlyMap.entries()).map(([month, stats]) => ({
      month,
      ...stats,
      attendance_rate: toAttendanceRate(stats.present, stats.late, stats.total),
    }));

    const consecutive_absences: StudentAttendanceSummary["consecutive_absences"] = [];
    let streakStart: string | null = null;
    let streakDays = 0;

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];

      if (record.status === "absent") {
        streakStart = streakStart ?? record.date;
        streakDays += 1;
        continue;
      }

      if (streakStart && streakDays >= 3) {
        consecutive_absences.push({
          start_date: streakStart,
          end_date: records[index - 1]?.date ?? streakStart,
          days: streakDays,
        });
      }

      streakStart = null;
      streakDays = 0;
    }

    if (streakStart && streakDays >= 3) {
      consecutive_absences.push({
        start_date: streakStart,
        end_date: records[records.length - 1]?.date ?? streakStart,
        days: streakDays,
      });
    }

    return {
      success: true,
      data: {
        student_id: studentId,
        total_days: totalDays,
        present_days: presentDays,
        absent_days: absentDays,
        late_days: lateDays,
        excused_days: excusedDays,
        attendance_rate: toAttendanceRate(presentDays, lateDays, totalDays),
        monthly_breakdown,
        consecutive_absences,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch student summary",
    };
  }
}

export async function getClassAttendanceSummary(
  classId: string,
  schoolId: string,
  dateFrom: string,
  dateTo: string,
): Promise<{
  success: boolean;
  data?: ClassAttendanceSummary;
  message?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const context = await resolveAttendanceContext(supabase, schoolId, dateTo);
    const roster = await getRosterForClass(supabase, schoolId, classId, context);

    let query = supabase
      .from("attendance")
      .select("student_id, date, status")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .gte("date", dateFrom)
      .lte("date", dateTo);

    if (context.termId) {
      query = query.eq("term_id", context.termId);
    }

    const { data, error } = await query.order("date", { ascending: true });
    if (error) {
      return { success: false, message: error.message };
    }

    const records = (data ?? []) as Array<{ student_id: string; date: string; status: AttendanceStatus }>;
    const dates = Array.from(new Set(records.map((row) => row.date))).sort();
    const studentIds = Array.from(new Set([...roster.map((row) => row.student_id), ...records.map((row) => row.student_id)]));

    const studentSummaries = studentIds.map((studentId) => {
      const studentRecords = records.filter((row) => row.student_id === studentId);
      const stats = buildStats(studentRecords.length, studentRecords);

      return {
        student_id: studentId,
        total_days: studentRecords.length,
        present_days: stats.present,
        absent_days: stats.absent,
        late_days: stats.late,
        attendance_rate: stats.attendance_rate,
      };
    });

    const daily_breakdown: DailyAttendanceReport[] = dates.map((date) => {
      const dayRecords = records.filter((row) => row.date === date);
      const stats = buildStats(roster.length, dayRecords);

      return {
        date,
        total_students: roster.length,
        present: stats.present,
        absent: stats.absent,
        late: stats.late,
        excused: stats.excused,
        attendance_rate: stats.attendance_rate,
      };
    });

    return {
      success: true,
      data: {
        class_id: classId,
        date_from: dateFrom,
        date_to: dateTo,
        total_students: roster.length,
        school_days: dates.length,
        overall_stats: buildStats(roster.length * Math.max(dates.length, 1), records),
        daily_breakdown,
        student_summaries: studentSummaries,
        at_risk_students: studentSummaries
          .filter((row) => row.attendance_rate < 80)
          .sort((left, right) => left.attendance_rate - right.attendance_rate),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch class summary",
    };
  }
}

export async function getAllClassesAttendanceSummary(
  schoolId: string,
  date: string,
): Promise<{
  success: boolean;
  data?: SchoolClassAttendanceSummary[];
  message?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const context = await resolveAttendanceContext(supabase, schoolId, date);
    const classes = await getClassRows(supabase, schoolId, context.academicYearId);

    let rosterQuery = supabase
      .from("student_classes")
      .select("class_id")
      .eq("school_id", schoolId)
      .eq("status", "active");

    if (context.termId) {
      rosterQuery = rosterQuery.eq("term_id", context.termId);
    }

    if (context.academicYearId) {
      rosterQuery = rosterQuery.eq("academic_year_id", context.academicYearId);
    }

    const { data: rosterRows, error: rosterError } = await rosterQuery;
    if (rosterError) {
      return { success: false, message: rosterError.message };
    }

    const counts = new Map<string, number>();
    for (const row of rosterRows ?? []) {
      const classId = (row as any).class_id as string;
      counts.set(classId, (counts.get(classId) ?? 0) + 1);
    }

    const records = await getAttendanceRowsForDate(supabase, schoolId, date, undefined, context.termId);

    const summaries = classes.map((row: any) => {
      const classRecords = records.filter((record) => record.class_id === row.class_id);
      const totalStudents = counts.get(row.class_id) ?? 0;
      const stats = buildStats(totalStudents, classRecords);
      const grade = firstRelation(row.grade) as { name?: string | null } | null;

      return {
        classId: row.class_id,
        className: row.name,
        gradeName: grade?.name ?? "",
        totalStudents,
        present: stats.present,
        absent: stats.absent,
        late: stats.late,
        excused: stats.excused,
        rate: stats.attendance_rate,
        recorded: classRecords.length > 0,
      };
    });

    return { success: true, data: summaries };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch class summaries",
    };
  }
}

export async function getDailySchoolAttendance(
  schoolId: string,
  date: string,
): Promise<{
  success: boolean;
  data?: DailySchoolAttendance;
  message?: string;
}> {
  try {
    const classSummaryResult = await getAllClassesAttendanceSummary(schoolId, date);
    if (!classSummaryResult.success || !classSummaryResult.data) {
      return {
        success: false,
        message: classSummaryResult.message ?? "Failed to fetch class summaries",
      };
    }

    const data = classSummaryResult.data;
    const totalStudents = data.reduce((sum, row) => sum + row.totalStudents, 0);
    const present = data.reduce((sum, row) => sum + row.present, 0);
    const absent = data.reduce((sum, row) => sum + row.absent, 0);
    const late = data.reduce((sum, row) => sum + row.late, 0);
    const excused = data.reduce((sum, row) => sum + row.excused, 0);

    return {
      success: true,
      data: {
        date,
        totalStudents,
        present,
        absent,
        late,
        excused,
        attendanceRate: toAttendanceRate(present, late, totalStudents),
        classes: data,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch school attendance",
    };
  }
}

export async function getAttendanceExportRows(
  schoolId: string,
  date: string,
  classId?: string,
) {
  const supabase = await createSupabaseServerClient();
  const context = await resolveAttendanceContext(supabase, schoolId, date);

  if (classId) {
    const classAttendance = await getClassAttendanceForDate(classId, date, schoolId);
    if (!classAttendance.success) {
      throw new Error(classAttendance.message ?? "Failed to load class attendance");
    }

    return classAttendance.data.map((row) => ({
      Date: date,
      "Admission Number": row.admission_number,
      Student: row.full_name,
      Status: row.status ?? "unrecorded",
      Reason: row.reason ?? "",
      "Arrival Time": row.arrival_time ?? "",
    }));
  }

  const classes = await getAllClassesAttendanceSummary(schoolId, date);
  if (!classes.success || !classes.data) {
    throw new Error(classes.message ?? "Failed to load attendance summary");
  }

  return classes.data.map((row) => ({
    Date: date,
    Grade: row.gradeName,
    Class: row.className,
    "Total Students": row.totalStudents,
    Present: row.present,
    Absent: row.absent,
    Late: row.late,
    Excused: row.excused,
    "Attendance Rate": row.rate,
    Recorded: row.recorded ? "Yes" : "No",
    "Term ID": context.termId ?? "",
  }));
}

export const AttendanceService = {
  getAttendanceById,
  recordAttendance,
  updateAttendance,
  deleteAttendance,
  recordBulkAttendance,
  getAttendanceList,
  getClassAttendanceForDate,
  getStudentAttendanceSummary,
  getClassAttendanceSummary,
  getAllClassesAttendanceSummary,
  getDailySchoolAttendance,
  getAttendanceExportRows,
};

export { resolveAttendanceContext };
