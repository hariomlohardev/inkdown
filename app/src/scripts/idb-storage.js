/**
 * IndexedDB Storage Layer
 * Handles large file content (100MB+) that localStorage can't.
 * Provides async read/write with caching for performance.
 */

const DB_NAME = 'inkdown-db';
const DB_VERSION = 2;
const STORE_FILES = 'file-content';
const STORE_VERSIONS = 'file-versions';

let db = null;
let dbReady = false;
let dbError = null;

// In-memory cache for file content (avoids repeated IDB reads)
const contentCache = new Map();

/**
 * Open/initialize the IndexedDB database.
 */
export function openDatabase() {
  return new Promise((resolve, reject) => {
    if (db && dbReady) {
      resolve(db);
      return;
    }

    if (!window.indexedDB) {
      dbError = 'IndexedDB not supported';
      reject(dbError);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      dbError = event.target.error?.message || 'Failed to open database';
      console.error('[IDB] Open failed:', dbError);
      reject(dbError);
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      dbReady = true;

      db.onversionchange = () => {
        db.close();
        db = null;
        dbReady = false;
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // File content store
      if (!database.objectStoreNames.contains(STORE_FILES)) {
        database.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }

      // Version history store
      if (!database.objectStoreNames.contains(STORE_VERSIONS)) {
        database.createObjectStore(STORE_VERSIONS, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Save file content to IndexedDB.
 */
export async function saveFileContent(fileId, content) {
  try {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_FILES, 'readwrite');
      const store = tx.objectStore(STORE_FILES);

      store.put({
        id: fileId,
        content: content,
        size: content.length,
        updatedAt: Date.now()
      });

      tx.oncomplete = () => {
        // Update cache
        contentCache.set(fileId, content);
        resolve(true);
      };
      tx.onerror = (e) => {
        console.error('[IDB] Save failed:', e.target.error);
        reject(e.target.error);
      };
    });
  } catch (e) {
    console.error('[IDB] saveFileContent error:', e);
    return false;
  }
}

/**
 * Load file content from IndexedDB.
 */
export async function loadFileContent(fileId) {
  // Check cache first
  if (contentCache.has(fileId)) {
    return contentCache.get(fileId);
  }

  try {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const request = store.get(fileId);

      request.onsuccess = () => {
        if (request.result && request.result.content !== undefined) {
          contentCache.set(fileId, request.result.content);
          resolve(request.result.content);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('[IDB] loadFileContent error:', e);
    return null;
  }
}

/**
 * Delete file content from IndexedDB.
 */
export async function deleteFileContent(fileId) {
  contentCache.delete(fileId);
  try {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_FILES, 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      store.delete(fileId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

/**
 * Save version history for a file.
 */
export async function saveVersions(fileKey, versions) {
  try {
    const database = await openDatabase();
    return new Promise((resolve) => {
      const tx = database.transaction(STORE_VERSIONS, 'readwrite');
      const store = tx.objectStore(STORE_VERSIONS);
      store.put({ key: fileKey, versions: versions });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

/**
 * Load version history for a file.
 */
export async function loadVersions(fileKey) {
  try {
    const database = await openDatabase();
    return new Promise((resolve) => {
      const tx = database.transaction(STORE_VERSIONS, 'readonly');
      const store = tx.objectStore(STORE_VERSIONS);
      const request = store.get(fileKey);
      request.onsuccess = () => resolve(request.result?.versions || []);
      request.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

/**
 * Get storage usage statistics.
 */
export async function getStorageStats() {
  try {
    const database = await openDatabase();
    return new Promise((resolve) => {
      const tx = database.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const request = store.count();

      request.onsuccess = () => {
        resolve({
          fileCount: request.result,
          cacheSize: contentCache.size
        });
      };
      request.onerror = () => resolve({ fileCount: 0, cacheSize: 0 });
    });
  } catch (e) {
    return { fileCount: 0, cacheSize: 0 };
  }
}

/**
 * Clear all content cache (free memory).
 */
export function clearContentCache() {
  contentCache.clear();
}

/**
 * Check if IndexedDB is available and working.
 */
export function isIDBAvailable() {
  return !!window.indexedDB;
}

/**
 * Estimate storage quota and usage.
 */
export async function estimateStorage() {
  if (!navigator.storage || !navigator.storage.estimate) {
    return { quota: 0, usage: 0, percent: 0 };
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      quota: estimate.quota || 0,
      usage: estimate.usage || 0,
      percent: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0
    };
  } catch (e) {
    return { quota: 0, usage: 0, percent: 0 };
  }
}

// Initialize database on module load
openDatabase().catch(e => {
  console.warn('[IDB] Initial open failed, will retry on first use:', e);
});