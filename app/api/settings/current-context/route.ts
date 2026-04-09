export const dynamic = 'force-dynamic';

// app/api/settings/current-context/route.ts
// GET current active academic year + term

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import {
  getActiveAcademicYear,
  getActiveTerm,
} from "@/features/settings/services/academicYear.service";

export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const [activeYear, activeTerm] = await Promise.all([
      getActiveAcademicYear(user.school_id),
      getActiveTerm(user.school_id),
    ]);

    const context = {
      active_year: activeYear.success ? activeYear.data ?? null : null,
      active_term: activeTerm.success ? activeTerm.data ?? null : null,
    };

    return successResponse(context);
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
});
