export const dynamic = 'force-dynamic';

import { withPermission } from "@/lib/api/withAuth";
import {
  createdResponse,
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { validateBody } from "@/lib/api/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildDisciplineSummary,
  getVisibleStudentIdsForUser,
  mapDisciplineRows,
  mapIncomingStatus,
  normalizeSeverity,
} from "./_lib";
import { z } from "zod";

const createIncidentSchema = z.object({
  studentId: z.string().uuid().optional(),
  student_id: z.string().uuid().optional(),
  incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  incident_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  incidentType: z.string().min(1).max(100).optional(),
  incident_type: z.string().min(1).max(100).optional(),
  severity: z.string().optional(),
  description: z.string().min(10).max(2000),
  location: z.string().max(200).optional().or(z.literal("")),
  witnesses: z.string().max(500).optional().or(z.literal("")),
  actionTaken: z.string().max(1000).optional().or(z.literal("")),
  action_taken: z.string().max(1000).optional().or(z.literal("")),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  follow_up_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  followUpNotes: z.string().max(2000).optional().or(z.literal("")),
  follow_up_notes: z.string().max(2000).optional().or(z.literal("")),
  notifyParent: z.boolean().optional(),
  parent_notified: z.boolean().optional(),
  status: z.string().optional(),
});

function getDisciplineSelect() {
  return `
    *,
    student:students!disciplinary_records_student_id_fkey(
      student_id,
      first_name,
      last_name,
      admission_number,
      photo_url,
      current_class_id
    ),
    recorded_by_user:users!disciplinary_records_recorded_by_fkey(
      user_id,
      first_name,
      last_name
    ),
    resolved_by_user:users!disciplinary_records_resolved_by_fkey(
      user_id,
      first_name,
      last_name
    )
  `;
}

export const GET = withPermission("compliance", "view", async (request, { user }) => {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const page = Math.max(
      1,
      Number(searchParams.get("page") ?? "1"),
    );
    const pageSize = Math.min(
      100,
      Math.max(
        1,
        Number(searchParams.get("page_size") ?? searchParams.get("pageSize") ?? "20"),
      ),
    );
    const offset = (page - 1) * pageSize;

    const studentId = searchParams.get("student_id") ?? searchParams.get("studentId");
    const classId = searchParams.get("class_id") ?? searchParams.get("classId");
    const severity = searchParams.get("severity");
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();
    const dateFrom = searchParams.get("date_from") ?? searchParams.get("dateFrom");
    const dateTo = searchParams.get("date_to") ?? searchParams.get("dateTo");

    let visibleStudentIds = await getVisibleStudentIdsForUser(user);
    if (classId) {
      const { data: classStudents, error: classStudentsError } = await supabase
        .from("students")
        .select("student_id")
        .eq("school_id", user.schoolId!)
        .eq("current_class_id", classId);

      if (classStudentsError) {
        return errorResponse(classStudentsError.message, 500);
      }

      const classStudentIds = (classStudents ?? []).map((row: any) => row.student_id);
      visibleStudentIds = visibleStudentIds
        ? visibleStudentIds.filter((id) => classStudentIds.includes(id))
        : classStudentIds;
    }

    if (studentId) {
      visibleStudentIds = visibleStudentIds
        ? visibleStudentIds.filter((id) => id === studentId)
        : [studentId];
    }

    if (visibleStudentIds && visibleStudentIds.length === 0) {
      return successResponse(
        {
          records: [],
          total: 0,
          page,
          page_size: pageSize,
          total_pages: 0,
          summary: buildDisciplineSummary([]),
        },
      );
    }

    let query = supabase
      .from("disciplinary_records")
      .select(getDisciplineSelect(), { count: "exact" })
      .eq("school_id", user.schoolId!)
      .order("incident_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (visibleStudentIds) {
      query = query.in("student_id", visibleStudentIds);
    }

    if (severity) {
      query = query.eq("severity", normalizeSeverity(severity));
    }

    if (status) {
      query = query.eq("status", mapIncomingStatus(status));
    }

    if (dateFrom) {
      query = query.gte("incident_date", dateFrom);
    }

    if (dateTo) {
      query = query.lte("incident_date", dateTo);
    }

    if (search) {
      query = query.or(`incident_type.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error, count } = await query.range(offset, offset + pageSize - 1);

    if (error) {
      return errorResponse(error.message, 500);
    }

    let summaryQuery = supabase
      .from("disciplinary_records")
      .select(getDisciplineSelect())
      .eq("school_id", user.schoolId!);

    if (visibleStudentIds) {
      summaryQuery = summaryQuery.in("student_id", visibleStudentIds);
    }

    if (severity) {
      summaryQuery = summaryQuery.eq("severity", normalizeSeverity(severity));
    }

    if (status) {
      summaryQuery = summaryQuery.eq("status", mapIncomingStatus(status));
    }

    if (dateFrom) {
      summaryQuery = summaryQuery.gte("incident_date", dateFrom);
    }

    if (dateTo) {
      summaryQuery = summaryQuery.lte("incident_date", dateTo);
    }

    if (search) {
      summaryQuery = summaryQuery.or(`incident_type.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: summaryRows, error: summaryError } = await summaryQuery;

    if (summaryError) {
      return errorResponse(summaryError.message, 500);
    }

    const records = await mapDisciplineRows(data ?? []);
    const summary = buildDisciplineSummary(summaryRows ?? []);

    return successResponse({
      records,
      total: count ?? 0,
      page,
      page_size: pageSize,
      total_pages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      summary,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch discipline records",
      500,
    );
  }
});

export const POST = withPermission("compliance", "create", async (request, { user }) => {
  const validation = await validateBody(request, createIncidentSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const body = validation.data;
    const studentId = body.studentId ?? body.student_id;
    const incidentDate = body.incidentDate ?? body.incident_date;
    const incidentType = body.incidentType ?? body.incident_type;
    const severity = normalizeSeverity(body.severity);
    const actionTaken = body.actionTaken ?? body.action_taken ?? null;
    const followUpDate = body.followUpDate ?? body.follow_up_date ?? null;
    const followUpNotes = body.followUpNotes ?? body.follow_up_notes ?? null;
    const parentNotified = body.notifyParent ?? body.parent_notified ?? false;

    if (!studentId || !incidentDate || !incidentType) {
      return errorResponse("studentId, incidentDate, and incidentType are required", 400);
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("student_id")
      .eq("student_id", studentId)
      .eq("school_id", user.schoolId!)
      .maybeSingle();

    if (studentError) {
      return errorResponse(studentError.message, 500);
    }

    if (!student) {
      return errorResponse("Student not found", 404);
    }

    const insertPayload = {
      school_id: user.schoolId!,
      student_id: studentId,
      incident_date: incidentDate,
      incident_type: incidentType,
      severity,
      description: body.description,
      location: body.location || null,
      witnesses: body.witnesses || null,
      action_taken: actionTaken,
      follow_up_date: followUpDate || null,
      follow_up_notes: followUpNotes || null,
      parent_notified: parentNotified,
      parent_notified_date: parentNotified ? new Date().toISOString().slice(0, 10) : null,
      status: mapIncomingStatus(body.status),
      recorded_by: user.id,
    };

    const { data, error } = await supabase
      .from("disciplinary_records")
      .insert(insertPayload)
      .select(getDisciplineSelect())
      .single();

    if (error) {
      return errorResponse(error.message, 500);
    }

    const [record] = await mapDisciplineRows([data]);
    return createdResponse(
      { record },
      "Disciplinary record created",
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to create discipline record",
      500,
    );
  }
});
