import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api/response";
import { meetingScheduleRequestSchema } from "@/features/parent-engagement/validators/parent-engagement.schema";
import { scheduleParentTeacherMeeting } from "@/features/parent-engagement/services/meeting-scheduler.service";

export const POST = withPermission(
  { module: "communication", action: "create" },
  async (request: NextRequest, { user }: any) => {
    const validation = await validateBody(request, meetingScheduleRequestSchema);
    if (!validation.success) return validationErrorResponse(validation.errors);

    try {
      const result = await scheduleParentTeacherMeeting(
        validation.data.parentId,
        validation.data.teacherId,
        validation.data.studentId,
        validation.data.preferredDates,
        validation.data.preferredTimes,
        validation.data.durationMinutes,
        validation.data.reason,
        validation.data.urgency,
        user.school_id
      );
      return successResponse(result);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Failed to schedule meeting",
        500
      );
    }
  },
  "ai_generation"
);

export async function GET() {
  return successResponse({
    description: "AI Parent-Teacher Meeting Scheduler",
    usage: "POST parent/teacher/student IDs with preferences to get suggested meeting slots and agenda",
  });
}
