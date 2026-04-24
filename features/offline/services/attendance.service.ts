/**
 * Offline attendance service
 * Handles offline attendance recording and synchronization
 */
import offlineStorage from '../../../lib/offline/storage';
import { queueSyncOperation } from '../../../lib/offline/sync.engine';
import { logger } from '../../../lib/logger';

/**
 * Record attendance offline
 * @param {Object} attendanceData - Attendance data to record
 * @returns {Promise<string>} ID of the offline attendance record
 */
export async function recordAttendanceOffline(attendanceData: any): Promise<string> {
  try {
    // Validate required fields
    const requiredFields = ['student_id', 'class_id', 'date', 'status'];
    for (const field of requiredFields) {
      if (!attendanceData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Generate offline ID if not provided
    const attendanceId = attendanceData.id || offlineStorage.generateOfflineId();
    
    // Prepare attendance record for offline storage
    const offlineAttendance = {
      id: attendanceId,
      student_id: attendanceData.student_id,
      class_id: attendanceData.class_id,
      term_id: attendanceData.term_id || null,
      date: attendanceData.date,
      status: attendanceData.status,
      reason: attendanceData.reason || null,
      recorded_by: attendanceData.recorded_by || null,
      created_at: attendanceData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_offline: true,
      synced: false
    };
    
    // Store in local IndexedDB
    await offlineStorage.addToStore('attendance', offlineAttendance);
    
    // Queue for synchronization
    await queueSyncOperation(
      'attendance',
      attendanceId,
      'INSERT',
      offlineAttendance,
      8 // High priority for attendance
    );
    
    logger.info('Attendance recorded offline and queued for sync', {
      source: 'offline.attendance.service',
      attendanceId,
      studentId: attendanceData.student_id,
      date: attendanceData.date,
      status: attendanceData.status
    });
    
    return attendanceId;
  } catch (error) {
    logger.error('Failed to record attendance offline', {
      source: 'offline.attendance.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

/**
 * Get offline attendance records
 * @param {Object} filters - Optional filters (student_id, date_range, etc.)
 * @returns {Promise<Array<Object>>} Array of attendance records
 */
export async function getOfflineAttendance(filters: any = {}): Promise<any[]> {
  try {
    const allAttendance = await offlineStorage.getAllFromStore('attendance');
    
    // Apply filters
    return allAttendance.filter(record => {
      // Filter by student_id
      if (filters.student_id && record.student_id !== filters.student_id) {
        return false;
      }
      
      // Filter by date range
      if (filters.start_date && new Date(record.date) < new Date(filters.start_date)) {
        return false;
      }
      if (filters.end_date && new Date(record.date) > new Date(filters.end_date)) {
        return false;
      }
      
      // Filter by status
      if (filters.status && record.status !== filters.status) {
        return false;
      }
      
      // Filter by synced status
      if (filters.synced !== undefined && record.synced !== filters.synced) {
        return false;
      }
      
      return true;
    });
  } catch (error) {
    logger.error('Failed to get offline attendance records', {
      source: 'offline.attendance.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    return [];
  }
}

/**
 * Mark attendance record as synced
 * @param {string} attendanceId - ID of the attendance record
 * @returns {Promise<void>}
 */
export async function markAttendanceAsSynced(attendanceId: string): Promise<void> {
  try {
    const attendance = await offlineStorage.getFromStore('attendance', attendanceId);
    if (attendance) {
      attendance.synced = true;
      attendance.updated_at = new Date().toISOString();
      await offlineStorage.updateStore('attendance', attendance);
      
      logger.debug('Marked attendance as synced', {
        source: 'offline.attendance.service',
        attendanceId
      });
    }
} catch (error) {
    logger.error('Failed to mark attendance as synced', {
      source: 'offline.attendance.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

/**
 * Get unsynced attendance records
 * @returns {Promise<Array<Object>>} Array of unsynced attendance records
 */
export async function getUnsyncedAttendance(): Promise<any[]> {
  try {
    const allAttendance = await offlineStorage.getAllFromStore('attendance');
    return allAttendance.filter(record => !record.synced);
} catch (error) {
    logger.error('Failed to get offline attendance records', {
      source: 'offline.attendance.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    return [];
  }
}

/**
 * Delete offline attendance record
 * @param {string} attendanceId - ID of the attendance record to delete
 * @returns {Promise<void>}
 */
export async function deleteOfflineAttendance(attendanceId: string): Promise<void> {
  try {
    // Get the record first to confirm it exists
    const attendance = await offlineStorage.getFromStore('attendance', attendanceId);
    if (attendance) {
      // If it was synced, we need to queue a delete operation
      if (attendance.synced) {
        await queueSyncOperation(
          'attendance',
          attendanceId,
          'DELETE',
          null,
          8 // High priority
        );
      }
      
      // Remove from local storage
      await offlineStorage.deleteFromStore('attendance', attendanceId);
      
      logger.debug('Deleted offline attendance record', {
        source: 'offline.attendance.service',
        attendanceId
      });
    }
} catch (error) {
    logger.error('Failed to get offline attendance records', {
      source: 'offline.attendance.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

export default {
  recordAttendanceOffline,
  getOfflineAttendance,
  markAttendanceAsSynced,
  getUnsyncedAttendance,
  deleteOfflineAttendance
};