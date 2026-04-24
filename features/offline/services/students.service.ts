/**
 * Offline students service
 * Handles offline student data access and synchronization
 */
import offlineStorage from '../../../lib/offline/storage';
import { queueSyncOperation } from '../../../lib/offline/sync.engine';
import { logger } from '../../../lib/logger';

/**
 * Get offline students records
 * @param {Object} filters - Optional filters (class_id, status, search_term, etc.)
 * @returns {Promise<Array<Object>>} Array of student records
 */
export async function getOfflineStudents(filters: any = {}): Promise<any[]> {
  try {
    const allStudents = await offlineStorage.getAllFromStore('students');
    
    // Apply filters
    return allStudents.filter(student => {
      // Filter by class_id
      if (filters.class_id && student.current_class_id !== filters.class_id) {
        return false;
      }
      
      // Filter by status
      if (filters.status && student.status !== filters.status) {
        return false;
      }
      
      // Filter by search term (name or admission number)
      if (filters.search_term) {
        const searchTerm = filters.search_term.toLowerCase();
        const fullName = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
        const admissionNumber = student.admission_number?.toLowerCase() || '';
        
        if (!fullName.includes(searchTerm) && !admissionNumber.includes(searchTerm)) {
          return false;
        }
      }
      
      // Filter by gender
      if (filters.gender && student.gender !== filters.gender) {
        return false;
      }
      
      // Filter by has_special_needs
      if (filters.has_special_needs !== undefined && student.has_special_needs !== filters.has_special_needs) {
        return false;
      }
      
      return true;
    });
} catch (error) {
    logger.error('Failed to get offline students records', {
      source: 'offline.students.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    return [];
  }
}

/**
 * Get a specific offline student by ID
 * @param {string} studentId - ID of the student
 * @returns {Promise<Object|null>} Student record or null if not found
 */
export async function getOfflineStudentById(studentId: string): Promise<any | null> {
  try {
    const student = await offlineStorage.getFromStore('students', studentId);
    return student || null;
} catch (error) {
    logger.error('Failed to get offline student by ID', {
      source: 'offline.students.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    return null;
  }
}

/**
 * Update offline student record
 * @param {string} studentId - ID of the student to update
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateOfflineStudent(studentId: string, updates: any): Promise<void> {
  try {
    const student = await offlineStorage.getFromStore('students', studentId);
    if (!student) {
      throw new Error(`Student not found: ${studentId}`);
    }
    
    // Merge updates with existing student data
    const updatedStudent = {
      ...student,
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    // Store updated record
    await offlineStorage.updateStore('students', updatedStudent);
    
    // Queue for synchronization if the student was previously synced
    // For simplicity, we'll queue all updates as INSERT operations (upsert behavior)
    await queueSyncOperation(
      'students',
      studentId,
      'UPDATE',
      updatedStudent,
      5 // Medium priority for student updates
    );
    
    logger.debug('Updated offline student record', {
      source: 'offline.students.service',
      studentId
    });
} catch (error) {
    logger.error('Failed to update offline student', {
      source: 'offline.students.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

/**
 * Get unsynced student records
 * @returns {Promise<Array<Object>>} Array of unsynced student records
 */
export async function getUnsyncedStudents(): Promise<any[]> {
  try {
    // For students, we typically don't track individual sync status as they're reference data
    // Instead, we might want to track when the full student list was last synced
    // For now, return all students as they may need to be available offline
    return await offlineStorage.getAllFromStore('students');
  } catch (error) {
    logger.error('Failed to get unsynced students', {
      source: 'offline.students.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    return [];
  }
}

/**
 * Mark student data as synced (typically called after initial load)
 * @param {Array<Object>} students - Array of student records
 * @returns {Promise<void>}
 */
export async function markStudentsAsSynced(students: any[]): Promise<void> {
  try {
    // Store each student as synced
    for (const student of students) {
      const studentWithSyncFlag = {
        ...student,
        synced: true,
        updated_at: new Date().toISOString()
      };
      await offlineStorage.updateStore('students', studentWithSyncFlag);
    }
    
    logger.debug('Marked students as synced', {
      source: 'offline.students.service',
      count: students.length
    });
  } catch (error) {
    logger.error('Failed to mark students as synced', {
      source: 'offline.students.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

/**
 * Seed initial student data for offline use
 * This would typically be called after login to populate the local store
 * @param {Array<Object>} students - Array of student records from server
 * @returns {Promise<void>}
 */
export async function seedOfflineStudents(students: any[]): Promise<void> {
  try {
    // Clear existing student data
    await offlineStorage.clearStore('students');
    
    // Add all students to local storage
    for (const student of students) {
      const offlineStudent = {
        ...student,
        updated_at: new Date().toISOString()
      };
      await offlineStorage.addToStore('students', offlineStudent);
    }
    
    logger.info('Seeded offline student data', {
      source: 'offline.students.service',
      count: students.length
    });
  } catch (error) {
    logger.error('Failed to seed offline student data', {
      source: 'offline.students.service',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

export default {
  getOfflineStudents,
  getOfflineStudentById,
  updateOfflineStudent,
  getUnsyncedStudents,
  markStudentsAsSynced,
  seedOfflineStudents
};