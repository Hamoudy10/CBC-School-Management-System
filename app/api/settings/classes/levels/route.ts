export const dynamic = 'force-dynamic';

// app/api/settings/classes/levels/route.ts
// GET/POST class levels

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiSuccess, errorResponse } from "@/lib/api/response";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClasses } from "@/features/settings/services/classes.service";

const createClassLevelSchema = z.object({
  grade_level: z.number().int().min(1).max(12),
});

export const GET = withPermission(
  "settings",
  "view",
  async (req: NextRequest, user: any) => {
    try {
      const supabase = await createSupabaseServerClient();
      const [gradesResult, classesResult] = await Promise.all([
        supabase
          .from("grades")
          .select("grade_id, name, level_order")
          .eq("school_id", user.school_id)
          .order("level_order", { ascending: true }),
        getClasses(user.school_id),
      ]);

      if (gradesResult.error) {
        return errorResponse(
          gradesResult.error.message || "Failed to load class levels",
          400,
        );
      }

      if (!classesResult.success) {
        return errorResponse(
          classesResult.message || "Failed to load class levels",
          400,
        );
      }

      const levelMap = new Map<number, number>();
      for (const cls of classesResult.data) {
        levelMap.set(cls.grade_level, (levelMap.get(cls.grade_level) || 0) + 1);
      }

      const levels = (gradesResult.data ?? []).map((grade) => ({
        grade_level: grade.level_order,
        label: grade.name || `Grade ${grade.level_order}`,
        class_count: levelMap.get(grade.level_order) || 0,
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
      const supabase = await createSupabaseServerClient();

      const { data: existingGrade, error: existingGradeError } = await supabase
        .from("grades")
        .select("grade_id, name, level_order")
        .eq("school_id", user.school_id)
        .eq("level_order", validated.grade_level)
        .maybeSingle();

      if (existingGradeError) {
        return errorResponse(existingGradeError.message, 500);
      }

      if (existingGrade) {
        return apiSuccess(
          {
            grade_level: existingGrade.level_order,
            label: existingGrade.name || `Grade ${existingGrade.level_order}`,
          },
          "Class level already exists",
        );
      }

      const { data: createdGrade, error: createGradeError } = await (supabase
        .from("grades") as any)
        .insert({
          school_id: user.school_id,
          name: `Grade ${validated.grade_level}`,
          level_order: validated.grade_level,
        })
        .select("grade_id, name, level_order")
        .single();

      if (createGradeError || !createdGrade) {
        return errorResponse(
          createGradeError?.message || "Failed to create class level",
          500,
        );
      }

      return apiSuccess(
        {
          grade_level: createdGrade.level_order,
          label: createdGrade.name || `Grade ${createdGrade.level_order}`,
        },
        "Class level created",
        201,
      );
    } catch (error: any) {
      if (error.name === "ZodError") {return errorResponse(error.errors, 422);}
      return errorResponse(error.message, 500);
    }
  },
);
