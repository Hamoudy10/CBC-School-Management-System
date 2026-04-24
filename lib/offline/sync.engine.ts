/**
 * Sync engine for offline-first capabilities
 * Handles queuing local changes and synchronizing with the server
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import offlineStorage from './storage';
import { createSupabaseServerClient } from '../supabase/server';
import { logger } from '../logger';

/**
 * Configuration
 */
const SYNC_INTERVAL_MS = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 5;
const BATCH_SIZE = 50;

/**
 * Sync status
 */
let syncInProgress = false;
let syncInterval: NodeJS.Timeout | null = null;

/**
 * Initialize the sync engine
 * Should be called when the application starts or user logs in
 */
export async function initializeOfflineSync(): Promise<void> {
  try {
    // Start periodic sync
    startPeriodicSync();
    
    // Perform initial sync
    await syncWithServer();
    
    logger.info('Offline sync engine initialized', {
      source: 'offline.sync.engine'
    });
  } catch (error) {
    logger.error('Failed to initialize offline sync engine', {
      source: 'offline.sync.engine',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

/**
 * Stop the sync engine
 * Should be called when the application shuts down or user logs out
 */
export function stopOfflineSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  syncInProgress = false;
  
  logger.info('Offline sync engine stopped', {
    source: 'offline.sync.engine'
  });
}

/**
 * Start periodic synchronization
 */
function startPeriodicSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  syncInterval = setInterval(async () => {
    if (!syncInProgress) {
      await syncWithServer();
    }
  }, SYNC_INTERVAL_MS);
  
  logger.debug('Periodic offline sync started', {
    source: 'offline.sync.engine',
    intervalMs: SYNC_INTERVAL_MS
  });
}

/**
 * Synchronize local changes with the server
 */
export async function syncWithServer(): Promise<void> {
  // Prevent concurrent syncs
  if (syncInProgress) {
    logger.debug('Sync already in progress, skipping', {
      source: 'offline.sync.engine'
    });
    return;
  }
  
  syncInProgress = true;
  
  try {
    logger.info('Starting offline sync with server', {
      source: 'offline.sync.engine'
    });
    
    const supabase = await createSupabaseServerClient();
    
    // Process the sync queue
    await processSyncQueue(supabase);
    
    // Fetch remote changes (optional, could be implemented separately)
    // await fetchRemoteChanges(supabase);
    
    logger.info('Offline sync completed successfully', {
      source: 'offline.sync.engine'
    });
  } catch (error) {
    logger.error('Offline sync failed', {
      source: 'offline.sync.engine',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  } finally {
    syncInProgress = false;
  }
}

/**
 * Process the offline sync queue
 * @param {SupabaseClient} supabase - Supabase client instance
 */
async function processSyncQueue(supabase: SupabaseClient): Promise<void> {
  try {
    // Get pending operations from local storage
    const pendingOperations = await offlineStorage.getAllFromStore('offline_sync_queue');
    
    if (pendingOperations.length === 0) {
      logger.debug('No pending operations in sync queue', {
        source: 'offline.sync.engine'
      });
      return;
    }
    
    logger.info(`Processing ${pendingOperations.length} pending operations`, {
      source: 'offline.sync.engine'
    });
    
    // Process operations in batches
    for (let i = 0; i < pendingOperations.length; i += BATCH_SIZE) {
      const batch = pendingOperations.slice(i, i + BATCH_SIZE);
      
      for (const operation of batch) {
        try {
          await processSyncOperation(supabase, operation);
          
          // Mark operation as processed
          await markOperationAsProcessed(operation.id);
        } catch (error) {
          // Handle operation failure
          const normalizedError = error instanceof Error ? error : new Error('Unknown sync operation failure');
          await handleOperationFailure(operation, normalizedError);
        }
      }
    }
    
    logger.info('Sync queue processing completed', {
      source: 'offline.sync.engine'
    });
  } catch (error) {
    logger.error('Failed to process sync queue', {
      source: 'offline.sync.engine',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

/**
 * Process a single sync operation
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object} operation - The operation to process
 */
async function processSyncOperation(supabase: SupabaseClient, operation: any): Promise<void> {
  const { table_name: tableName, record_id: recordId, operation_type: operationType, payload } = operation;
  
  logger.debug(`Processing ${operationType} operation on ${tableName} record ${recordId}`, {
    source: 'offline.sync.engine'
  });
  
  switch (operationType) {
    case 'INSERT':
      await handleInsertOperation(supabase, tableName, recordId, payload);
      break;
    case 'UPDATE':
      await handleUpdateOperation(supabase, tableName, recordId, payload);
      break;
    case 'DELETE':
      await handleDeleteOperation(supabase, tableName, recordId);
      break;
    default:
      throw new Error(`Unknown operation type: ${operationType}`);
  }
}

/**
 * Handle an INSERT operation
 */
async function handleInsertOperation(supabase: SupabaseClient, tableName: string, recordId: string, payload: any): Promise<void> {
  const { data, error } = await supabase
    .from(tableName)
    .insert(payload)
    .select()
    .single();
    
  if (error) {
    throw error;
  }
  
  logger.debug(`Inserted record into ${tableName}`, {
    source: 'offline.sync.engine',
    tableName,
    recordId: data.id
  });
}

/**
 * Handle an UPDATE operation
 */
async function handleUpdateOperation(supabase: SupabaseClient, tableName: string, recordId: string, payload: any): Promise<void> {
  const { data, error } = await supabase
    .from(tableName)
    .update(payload)
    .eq('id', recordId)
    .select()
    .single();
    
  if (error) {
    throw error;
  }
  
  logger.debug(`Updated record in ${tableName}`, {
    source: 'offline.sync.engine',
    tableName,
    recordId
  });
}

/**
 * Handle a DELETE operation
 */
async function handleDeleteOperation(supabase: SupabaseClient, tableName: string, recordId: string): Promise<void> {
  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq('id', recordId);
    
  if (error) {
    throw error;
  }
  
  logger.debug(`Deleted record from ${tableName}`, {
    source: 'offline.sync.engine',
    tableName,
    recordId
  });
}

/**
 * Mark an operation as processed in the local storage
 * @param {string} operationId - ID of the operation to mark as processed
 */
async function markOperationAsProcessed(operationId: string): Promise<void> {
  const operation = await offlineStorage.getFromStore('offline_sync_queue', operationId);
  if (operation) {
    operation.processed = true;
    await offlineStorage.updateStore('offline_sync_queue', operation);
  }
}

/**
 * Handle a failed operation
 * @param {Object} operation - The operation that failed
 * @param {Error} error - The error that occurred
 */
async function handleOperationFailure(operation: any, error: Error): Promise<void> {
  const { id: operationId, retry_count: retryCount } = operation;
  const newRetryCount = retryCount + 1;
  
  logger.warn(`Operation ${operationId} failed (attempt ${newRetryCount}/${MAX_RETRY_ATTEMPTS}): ${error.message}`, {
    source: 'offline.sync.engine',
    operationId,
    retryCount: newRetryCount,
    maxRetries: MAX_RETRY_ATTEMPTS
  });
  
  // Update operation with failure info
  const updatedOperation = {
    ...operation,
    retry_count: newRetryCount,
    attempted_at: new Date().toISOString(),
    error_message: error.message
  };
  
  if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
    // Max retries exceeded, mark as failed
    updatedOperation.failed_at = new Date().toISOString();
    logger.error(`Operation ${operationId} failed permanently after ${MAX_RETRY_ATTEMPTS} attempts`, {
      source: 'offline.sync.engine',
      operationId
    });
  } else {
    // Still have retries left, will be retried in next sync cycle
    logger.debug(`Operation ${operationId} will be retried`, {
      source: 'offline.sync.engine',
      operationId,
      nextAttemptIn: `${SYNC_INTERVAL_MS}ms`
    });
  }
  
  await offlineStorage.updateStore('offline_sync_queue', updatedOperation);
}

/**
 * Queue a local operation for synchronization
 * @param {string} tableName - Name of the table
 * @param {string} recordId - ID of the record
 * @param {string} operationType - Type of operation (INSERT, UPDATE, DELETE)
 * @param {any} payload - Data for the operation (required for INSERT/UPDATE)
 * @param {number} priority - Priority level (1-10)
 */
export async function queueSyncOperation(
  tableName: string,
  recordId: string,
  operationType: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: any = null,
  priority: number = 1
): Promise<void> {
  try {
    // Validate inputs
    if (!['INSERT', 'UPDATE', 'DELETE'].includes(operationType)) {
      throw new Error(`Invalid operation type: ${operationType}`);
    }
    
    if (operationType === 'DELETE' && payload !== null) {
      throw new Error('Payload must be null for DELETE operations');
    }
    
    if (operationType !== 'DELETE' && !payload) {
      throw new Error(`Payload is required for ${operationType} operations`);
    }
    
    if (priority < 1 || priority > 10) {
      throw new Error('Priority must be between 1 and 10');
    }
    
    // Create operation object
    const operation = {
      id: offlineStorage.generateOfflineId(),
      table_name: tableName,
      record_id: recordId,
      operation_type: operationType,
      payload,
      priority,
      created_at: new Date().toISOString(),
      processed: false,
      retry_count: 0
    };
    
    // Store in local database
    await offlineStorage.addToStore('offline_sync_queue', operation);
    
    logger.debug(`Queued ${operationType} operation for ${tableName} record ${recordId}`, {
      source: 'offline.sync.engine',
      operationId: operation.id,
      tableName,
      recordId,
      operationType,
      priority
    });
  } catch (error) {
    logger.error('Failed to queue sync operation', {
      source: 'offline.sync.engine',
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
}

/**
 * Get sync status
 * @returns {Object} Current sync status
 */
export function getSyncStatus(): {
  syncInProgress: boolean;
  pendingOperations: number;
  lastSync: string | null;
} {
  return {
    syncInProgress,
    pendingOperations: 0, // Would need to query local storage for actual count
    lastSync: null // Would need to track this in offline_metadata
  };
}

/**
 * Manually trigger a sync
 * @returns {Promise<void>}
 */
export async function manualSync(): Promise<void> {
  if (!syncInProgress) {
    await syncWithServer();
  }
}

// Export default object for easier importing
const offlineSyncEngine = {
  initializeOfflineSync,
  stopOfflineSync,
  syncWithServer,
  queueSyncOperation,
  manualSync,
  getSyncStatus
};

export default offlineSyncEngine;
