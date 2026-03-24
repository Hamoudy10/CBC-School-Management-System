import { withPermission } from "@/lib/api/withAuth";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { validateBody } from "@/lib/api/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getVisibleStudentIdsForUser,
  mapDisciplineRows,
  mapIncomingStatus,
  normalizeSeverity,
} from "../_lib";
import { z } from "zod";

const updateIncidentSchema = z
  .object({
    studentId: z.string().uuid().optional(),
    student_id: z.string().uuid().optional(),
    incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    incident_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    incidentType: z.string().min(1).max(100).optional(),
    incident_type: z.string().min(1).max(100).optional(),
    severity: z.string().optional(),
    description: z.string().min(10).max(2000).optional(),
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
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
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

async function getScopedRecord(id: string, user: any) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("disciplinary_records")
    .select(getDisciplineSelect())
    .eq("id", id)
    .eq("school_id", user.schoolId!);

  const visibleStudentIds = await getVisibleStudentIdsForUser(user);
  if (visibleStudentIds) {
    if (visibleStudentIds.length === 0) {
      return { data: null, error: null };
    }

    query = query.in("student_id", visibleStudentIds);
  }

  return await query.maybeSingle();
}

export const GET = withPermission("compliance", "view", async (_request, { user, params }) => {
  try {
    const { data, error } = await getScopedRecord(params.id, user);
    if (error) {
      return errorResponse(error.message, 500);
    }

    if (!data) {
      return errorResponse("Disciplinary record not found", 404);
    }

    const [record] = await mapDisciplineRows([data]);
    return successResponse(record);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch discipline record",
      500,
    );
  }
});

export const PUT = withPermission("compliance", "update", async (request, { user, params }) => {
  const validation = await validateBody(request, updateIncidentSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: existing, error: existingError } = await getScopedRecord(params.id, user);
    if (existingError) {
      return errorResponse(existingError.message, 500);
    }

    if (!existing) {
      return errorResponse("Disciplinary record not found", 404);
    }

    const body = validation.data;
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.studentId !== undefined || body.student_id !== undefined) {
      updateData.student_id = body.studentId ?? body.student_id;
    }
    if (body.incidentDate !== undefined || body.incident_date !== undefined) {
      updateData.incident_date = body.incidentDate ?? body.incident_date;
    }
    if (body.incidentType !== undefined || body.incident_type !== undefined) {
      updateData.incident_type = body.incidentType ?? body.incident_type;
    }
    if (body.severity !== undefined) {
      updateData.severity = normalizeSeverity(body.severity);
    }
    if (body.description !== undefined) {
      updateData.description = body.description;
    }
    if (body.location !== undefined) {
      updateData.location = body.location || null;
    }
    if (body.witnesses !== undefined) {
      updateData.witnesses = body.witnesses || null;
    }
    if (body.actionTaken !== undefined || body.action_taken !== undefined) {
      updateData.action_taken = body.actionTaken ?? body.action_taken ?? null;
    }
    if (body.followUpDate !== undefined || body.follow_up_date !== undefined) {
      updateData.follow_up_date = body.followUpDate ?? body.follow_up_date ?? null;
    }
    if (body.followUpNotes !== undefined || body.follow_up_notes !== undefined) {
      updateData.follow_up_notes = body.followUpNotes ?? body.follow_up_notes ?? null;
    }
    if (body.notifyParent !== undefined || body.parent_notified !== undefined) {
      const parentNotified = body.notifyParent ?? body.parent_notified;
      updateData.parent_notified = parentNotified;
      updateData.parent_notified_date = parentNotified
        ? new Date().toISOString().slice(0, 10)
        : null;
    }
    if (body.status !== undefined) {
      const status = mapIncomingStatus(body.status);
      updateData.status = status;
      if (status === "resolved") {
        updateData.resolved_by = user.id;
        updateData.resolved_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from("disciplinary_records")
      .update(updateData)
      .eq("id", params.id)
      .eq("school_id", user.schoolId!)
      .select(getDisciplineSelect())
      .single();

    if (error) {
      return errorResponse(error.message, 500);
    }

    const [record] = await mapDisciplineRows([data]);
    return successResponse(record);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to update discipline record",
      500,
    );
  }
});

export const DELETE = withPermission("compliance", "delete", async (_request, { user, params }) => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: existing, error: existingError } = await getScopedRecord(params.id, user);
    if (existingError) {
      return errorResponse(existingError.message, 500);
    }

    if (!existing) {
      return errorResponse("Disciplinary record not found", 404);
    }

    const { error } = await supabase
      .from("disciplinary_records")
      .delete()
      .eq("id", params.id)
      .eq("school_id", user.schoolId!);

    if (error) {
      return errorResponse(error.message, 500);
    }

    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to delete discipline record",
      500,
    );
  }
});
