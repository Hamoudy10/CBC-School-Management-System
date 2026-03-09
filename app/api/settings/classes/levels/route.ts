// app/api/settings/classes/levels/route.ts
// GET/POST class levels

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiSuccess, errorResponse } from "@/lib/api/response";
import { z } from "zod";
import { getClasses } from "@/features/settings/services/classes.service";

const createClassLevelSchema = z.object({
  grade_level: z.number().int().min(1).max(12),
});

export const GET = withPermission(
  "settings",
  "view",
  async (req: NextRequest, user: any) => {
    try {
      const classesResult = await getClasses(user.school_id);
      if (!classesResult.success) {
        return errorResponse(classesResult.message || "Failed to load class levels", 400);
      }

      const levelMap = new Map<number, number>();
      for (const cls of classesResult.data) {
        levelMap.set(cls.grade_level, (levelMap.get(cls.grade_level) || 0) + 1);
      }

      const levels = Array.from(levelMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([grade_level, class_count]) => ({
          grade_level,
          label: `Grade ${grade_level}`,
          class_count,
        }));

      return apiSuccess(levels);
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);

export const POST = withPermission(
  "settings",
  "create",
  async (req: NextRequest, user: any) => {
    try {
      const body = await req.json();
      const validated = createClassLevelSchema.parse(body);
      return apiSuccess(
        {
          grade_level: validated.grade_level,
          label: `Grade ${validated.grade_level}`,
        },
        "Class level accepted",
        201,
      );
    } catch (error: any) {
      if (error.name === "ZodError") return errorResponse(error.errors, 422);
      return errorResponse(error.message, 500);
    }
  },
);
