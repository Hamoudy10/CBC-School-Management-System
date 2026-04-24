/**
 * Job to compute and store attendance trends for analytics
 * Runs daily to update attendance metrics
 */
import { logger } from '../../../lib/logger';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | string;

interface AttendanceRecord {
  id: number | string;
  date: string;
  status: AttendanceStatus;
}

interface StudentWithAttendance {
  id: number | string;
  attendance: AttendanceRecord[] | null;
}

interface ClassWithStudents {
  id: number | string;
  name: string;
  grade_level: number | string | null;
  students: StudentWithAttendance[] | null;
}

interface DailyAttendanceTrend {
  date: string;
  total_records: number;
  present_count: number;
  attendance_rate: number;
}

/**
 * Compute attendance trends and store in analytics_snapshots table
 * @param {SupabaseClient} supabase - Supabase client instance
 */
export async function computeAttendanceTrendsJob(supabase: any): Promise<void> {
  try {
    logger.info('Starting compute attendance trends job', {
      source: 'pipeline.jobs.computeAttendanceTrends'
    });

    // Get all classes with their students and attendance records
    const { data: classes, error: classesError }: { data: ClassWithStudents[] | null; error: unknown } = await supabase
      .from('classes')
      .select(`
        id,
        name,
        grade_level,
        students (
          id,
          attendance (
            id,
            date,
            status
          )
        )
      `);

    if (classesError) {
      throw classesError;
    }

    if (!classes || classes.length === 0) {
      logger.info('No classes found for attendance trend computation', {
        source: 'pipeline.jobs.computeAttendanceTrends'
      });
      return;
    }

    // Process each class
    for (const classItem of classes) {
      const classId = classItem.id;
      const className = classItem.name;
      const gradeLevel = classItem.grade_level;
      const students = classItem.students ?? [];
      
      // Get all attendance records for students in this class (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const allAttendance: AttendanceRecord[] = [];
      for (const student of students) {
        const attendanceRecords = student.attendance ?? [];
        const recentAttendance = attendanceRecords.filter((record: AttendanceRecord) =>
          new Date(record.date) >= thirtyDaysAgo
        );
        allAttendance.push(...recentAttendance);
      }

      if (allAttendance.length === 0) {
        logger.debug(`No attendance records found for class ${classId} in last 30 days`, {
          source: 'pipeline.jobs.computeAttendanceTrends',
          classId
        });
        continue;
      }

      // Calculate attendance metrics
      const totalRecords = allAttendance.length;
      const presentCount = allAttendance.filter(record => record.status === 'present').length;
      const absentCount = allAttendance.filter(record => record.status === 'absent').length;
      const lateCount = allAttendance.filter(record => record.status === 'late').length;
      const excusedCount = allAttendance.filter(record => record.status === 'excused').length;
      
      const attendanceRate = (presentCount / totalRecords) * 100;
      const punctualityRate = ((presentCount + lateCount) / totalRecords) * 100;

      // Calculate daily attendance trends (last 7 days)
      const dailyTrends: DailyAttendanceTrend[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        const dayAttendance = allAttendance.filter(record => 
          record.date === dateString
        );
        
        const dayTotal = dayAttendance.length;
        const dayPresent = dayAttendance.filter(record => record.status === 'present').length;
        const dayRate = dayTotal > 0 ? (dayPresent / dayTotal) * 100 : 0;
        
        dailyTrends.push({
          date: dateString,
          total_records: dayTotal,
          present_count: dayPresent,
          attendance_rate: dayRate
        });
      }

      // Prepare metrics JSON
      const metrics = {
        class_id: classId,
        class_name: className,
        grade_level: gradeLevel,
        attendance_rate: attendanceRate,
        punctuality_rate: punctualityRate,
        total_records: totalRecords,
        present_count: presentCount,
        absent_count: absentCount,
        late_count: lateCount,
        excused_count: excusedCount,
        daily_trends: dailyTrends.reverse(), // Most recent first
        calculated_at: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0] // Just the date part
      };

      // Store in analytics_snapshots table
      const { error: upsertError } = await supabase
        .from('analytics_snapshots')
        .upsert({
          class_id: classId,
          metrics_json: metrics,
          snapshot_type: 'attendance_trends',
          date: new Date().toISOString().split('T')[0],
          period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
          period_end: new Date().toISOString().split('T')[0]
        }, {
          onConflict: 'class_id,snapshot_type,date'
        });

      if (upsertError) {
        throw upsertError;
      }

      logger.debug(`Computed and stored attendance analytics for class ${classId}`, {
        source: 'pipeline.jobs.computeAttendanceTrends',
        classId,
        attendanceRate
      });
    }

    logger.info('Completed compute attendance trends job', {
      source: 'pipeline.jobs.computeAttendanceTrends'
    });
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error('Unknown error');

    logger.error('Failed to compute attendance trends job', {
      source: 'pipeline.jobs.computeAttendanceTrends',
      error: normalizedError
    });
    throw normalizedError;
  }
}

export default computeAttendanceTrendsJob;
