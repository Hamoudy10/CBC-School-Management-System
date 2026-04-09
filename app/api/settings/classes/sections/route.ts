export const dynamic = 'force-dynamic';

// app/api/settings/classes/sections/route.ts
// GET/POST class sections

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiSuccess, errorResponse } from "@/lib/api/response";
import { createClassSchema } from "@/features/settings";
import {
  createClass,
  getClasses,
} from "@/features/settings/services/classes.service";

export const GET = withPermission(
  "settings",
  "view",
  async (req: NextRequest, user: any) => {
    try {
      const url = new URL(req.url);
      const academicYearId =
        url.searchParams.get("academic_year_id") || undefined;
      const classLevelId = url.searchParams.get("class_level_id") || undefined;
      const gradeLevel = classLevelId ? Number(classLevelId) : undefined;

      const result = await getClasses(user.school_id, {
        academic_year: academicYearId,
        grade_level: Number.isFinite(gradeLevel) ? gradeLevel : undefined,
      });
      if (!result.success) {
        return errorResponse(result.message || "Failed to load sections", 400);
      }

      const sections = result.data.map((cls) => ({
        id: cls.class_id,
        name: cls.name,
        grade_level: cls.grade_level,
        stream: cls.stream,
        academic_year: cls.academic_year,
        status: cls.status,
      }));

      return apiSuccess(sections);
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
      const validated = createClassSchema.parse(body);
      const result = await createClass(validated, user.school_id);

      if (!result.success) {return errorResponse(result.message, 400);}
      return apiSuccess({ id: result.id }, result.message, 201);
    } catch (error: any) {
      if (error.name === "ZodError") {return errorResponse(error.errors, 422);}
      return errorResponse(error.message, 500);
    }
  },
);
