// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ─── Response Helpers ─────────────────────────────────────────────────────────

function successResponse(data: unknown, message: string, status: number = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, message, data: null }, { status });
}

// ─── Validation Schema ────────────────────────────────────────────────────────

const assessmentRecordSchema = z.object({
  student_id: z.string().uuid('Invalid student ID'),
  competency_id: z.string().uuid('Invalid competency ID'),
  score: z
    .number()
    .min(1, 'Score must be at least 1')
    .max(4, 'Score must be at most 4')
    .int('Score must be a whole number'),
  notes: z
    .string()
    .max(500, 'Notes must be 500 characters or fewer')
    .trim()
    .optional()
    .nullable(),
});

const bulkAssessmentSchema = z.object({
  term_id: z.string().uuid('Invalid term ID'),
  class_id: z.string().uuid('Invalid class ID'),
  learning_area_id: z.string().uuid('Invalid learning area ID'),
  assessment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Assessment date must be in YYYY-MM-DD format')
    .optional(),
  records: z
    .array(assessmentRecordSchema)
    .min(1, 'At least one assessment record is required')
    .max(500, 'Maximum 500 records per request'),
});

// ─── Auth Helper ──────────────────────────────────────────────────────────────

interface AuthResult {
  userId: string;
  schoolId: string;
  roleName: string;
}

async function authenticate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  allowedRoles: string[]
): Promise<{ auth: AuthResult } | { error: NextResponse }> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { error: errorResponse('Unauthorized', 401) };
  }

  const { data: user } = await supabase
    .from('users')
    .select('user_id, school_id, roles ( name )')
    .eq('user_id', authUser.id)
    .single();

  if (!user?.school_id) {
    return { error: errorResponse('Forbidden — no school associated', 403) };
  }

  const roleName = (user.roles as Record<string, string>)?.name ?? 'student';

  if (!allowedRoles.includes(roleName)) {
    return { error: errorResponse('Insufficient permissions', 403) };
  }

  return {
    auth: {
      userId: user.user_id,
      schoolId: user.school_id,
      roleName,
    },
  };
}

// ─── POST /api/assessments/bulk ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth — teachers and admin can record assessments
  const writeRoles = [
    'super_admin',
    'school_admin',
    'principal',
    'deputy_principal',
    'teacher',
    'class_teacher',
    'subject_teacher',
    'ict_admin',
  ];

  const result = await authenticate(supabase, writeRoles);
  if ('error' in result) return result.error;
  const { schoolId, userId } = result.auth;

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const parsed = bulkAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return NextResponse.json(
      { success: false, message: 'Validation failed', data: null, errors: fieldErrors },
      { status: 400 }
    );
  }

  const { term_id, class_id, learning_area_id, assessment_date, records } = parsed.data;

  // 3. Verify term belongs to this school and is accessible
  const { data: term } = await supabase
    .from('terms')
    .select('term_id, name, is_active, academic_year_id')
    .eq('term_id', term_id)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (!term) {
    return errorResponse('Term not found or does not belong to this school', 404);
  }

  // 4. Verify class belongs to this school
  const { data: classRecord } = await supabase
    .from('classes')
    .select('class_id, name, grade_id')
    .eq('class_id', class_id)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (!classRecord) {
    return errorResponse('Class not found or does not belong to this school', 404);
  }

  // 5. Verify learning area exists
  const { data: learningArea } = await supabase
    .from('learning_areas')
    .select('learning_area_id, name')
    .eq('learning_area_id', learning_area_id)
    .maybeSingle();

  if (!learningArea) {
    return errorResponse('Learning area not found', 404);
  }

  // 6. Verify all competencies exist and belong to the learning area
  const competencyIds = [...new Set(records.map((r) => r.competency_id))];

  const { data: validCompetencies, error: compError } = await supabase
    .from('competencies')
    .select('competency_id, sub_strands ( strands ( learning_area_id ) )')
    .in('competency_id', competencyIds);

  if (compError) {
    return errorResponse(`Failed to verify competencies: ${compError.message}`, 500);
  }

  // Verify each competency belongs to the correct learning area
  const validCompetencyIds = new Set<string>();
  (validCompetencies ?? []).forEach((comp) => {
    const subStrand = comp.sub_strands as Record<string, unknown> | null;
    const strand = subStrand?.strands as Record<string, unknown> | null;
    const compLearningAreaId = strand?.learning_area_id;

    if (compLearningAreaId === learning_area_id) {
      validCompetencyIds.add(comp.competency_id);
    }
  });

  const invalidCompetencyIds = competencyIds.filter((id) => !validCompetencyIds.has(id));
  if (invalidCompetencyIds.length > 0) {
    return errorResponse(
      `${invalidCompetencyIds.length} competency(ies) do not belong to the specified learning area`,
      400
    );
  }

  // 7. Verify all students exist and belong to this class
  const studentIds = [...new Set(records.map((r) => r.student_id))];

  const { data: validStudents, error: studentsError } = await supabase
    .from('students')
    .select('student_id')
    .eq('school_id', schoolId)
    .eq('current_class_id', class_id)
    .eq('status', 'active')
    .in('student_id', studentIds);

  if (studentsError) {
    return errorResponse(`Failed to verify students: ${studentsError.message}`, 500);
  }

  const validStudentIds = new Set((validStudents ?? []).map((s) => s.student_id));
  const invalidStudentIds = studentIds.filter((id) => !validStudentIds.has(id));

  if (invalidStudentIds.length > 0) {
    return errorResponse(
      `${invalidStudentIds.length} student(s) not found in this class or are not active`,
      400
    );
  }

  // 8. Check for existing assessments for this term, class, and competencies
  const { data: existingAssessments } = await supabase
    .from('assessments')
    .select('assessment_id, student_id, competency_id')
    .eq('term_id', term_id)
    .in('student_id', studentIds)
    .in('competency_id', competencyIds);

  // Create a map: "student_id:competency_id" -> assessment_id
  const existingMap = new Map<string, string>();
  (existingAssessments ?? []).forEach((a) => {
    const key = `${a.student_id}:${a.competency_id}`;
    existingMap.set(key, a.assessment_id);
  });

  // 9. Separate into inserts and updates
  const toInsert: Array<Record<string, unknown>> = [];
  const toUpdate: Array<{ assessment_id: string; data: Record<string, unknown> }> = [];

  const timestamp = new Date().toISOString();
  const assessDate = assessment_date ?? new Date().toISOString().split('T')[0];

  records.forEach((record) => {
    const key = `${record.student_id}:${record.competency_id}`;
    const existingId = existingMap.get(key);

    if (existingId) {
      toUpdate.push({
        assessment_id: existingId,
        data: {
          score: record.score,
          notes: record.notes ?? null,
          assessed_by: userId,
          assessment_date: assessDate,
          updated_at: timestamp,
        },
      });
    } else {
      toInsert.push({
        student_id: record.student_id,
        competency_id: record.competency_id,
        term_id,
        class_id,
        learning_area_id,
        score: record.score,
        notes: record.notes ?? null,
        assessed_by: userId,
        assessment_date: assessDate,
        school_id: schoolId,
        created_at: timestamp,
        updated_at: timestamp,
      });
    }
  });

  // 10. Execute inserts in batches
  let insertedCount = 0;
  let insertErrors: string[] = [];

  if (toInsert.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from('assessments').insert(batch);

      if (insertError) {
        insertErrors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertError.message}`);
      } else {
        insertedCount += batch.length;
      }
    }
  }

  // 11. Execute updates
  let updatedCount = 0;
  let updateErrors: string[] = [];

  // Batch updates using Promise.all for better performance
  const UPDATE_BATCH_SIZE = 50;
  for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + UPDATE_BATCH_SIZE);

    const updatePromises = batch.map(async (update) => {
      const { error } = await supabase
        .from('assessments')
        .update(update.data)
        .eq('assessment_id', update.assessment_id);

      return { assessment_id: update.assessment_id, error };
    });

    const results = await Promise.all(updatePromises);

    results.forEach((result) => {
      if (result.error) {
        updateErrors.push(`${result.assessment_id}: ${result.error.message}`);
      } else {
        updatedCount++;
      }
    });
  }

  // 12. Trigger aggregate recalculation (if not handled by DB trigger)
  // Note: The database has fn_update_assessment_aggregate() trigger
  // We'll manually trigger aggregate update for affected students just in case

  const affectedStudentIds = [...new Set(records.map((r) => r.student_id))];

  // Recalculate aggregates for each affected student
  for (const studentId of affectedStudentIds) {
    // Fetch all assessments for this student, term, and learning area
    const { data: studentAssessments } = await supabase
      .from('assessments')
      .select('score')
      .eq('student_id', studentId)
      .eq('term_id', term_id)
      .eq('learning_area_id', learning_area_id);

    if (studentAssessments && studentAssessments.length > 0) {
      const scores = studentAssessments.map((a) => a.score).filter((s) => s !== null);
      const averageScore =
        scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;

      // Determine performance level
      let performanceLevel = 'Below Expectations';
      if (averageScore >= 3.5) {
        performanceLevel = 'Exceeding Expectations';
      } else if (averageScore >= 2.5) {
        performanceLevel = 'Meeting Expectations';
      } else if (averageScore >= 1.5) {
        performanceLevel = 'Approaching Expectations';
      }

      // Upsert aggregate
      const { data: existingAggregate } = await supabase
        .from('assessment_aggregates')
        .select('aggregate_id')
        .eq('student_id', studentId)
        .eq('term_id', term_id)
        .eq('learning_area_id', learning_area_id)
        .maybeSingle();

      if (existingAggregate) {
        await supabase
          .from('assessment_aggregates')
          .update({
            average_score: parseFloat(averageScore.toFixed(2)),
            performance_level: performanceLevel,
            total_competencies: scores.length,
            updated_at: timestamp,
          })
          .eq('aggregate_id', existingAggregate.aggregate_id);
      } else {
        await supabase.from('assessment_aggregates').insert({
          student_id: studentId,
          term_id,
          learning_area_id,
          class_id,
          average_score: parseFloat(averageScore.toFixed(2)),
          performance_level: performanceLevel,
          total_competencies: scores.length,
          school_id: schoolId,
          created_at: timestamp,
          updated_at: timestamp,
        });
      }
    }
  }

  // 13. Calculate score distribution for response
  const scoreDistribution = {
    score_1: records.filter((r) => r.score === 1).length,
    score_2: records.filter((r) => r.score === 2).length,
    score_3: records.filter((r) => r.score === 3).length,
    score_4: records.filter((r) => r.score === 4).length,
  };

  const averageScore =
    records.reduce((sum, r) => sum + r.score, 0) / records.length;

  // 14. Build response
  const totalProcessed = insertedCount + updatedCount;
  const totalErrors = insertErrors.length + updateErrors.length;
  const hasErrors = totalErrors > 0;

  const message = hasErrors
    ? `Partially completed: ${insertedCount} inserted, ${updatedCount} updated, ${totalErrors} error(s)`
    : `Successfully saved ${insertedCount} new and updated ${updatedCount} existing assessment(s)`;

  return successResponse(
    {
      term_id,
      term_name: term.name,
      class_id,
      class_name: classRecord.name,
      learning_area_id,
      learning_area_name: learningArea.name,
      assessment_date: assessDate,
      inserted: insertedCount,
      updated: updatedCount,
      total_processed: totalProcessed,
      students_assessed: affectedStudentIds.length,
      competencies_assessed: competencyIds.length,
      score_distribution: scoreDistribution,
      average_score: parseFloat(averageScore.toFixed(2)),
      aggregates_updated: affectedStudentIds.length,
      errors: hasErrors ? [...insertErrors, ...updateErrors] : [],
    },
    message,
    hasErrors ? 207 : 200
  );
}
