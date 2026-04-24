/**
 * Pipeline service for running daily intelligence jobs
 * Computes and stores analytics data for the school management system
 */
import { logger } from '@/lib/logger';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { computeClassAveragesJob } from '../jobs/computeClassAveragesJob';
import { computeAttendanceTrendsJob } from '../jobs/computeAttendanceTrendsJob';
import { computeRiskScoresJob } from '../jobs/computeRiskScoresJob';

/**
 * Run all daily pipeline jobs
 * This function should be triggered daily (e.g., via cron job)
 */
export async function runDailyPipelineJobs(): Promise<void> {
  try {
    logger.info('Starting daily pipeline jobs', {
      source: 'pipeline.service'
    });

    const supabase = await createSupabaseServerClient();

    // Run jobs in sequence (they can be run in parallel if needed, but we'll do sequence for simplicity)
    await computeClassAveragesJob(supabase);
    logger.info('Completed compute class averages job', {
      source: 'pipeline.service'
    });

    await computeAttendanceTrendsJob(supabase);
    logger.info('Completed compute attendance trends job', {
      source: 'pipeline.service'
    });

    await computeRiskScoresJob(supabase);
    logger.info('Completed compute risk scores job', {
      source: 'pipeline.service'
    });

    logger.info('All daily pipeline jobs completed successfully', {
      source: 'pipeline.service'
    });
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error('Unknown error');

    logger.error('Failed to run daily pipeline jobs', {
      source: 'pipeline.service',
      error: normalizedError
    });
    throw normalizedError;
  }
}

/**
 * Run a specific pipeline job
 * @param {string} jobName - Name of the job to run (classAverages, attendanceTrends, riskScores)
 */
export async function runPipelineJob(jobName: string): Promise<void> {
  try {
    logger.info(`Starting pipeline job: ${jobName}`, {
      source: 'pipeline.service'
    });

    const supabase = await createSupabaseServerClient();

    switch (jobName) {
      case 'classAverages':
        await computeClassAveragesJob(supabase);
        break;
      case 'attendanceTrends':
        await computeAttendanceTrendsJob(supabase);
        break;
      case 'riskScores':
        await computeRiskScoresJob(supabase);
        break;
      default:
        throw new Error(`Unknown pipeline job: ${jobName}`);
    }

    logger.info(`Completed pipeline job: ${jobName}`, {
      source: 'pipeline.service'
    });
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error('Unknown error');

    logger.error(`Failed to run pipeline job: ${jobName}`, {
      source: 'pipeline.service',
      error: normalizedError
    });
    throw normalizedError;
  }
}

export default {
  runDailyPipelineJobs,
  runPipelineJob
};
