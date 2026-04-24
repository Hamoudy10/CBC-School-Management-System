/**
 * IndexedDB wrapper for offline storage
 * Provides a simple promise-based interface for common IDB operations
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * Database configuration
 */
const DB_NAME = 'CBCSchoolOffline';
const DB_VERSION = 1;

/**
 * Object stores we need
 */
const STORES = [
  'students',
  'attendance',
  'assessments',
  'offline_sync_queue',
  'offline_metadata'
];

/**
 * Open database connection
 * @returns {Promise<IDBDatabase>}
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      STORES.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a transaction for a store
 * @param {string} storeName - Name of the object store
 * @param {IDBTransactionMode} mode - Transaction mode (readonly, readwrite)
 * @returns {Promise<IDBObjectStore>}
 */
function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  return openDB().then(db => {
    const transaction = db.transaction(storeName, mode);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(transaction.objectStore(storeName));
      transaction.onerror = () => reject(transaction.error);
    });
  });
}

/**
 * Add a record to a store
 * @param {string} storeName - Name of the object store
 * @param {object} data - Data to store (must have an id field)
 * @returns {Promise<void>}
 */
export async function addToStore(storeName: string, data: any): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.add(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a record from a store by ID
 * @param {string} storeName - Name of the object store
 * @param {string|number} id - Record ID
 * @returns {Promise<any>}
 */
export async function getFromStore(storeName: string, id: string | number): Promise<any> {
  const store = await getStore(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all records from a store
 * @param {string} storeName - Name of the object store
 * @returns {Promise<Array<any>>}
 */
export async function getAllFromStore(storeName: string): Promise<any[]> {
  const store = await getStore(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update a record in a store
 * @param {string} storeName - Name of the object store
 * @param {object} data - Data to update (must have an id field)
 * @returns {Promise<void>}
 */
export async function updateStore(storeName: string, data: any): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a record from a store by ID
 * @param {string} storeName - Name of the object store
 * @param {string|number} id - Record ID
 * @returns {Promise<void>}
 */
export async function deleteFromStore(storeName: string, id: string | number): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all records from a store
 * @param {string} storeName - Name of the object store
 * @returns {Promise<void>}
 */
export async function clearStore(storeName: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generate a UUID for offline records
 * @returns {string}
 */
export function generateOfflineId(): string {
  return uuidv4();
}

const offlineStorage = {
  addToStore,
  getFromStore,
  getAllFromStore,
  updateStore,
  deleteFromStore,
  clearStore,
  generateOfflineId
};

export default offlineStorage;
