/**
 * Job to compute and store class averages for analytics
 * Runs daily to update class performance metrics
 */
import { logger } from '../../../lib/logger';

/**
 * Compute class averages and store in analytics_snapshots table
 * @param {SupabaseClient} supabase - Supabase client instance
 */
export async function computeClassAveragesJob(supabase: any): Promise<void> {
  try {
    logger.info('Starting compute class averages job', {
      source: 'pipeline.jobs.computeClassAverages'
    });

    // Get all classes with their students and assessments
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select(`
        id,
        name,
        grade_level,
        students (
          id,
          assessments (
            id,
            score,
            competency_id,
            competencies (
              learning_area_id
            )
          )
        )
      `);

    if (classesError) throw classesError;

    // Process each class
    for (const classItem of classes) {
      const classId = classItem.id;
      const className = classItem.name;
      const gradeLevel = classItem.grade_level;
      
      // Get all assessments for students in this class
      const allAssessments = [];
      for (const student of classItem.students) {
        if (student.assessments) {
          allAssessments.push(...student.assessments);
        }
      }

      if (allAssessments.length === 0) {
        logger.debug(`No assessments found for class ${classId}`, {
          source: 'pipeline.jobs.computeClassAverages',
          classId
        });
        continue;
      }

      // Calculate overall average
      const totalScore = allAssessments.reduce((sum, assessment) => sum + assessment.score, 0);
      const overallAverage = totalScore / allAssessments.length;

      // Calculate averages by learning area
      const learningAreaScores: Record<number, { sum: number; count: number }> = {};
      for (const assessment of allAssessments) {
        const learningAreaId = assessment.competencies?.learning_area_id;
        if (learningAreaId !== undefined) {
          if (!learningAreaScores[learningAreaId]) {
            learningAreaScores[learningAreaId] = { sum: 0, count: 0 };
          }
          learningAreaScores[learningAreaId].sum += assessment.score;
          learningAreaScores[learningAreaId].count += 1;
        }
      }

      const learningAreaAverages: Record<number, number> = {};
      for (const [areaId, data] of Object.entries(learningAreaScores)) {
        learningAreaAverages[parseInt(areaId)] = data.sum / data.count;
      }

      // Prepare metrics JSON
      const metrics = {
        class_id: classId,
        class_name: className,
        grade_level: gradeLevel,
        overall_average: overallAverage,
        total_assessments: allAssessments.length,
        total_students: classItem.students.length,
        learning_area_averages: learningAreaAverages,
        calculated_at: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0] // Just the date part
      };

      // Store in analytics_snapshots table
      const { error: upsertError } = await supabase
        .from('analytics_snapshots')
        .upsert({
          class_id: classId,
          metrics_json: metrics,
          snapshot_type: 'class_performance',
          date: new Date().toISOString().split('T')[0],
          period_start: new Date().toISOString().split('T')[0], // Simplified - would calculate actual period
          period_end: new Date().toISOString().split('T')[0]
        }, {
          onConflict: 'class_id,snapshot_type,date'
        });

      if (upsertError) throw upsertError;

      logger.debug(`Computed and stored analytics for class ${classId}`, {
        source: 'pipeline.jobs.computeClassAverages',
        classId,
        overallAverage
      });
    }

    logger.info('Completed compute class averages job', {
      source: 'pipeline.jobs.computeClassAverages'
    });
  } catch (error) {
    logger.error('Failed to compute class averages job', {
      source: 'pipeline.jobs.computeClassAverages',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

export default computeClassAveragesJob;