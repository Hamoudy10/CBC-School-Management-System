/**
 * Offline assessments service
 * Handles offline assessment recording and synchronization
 */
import offlineStorage from '../../../lib/offline/storage';
import { queueSyncOperation } from '../../../lib/offline/sync.engine';
import { logger } from '../../../lib/logger';

/**
 * Record assessment offline
 * @param {Object} assessmentData - Assessment data to record
 * @returns {Promise<string>} ID of the offline assessment record
 */
export async function recordAssessmentOffline(assessmentData: any): Promise<string> {
  try {
    // Validate required fields
    const requiredFields = ['student_id', 'competency_id', 'score'];
    for (const field of requiredFields) {
      if (!assessmentData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Generate offline ID if not provided
    const assessmentId = assessmentData.id || offlineStorage.generateOfflineId();
    
    // Prepare assessment record for offline storage
    const offlineAssessment = {
      id: assessmentId,
      student_id: assessmentData.student_id,
      competency_id: assessmentData.competency_id,
      learning_area_id: assessmentData.learning_area_id || null,
      class_id: assessmentData.class_id || null,
      academic_year_id: assessmentData.academic_year_id || null,
      term_id: assessmentData.term_id || null,
      score: assessmentData.score,
      level_id: assessmentData.level_id || null,
      remarks: assessmentData.remarks || null,
      assessment_date: assessmentData.assessment_date || new Date().toISOString().split('T')[0],
      assessed_by: assessmentData.assessed_by || null,
      created_at: assessmentData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_offline: true,
      synced: false
    };
    
    // Store in local IndexedDB
    await offlineStorage.addToStore('assessments', offlineAssessment);
    
    // Queue for synchronization
    await queueSyncOperation(
      'assessments',
      assessmentId,
      'INSERT',
      offlineAssessment,
      9 // Very high priority for assessments
    );
    
    logger.info('Assessment recorded offline and queued for sync', {
      source: 'offline.assessments.service',
      assessmentId,
      studentId: assessmentData.student_id,
      competencyId: assessmentData.competency_id,
      score: assessmentData.score
    });
    
    return assessmentId;
  } catch (error) {
    logger.error('Failed to record assessment offline', {
      source: 'offline.assessments.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

/**
 * Get offline assessments records
 * @param {Object} filters - Optional filters (student_id, competency_id, date_range, etc.)
 * @returns {Promise<Array<Object>>} Array of assessment records
 */
export async function getOfflineAssessments(filters: any = {}): Promise<any[]> {
  try {
    const allAssessments = await offlineStorage.getAllFromStore('assessments');
    
    // Apply filters
    return allAssessments.filter(record => {
      // Filter by student_id
      if (filters.student_id && record.student_id !== filters.student_id) {
        return false;
      }
      
      // Filter by competency_id
      if (filters.competency_id && record.competency_id !== filters.competency_id) {
        return false;
      }
      
      // Filter by learning_area_id
      if (filters.learning_area_id && record.learning_area_id !== filters.learning_area_id) {
        return false;
      }
      
      // Filter by date range
      if (filters.start_date && new Date(record.assessment_date) < new Date(filters.start_date)) {
        return false;
      }
      if (filters.end_date && new Date(record.assessment_date) > new Date(filters.end_date)) {
        return false;
      }
      
      // Filter by score range
      if (filters.min_score !== undefined && record.score < filters.min_score) {
        return false;
      }
      if (filters.max_score !== undefined && record.score > filters.max_score) {
        return false;
      }
      
      // Filter by synced status
      if (filters.synced !== undefined && record.synced !== filters.synced) {
        return false;
      }
      
      return true;
    });
} catch (error) {
    logger.error('Failed to get offline assessments records', {
      source: 'offline.assessments.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    return [];
  }
}

/**
 * Mark assessment record as synced
 * @param {string} assessmentId - ID of the assessment record
 * @returns {Promise<void>}
 */
export async function markAssessmentAsSynced(assessmentId: string): Promise<void> {
  try {
    const assessment = await offlineStorage.getFromStore('assessments', assessmentId);
    if (assessment) {
      assessment.synced = true;
      assessment.updated_at = new Date().toISOString();
      await offlineStorage.updateStore('assessments', assessment);
      
      logger.debug('Marked assessment as synced', {
        source: 'offline.assessments.service',
        assessmentId
      });
    }
} catch (error) {
    logger.error('Failed to mark assessment as synced', {
      source: 'offline.assessments.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

/**
 * Get unsynced assessment records
 * @returns {Promise<Array<Object>>} Array of unsynced assessment records
 */
export async function getUnsyncedAssessments(): Promise<any[]> {
  try {
    const allAssessments = await offlineStorage.getAllFromStore('assessments');
    return allAssessments.filter(record => !record.synced);
  } catch (error) {
    logger.error('Failed to get unsynced assessment records', {
      source: 'offline.assessments.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    return [];
  }
}

/**
 * Delete offline assessment record
 * @param {string} assessmentId - ID of the assessment record to delete
 * @returns {Promise<void>}
 */
export async function deleteOfflineAssessment(assessmentId: string): Promise<void> {
  try {
    // Get the record first to confirm it exists
    const assessment = await offlineStorage.getFromStore('assessments', assessmentId);
    if (assessment) {
      // If it was synced, we need to queue a delete operation
      if (assessment.synced) {
        await queueSyncOperation(
          'assessments',
          assessmentId,
          'DELETE',
          null,
          9 // Very high priority
        );
      }
      
      // Remove from local storage
      await offlineStorage.deleteFromStore('assessments', assessmentId);
      
      logger.debug('Deleted offline assessment record', {
        source: 'offline.assessments.service',
        assessmentId
      });
    }
} catch (error) {
    logger.error('Failed to delete offline assessment record', {
      source: 'offline.assessments.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

export default {
  recordAssessmentOffline,
  getOfflineAssessments,
  markAssessmentAsSynced,
  getUnsyncedAssessments,
  deleteOfflineAssessment
};