// app/api/discipline/student/[studentId]/route.ts
// GET student discipline history

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { getStudentDisciplineHistory } from "@/features/discipline/services/discipline.service";

export const GET = withPermission(
  { module: "compliance", action: "view" },
  async (
    req: NextRequest,
    user,
    { params }: { params: { studentId: string } },
  ) => {
    try {
      const result = await getStudentDisciplineHistory(
        params.studentId,
        user.school_id,
      );

      if (!result.success) {
        return apiError(result.message || "Failed to fetch history", 500);
      }

      return apiSuccess({
        records: result.data,
        total: result.total,
      });
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
