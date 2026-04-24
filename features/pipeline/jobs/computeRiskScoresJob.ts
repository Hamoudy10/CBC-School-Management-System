/**
 * Job to compute and store student risk scores for analytics
 * Runs daily to update risk assessment metrics
 */
import { logger } from '../../../lib/logger';

interface AttendanceRecord {
  date: string;
  status: string;
}

interface AssessmentRecord {
  score: number;
  assessment_date: string;
}

interface StudentWithMetrics {
  id: number | string;
  user_id: string | null;
  current_class_id: number | string | null;
  attendance: AttendanceRecord[] | null;
  assessments: AssessmentRecord[] | null;
}

interface RiskFactor {
  factor: 'attendance' | 'academic_performance';
  value: number | null;
  risk_contribution: number;
}

/**
 * Compute student risk scores and store in student_risk_scores table
 * @param {SupabaseClient} supabase - Supabase client instance
 */
export async function computeRiskScoresJob(supabase: any): Promise<void> {
  try {
    logger.info('Starting compute risk scores job', {
      source: 'pipeline.jobs.computeRiskScores'
    });

    // Get all students with their recent attendance and assessments
    const { data: students, error: studentsError }: { data: StudentWithMetrics[] | null; error: unknown } = await supabase
      .from('students')
      .select(`
        id,
        user_id,
        current_class_id,
        attendance (
          date,
          status
        ),
        assessments (
          score,
          assessment_date
        )
      `);

    if (studentsError) {
      throw studentsError;
    }

    if (!students || students.length === 0) {
      logger.info('No students found for risk score computation', {
        source: 'pipeline.jobs.computeRiskScores'
      });
      return;
    }

    // Process each student
    for (const student of students) {
      const studentId = student.id;
      
      // Get attendance records from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentAttendance = student.attendance
        ? student.attendance.filter((record: AttendanceRecord) =>
            new Date(record.date) >= thirtyDaysAgo
          )
        : [];
      
      // Get assessments from last 30 days
      const recentAssessments = student.assessments
        ? student.assessments.filter((record: AssessmentRecord) =>
            new Date(record.assessment_date) >= thirtyDaysAgo
          )
        : [];

      // Calculate risk factors
      const riskFactors: RiskFactor[] = [];
      let riskScore = 0; // 0-100 scale, higher = higher risk
      
      // Attendance risk factor (weight: 40%)
      if (recentAttendance.length > 0) {
        const attendanceRate = (recentAttendance.filter((attendance: AttendanceRecord) => attendance.status === 'present').length / recentAttendance.length) * 100;
        const attendanceRisk = Math.max(0, 100 - attendanceRate); // Invert so lower attendance = higher risk
        riskFactors.push({
          factor: 'attendance',
          value: attendanceRate,
          risk_contribution: attendanceRisk * 0.4
        });
        riskScore += attendanceRisk * 0.4;
      } else {
        // No attendance data = moderate risk
        riskFactors.push({
          factor: 'attendance',
          value: null,
          risk_contribution: 20 // Assume 40% risk weight * 50% default risk
        });
        riskScore += 20;
      }
      
      // Academic performance risk factor (weight: 40%)
      if (recentAssessments.length > 0) {
        const avgScore = recentAssessments.reduce((sum: number, assessment: AssessmentRecord) => sum + assessment.score, 0) / recentAssessments.length;
        const performanceRisk = Math.max(0, 100 - avgScore); // Invert so lower scores = higher risk
        riskFactors.push({
          factor: 'academic_performance',
          value: avgScore,
          risk_contribution: performanceRisk * 0.4
        });
        riskScore += performanceRisk * 0.4;
      } else {
        // No assessment data = moderate risk
        riskFactors.push({
          factor: 'academic_performance',
          value: null,
          risk_contribution: 20 // Assume 40% risk weight * 50% default risk
        });
        riskScore += 20;
      }
      
      // Determine risk level based on score
      let riskLevel: 'low' | 'medium' | 'high';
      if (riskScore < 30) {
        riskLevel = 'low';
      } else if (riskScore < 70) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'high';
      }
      
      // Calculate confidence based on data availability
      const hasAttendanceData = recentAttendance.length > 0;
      const hasAssessmentData = recentAssessments.length > 0;
      const dataAvailability = (hasAttendanceData ? 1 : 0.5) + (hasAssessmentData ? 1 : 0.5);
      const confidence = Math.min(0.95, 0.5 + (dataAvailability * 0.25)); // 0.5 to 0.95
      
      // Store or update risk score in database
      const { error: upsertError } = await supabase
        .from('student_risk_scores')
        .upsert({
          student_id: studentId,
          risk_level: riskLevel,
          risk_factors: riskFactors,
          confidence_score: confidence,
          computed_at: new Date().toISOString(),
          valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Valid for 24 hours
        }, {
          onConflict: 'student_id'
        });

      if (upsertError) {
        throw upsertError;
      }

      logger.debug(`Computed and stored risk score for student ${studentId}`, {
        source: 'pipeline.jobs.computeRiskScores',
        studentId,
        riskLevel,
        riskScore,
        confidence
      });
    }

    logger.info('Completed compute risk scores job', {
      source: 'pipeline.jobs.computeRiskScores'
    });
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error('Unknown error');

    logger.error('Failed to compute risk scores job', {
      source: 'pipeline.jobs.computeRiskScores',
      error: normalizedError
    });
    throw normalizedError;
  }
}

export default computeRiskScoresJob;
