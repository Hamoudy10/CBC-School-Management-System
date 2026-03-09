// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ─── Request Validation ───────────────────────────────────────────────────────

const generateSchema = z.object({
  term_id: z.string().uuid('Invalid term ID'),
  academic_year_id: z.string().uuid('Invalid academic year ID'),
  class_ids: z
    .array(z.string().uuid('Invalid class ID'))
    .min(1, 'At least one class must be selected'),
  regenerate_existing: z.boolean().default(false),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function successResponse(data: unknown, message: string, status: number = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, message, data: null }, { status });
}

/**
 * Maps a numeric average score (1–4 CBC scale) to a performance level label.
 */
function getPerformanceLevel(score: number): string {
  if (score >= 3.5) return 'Exceeding Expectations';
  if (score >= 2.5) return 'Meeting Expectations';
  if (score >= 1.5) return 'Approaching Expectations';
  return 'Below Expectations';
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth check
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return errorResponse('Unauthorized', 401);

  // 2. Get user with role and school
  const { data: user } = await supabase
    .from('users')
    .select('user_id, school_id, roles ( name )')
    .eq('user_id', authUser.id)
    .single();

  if (!user?.school_id) return errorResponse('Forbidden', 403);

  const roleName = (user.roles as Record<string, string>)?.name ?? 'student';
  const schoolId = user.school_id;

  // 3. Admin-only access
  const allowedRoles = ['super_admin', 'school_admin', 'principal', 'deputy_principal'];
  if (!allowedRoles.includes(roleName)) {
    return errorResponse('Insufficient permissions', 403);
  }

  // 4. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? 'Validation failed';
    return errorResponse(firstError, 400);
  }

  const { term_id, academic_year_id, class_ids, regenerate_existing } = parsed.data;

  // 5. Verify term belongs to this school and academic year
  const { data: term } = await supabase
    .from('terms')
    .select('term_id, name')
    .eq('term_id', term_id)
    .eq('school_id', schoolId)
    .eq('academic_year_id', academic_year_id)
    .maybeSingle();

  if (!term) {
    return errorResponse('Term not found or does not belong to this school', 404);
  }

  // 6. Verify all classes belong to this school
  const { data: validClasses } = await supabase
    .from('classes')
    .select('class_id, name, stream')
    .eq('school_id', schoolId)
    .in('class_id', class_ids);

  const validClassIds = (validClasses ?? []).map((c) => c.class_id);
  const invalidClassIds = class_ids.filter((id) => !validClassIds.includes(id));

  if (invalidClassIds.length > 0) {
    return errorResponse(
      `${invalidClassIds.length} class(es) not found or do not belong to this school`,
      400
    );
  }

  // 7. Fetch all active students in the selected classes
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('student_id, current_class_id, first_name, last_name')
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .in('current_class_id', validClassIds);

  if (studentsError) {
    return errorResponse(`Failed to fetch students: ${studentsError.message}`, 500);
  }

  if (!students || students.length === 0) {
    return errorResponse('No active students found in the selected classes', 400);
  }

  // 8. Fetch existing report cards for this term + classes (for skip/regenerate logic)
  const { data: existingReports } = await supabase
    .from('report_cards')
    .select('report_card_id, student_id, class_id')
    .eq('school_id', schoolId)
    .eq('term_id', term_id)
    .eq('academic_year_id', academic_year_id)
    .in('class_id', validClassIds);

  const existingMap = new Map<string, string>();
  (existingReports ?? []).forEach((r) => {
    existingMap.set(r.student_id, r.report_card_id);
  });

  // 9. Fetch assessment aggregates for all students in this term
  //    These are auto-computed by the database trigger fn_update_assessment_aggregate
  const studentIds = students.map((s) => s.student_id);

  const { data: aggregates, error: aggError } = await supabase
    .from('assessment_aggregates')
    .select(`
      student_id,
      learning_area_id,
      average_score,
      performance_level,
      learning_areas ( name )
    `)
    .eq('term_id', term_id)
    .in('student_id', studentIds);

  if (aggError) {
    return errorResponse(`Failed to fetch assessment data: ${aggError.message}`, 500);
  }

  // 10. Group aggregates by student
  const studentAggregates = new Map<
    string,
    Array<{
      learning_area_id: string;
      learning_area_name: string;
      average_score: number;
      performance_level: string | null;
    }>
  >();

  (aggregates ?? []).forEach((agg) => {
    const existing = studentAggregates.get(agg.student_id) ?? [];
    existing.push({
      learning_area_id: agg.learning_area_id,
      learning_area_name:
        (agg.learning_areas as Record<string, string> | null)?.name ?? 'Unknown',
      average_score: agg.average_score ?? 0,
      performance_level: agg.performance_level ?? null,
    });
    studentAggregates.set(agg.student_id, existing);
  });

  // 11. Fetch performance levels configuration for score mapping
  const { data: performanceLevels } = await supabase
    .from('performance_levels')
    .select('*')
    .eq('school_id', schoolId)
    .order('min_score', { ascending: false });

  // 12. Generate report cards
  let generated = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Process in batches to avoid overwhelming the database
  const BATCH_SIZE = 50;
  const reportCardsToInsert: Array<Record<string, unknown>> = [];
  const reportCardsToUpdate: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const student of students) {
    const existingReportId = existingMap.get(student.student_id);

    // Skip if already exists and not regenerating
    if (existingReportId && !regenerate_existing) {
      skipped++;
      continue;
    }

    // Calculate overall score from aggregates
    const studentAggs = studentAggregates.get(student.student_id) ?? [];

    let overallScore: number | null = null;
    let performanceLevel: string | null = null;

    if (studentAggs.length > 0) {
      const totalScore = studentAggs.reduce((sum, agg) => sum + agg.average_score, 0);
      overallScore = parseFloat((totalScore / studentAggs.length).toFixed(2));
      performanceLevel = getPerformanceLevel(overallScore);

      // Try to match against school-configured performance levels
      if (performanceLevels && performanceLevels.length > 0) {
        const matchedLevel = performanceLevels.find(
          (pl) =>
            overallScore !== null &&
            overallScore >= (pl.min_score ?? 0) &&
            overallScore <= (pl.max_score ?? 4)
        );
        if (matchedLevel) {
          performanceLevel = matchedLevel.label ?? performanceLevel;
        }
      }
    }

    // Build analytics JSON
    const analyticsJson: Record<string, unknown> = {
      learning_areas: studentAggs.map((agg) => ({
        learning_area_id: agg.learning_area_id,
        name: agg.learning_area_name,
        average_score: agg.average_score,
        performance_level: agg.performance_level,
      })),
      total_learning_areas: studentAggs.length,
      assessed_learning_areas: studentAggs.filter((a) => a.average_score > 0).length,
      generated_by: user.user_id,
      generated_at: new Date().toISOString(),
    };

    if (existingReportId && regenerate_existing) {
      // Update existing report — preserve remarks
      reportCardsToUpdate.push({
        id: existingReportId,
        data: {
          overall_score: overallScore,
          performance_level: performanceLevel,
          analytics_json: analyticsJson,
          status: 'draft',
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    } else {
      // Insert new report
      reportCardsToInsert.push({
        student_id: student.student_id,
        class_id: student.current_class_id,
        term_id,
        academic_year_id,
        school_id: schoolId,
        overall_score: overallScore,
        performance_level: performanceLevel,
        analytics_json: analyticsJson,
        status: 'draft',
        generated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  // 13. Execute inserts in batches
  for (let i = 0; i < reportCardsToInsert.length; i += BATCH_SIZE) {
    const batch = reportCardsToInsert.slice(i, i + BATCH_SIZE);

    const { error: insertError } = await supabase
      .from('report_cards')
      .insert(batch);

    if (insertError) {
      errors.push(
        `Failed to insert batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertError.message}`
      );
    } else {
      generated += batch.length;
    }
  }

  // 14. Execute updates individually (to preserve per-row remarks)
  for (const update of reportCardsToUpdate) {
    const { error: updateError } = await supabase
      .from('report_cards')
      .update(update.data)
      .eq('report_card_id', update.id);

    if (updateError) {
      errors.push(`Failed to update report ${update.id}: ${updateError.message}`);
    } else {
      generated++;
    }
  }

  // 15. Build response
  const totalProcessed = generated + skipped;
  const hasErrors = errors.length > 0;

  const message = hasErrors
    ? `Partially completed: ${generated} generated, ${skipped} skipped, ${errors.length} error(s)`
    : `Successfully generated ${generated} report card(s)${skipped > 0 ? `, ${skipped} skipped (already exist)` : ''}`;

  return successResponse(
    {
      generated,
      skipped,
      total_students: students.length,
      errors,
    },
    message,
    hasErrors ? 207 : 200
  );
}
