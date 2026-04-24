/**
 * Offline metadata management
 * Tracks synchronization state for users and devices
 */
import offlineStorage from './storage';
import { logger } from '../logger';

/**
 * Get or create offline metadata for a user/device/school combination
 * @param {string} userId - User ID
 * @param {string} deviceId - Device identifier
 * @param {string} schoolId - School ID
 * @returns {Promise<Object>} Offline metadata record
 */
export async function getOrCreateOfflineMetadata(userId: string, deviceId: string, schoolId: string): Promise<any> {
  try {
    // Try to get existing metadata
    const metadataList = await offlineStorage.getAllFromStore('offline_metadata');
    const existingMetadata = metadataList.find(meta => 
      meta.user_id === userId && 
      meta.device_id === deviceId && 
      meta.school_id === schoolId
    );
    
    if (existingMetadata) {
      return existingMetadata;
    }
    
    // Create new metadata record
    const newMetadata = {
      id: offlineStorage.generateOfflineId(),
      user_id: userId,
      device_id: deviceId,
      school_id: schoolId,
      last_sync: null,
      sync_in_progress: false,
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    await offlineStorage.addToStore('offline_metadata', newMetadata);
    logger.debug('Created new offline metadata record', {
      source: 'offline.metadata',
      userId,
      deviceId,
      schoolId,
      metadataId: newMetadata.id
    });
    
    return newMetadata;
  } catch (error) {
    logger.error('Failed to get or create offline metadata', {
      source: 'offline.metadata',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

/**
 * Update offline metadata
 * @param {string} metadataId - ID of the metadata record
 * @param {Partial<Object>} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateOfflineMetadata(metadataId: string, updates: Partial<any>): Promise<void> {
  try {
    const metadata = await offlineStorage.getFromStore('offline_metadata', metadataId);
    if (!metadata) {
      throw new Error(`Offline metadata not found: ${metadataId}`);
    }
    
    const updatedMetadata = {
      ...metadata,
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    await offlineStorage.updateStore('offline_metadata', updatedMetadata);
    logger.debug('Updated offline metadata', {
      source: 'offline.metadata',
      metadataId,
      updates
    });
  } catch (error) {
    logger.error('Failed to update offline metadata', {
      source: 'offline.metadata',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

/**
 * Mark sync as started for a user/device
 * @param {string} userId - User ID
 * @param {string} deviceId - Device identifier
 * @param {string} schoolId - School ID
 * @returns {Promise<string>} Metadata ID
 */
export async function markSyncStarted(userId: string, deviceId: string, schoolId: string): Promise<string> {
  try {
    const metadata = await getOrCreateOfflineMetadata(userId, deviceId, schoolId);
    await updateOfflineMetadata(metadata.id, { sync_in_progress: true });
    logger.debug('Marked sync as started', {
      source: 'offline.metadata',
      userId,
      deviceId,
      schoolId,
      metadataId: metadata.id
    });
    return metadata.id;
  } catch (error) {
    logger.error('Failed to mark sync as started', {
      source: 'offline.metadata',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

/**
 * Mark sync as completed for a user/device
 * @param {string} userId - User ID
 * @param {string} deviceId - Device identifier
 * @param {string} schoolId - School ID
 * @param {Error|null} error - Error if sync failed
 * @returns {Promise<void>}
 */
export async function markSyncCompleted(userId: string, deviceId: string, schoolId: string, error: Error | null = null): Promise<void> {
  try {
    const metadataList = await offlineStorage.getAllFromStore('offline_metadata');
    const metadata = metadataList.find(meta => 
      meta.user_id === userId && 
      meta.device_id === deviceId && 
      meta.school_id === schoolId
    );
    
    if (!metadata) {
      throw new Error(`Offline metadata not found for user ${userId}, device ${deviceId}, school ${schoolId}`);
    }
    
    const updates: Partial<any> = {
      sync_in_progress: false,
      last_sync: new Date().toISOString()
    };
    
    if (error) {
      updates.last_error = error.message;
    } else {
      updates.last_error = null;
    }
    
    await updateOfflineMetadata(metadata.id, updates);
    logger.debug('Marked sync as completed', {
      source: 'offline.metadata',
      userId,
      deviceId,
      schoolId,
      metadataId: metadata.id,
      success: error === null
    });
  } catch (error) {
    logger.error('Failed to mark sync as completed', {
      source: 'offline.metadata',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

/**
 * Get the last sync time for a user/device
 * @param {string} userId - User ID
 * @param {string} deviceId - Device identifier
 * @param {string} schoolId - School ID
 * @returns {Promise<string|null>} Last sync timestamp or null if never synced
 */
export async function getLastSyncTime(userId: string, deviceId: string, schoolId: string): Promise<string | null> {
  try {
    const metadataList = await offlineStorage.getAllFromStore('offline_metadata');
    const metadata = metadataList.find(meta => 
      meta.user_id === userId && 
      meta.device_id === deviceId && 
      meta.school_id === schoolId
    );
    
    return metadata ? metadata.last_sync : null;
  } catch (error) {
    logger.error('Failed to get last sync time', {
      source: 'offline.metadata',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    return null;
  }
}

/**
 * Check if sync is currently in progress for a user/device
 * @param {string} userId - User ID
 * @param {string} deviceId - Device identifier
 * @param {string} schoolId - School ID
 * @returns {Promise<boolean>} True if sync is in progress
 */
export async function isSyncInProgress(userId: string, deviceId: string, schoolId: string): Promise<boolean> {
  try {
    const metadataList = await offlineStorage.getAllFromStore('offline_metadata');
    const metadata = metadataList.find(meta => 
      meta.user_id === userId && 
      meta.device_id === deviceId && 
      meta.school_id === schoolId
    );
    
    return metadata ? metadata.sync_in_progress : false;
  } catch (error) {
    logger.error('Failed to check sync in progress status', {
      source: 'offline.metadata',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    return false;
  }
}

export default {
  getOrCreateOfflineMetadata,
  updateOfflineMetadata,
  markSyncStarted,
  markSyncCompleted,
  getLastSyncTime,
  isSyncInProgress
};