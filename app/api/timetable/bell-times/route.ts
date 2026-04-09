export const dynamic = 'force-dynamic';

// app/api/timetable/bell-times/route.ts
// ============================================================
// GET /api/timetable/bell-times - List bell times
// POST /api/timetable/bell-times - Create bell time
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  createdResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  listBellTimes,
  createBellTime,
  resetToDefaults,
} from "@/features/timetable/services/bellTimes.service";

const createBellTimeSchema = z.object({
  name: z.string().min(1).max(100),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
  periodOrder: z.coerce.number().int().min(1).max(20),
  isBreak: z.boolean().optional(),
});

export const GET = withPermission(
  "timetable",
  "view",
  async (request: NextRequest, { user }) => {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    try {
      if (action === "reset") {
        const result = await resetToDefaults(user);
        if (!result.success) {
          return errorResponse(result.message);
        }
        const bellTimes = await listBellTimes(user);
        return successResponse(bellTimes);
      }

      const bellTimes = await listBellTimes(user);
      return successResponse(bellTimes);
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to load bell times.",
        500,
      );
    }
  },
);

export const POST = withPermission(
  "timetable",
  "create",
  async (request: NextRequest, { user }) => {
    const validation = await validateBody(request, createBellTimeSchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    try {
      const result = await createBellTime(validation.data!, user);

      if (!result.success) {
        return errorResponse(result.message);
      }

      return createdResponse(
        { bellTimeId: result.bellTimeId },
        result.message,
      );
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to create bell time.",
        500,
      );
    }
  },
);
