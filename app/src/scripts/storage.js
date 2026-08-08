// Persistence layer — hybrid localStorage + IndexedDB for large files
import { state } from './state.js';
import {
  saveFileContent,
  loadFileContent,
  deleteFileContent,
  saveVersions as saveVersionsIDB,
  loadVersions as loadVersionsIDB,
  isIDBAvailable,
  estimateStorage,
  openDatabase
} from './idb-storage.js';

// ========== STORAGE LIMITS & VALIDATION ==========

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB (now supports huge files via IDB)
export const WARN_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILES = 500;
export const WARN_FILES = 400;
export const ARCHIVE_FOLDER = '_archive';
export const IDB_THRESHOLD = 500 * 1024; // 500KB threshold for moving to IDB

/** Validate file size before import */
export function validateFileSize(file) {
  const size = file.size || 0;

  if (size === 0) {
    return { valid: false, size, level: 'empty', message: 'File is empty' };
  }

  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      size,
      level: 'too-large',
      message: 'File too large (' + formatSize(size) + '). Maximum is ' + formatSize(MAX_FILE_SIZE) + '.'
    };
  }

  if (size > WARN_FILE_SIZE) {
    return {
      valid: true,
      size,
      level: 'large',
      message: 'Large file detected (' + formatSize(size) + '). Performance may be affected.'
    };
  }

  return { valid: true, size, level: 'ok', message: '' };
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/** Get count of non-archived files */
export function getFileCount() {
  const files = getLibrary();
  return files.filter(f => f.folder !== ARCHIVE_FOLDER).length;
}

/** Check if a new file can be added */
export function canAddFile() {
  const count = getFileCount();

  if (count >= MAX_FILES) {
    return {
      allowed: false,
      count,
      reason: 'Library is full (' + count + '/' + MAX_FILES + ' files). Delete or archive files to add more.'
    };
  }

  if (count >= WARN_FILES) {
    return {
      allowed: true,
      count,
      reason: 'Library is getting full (' + count + '/' + MAX_FILES + ' files). Consider archiving old files.'
    };
  }

  return { allowed: true, count, reason: '' };
}

/** Archive a file (move to archive folder) */
export function archiveFile(fileId) {
  const files = getLibrary();
  const file = files.find(f => f.id === fileId);
  if (!file) return false;

  file.folder = ARCHIVE_FOLDER;
  file.archivedAt = Date.now();
  return saveLibrary(files);
}

/** Unarchive a file (move to root) */
export function unarchiveFile(fileId) {
  const capacity = canAddFile();
  if (!capacity.allowed) {
    return { success: false, reason: capacity.reason };
  }

  const files = getLibrary();
  const file = files.find(f => f.id === fileId);
  if (!file) return { success: false, reason: 'File not found' };

  file.folder = '';
  delete file.archivedAt;
  const success = saveLibrary(files);
  return { success, reason: success ? '' : 'Save failed' };
}

/** Get archived files */
export function getArchivedFiles() {
  return getLibrary().filter(f => f.folder === ARCHIVE_FOLDER);
}

/** Validate filename for safety */
export function sanitizeFilename(name) {
  if (!name) return 'untitled.md';

  let safe = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\.\./g, '')
    .trim();

  if (safe.length > 100) {
    const ext = safe.includes('.') ? '.' + safe.split('.').pop() : '.md';
    safe = safe.slice(0, 100 - ext.length) + ext;
  }

  if (!safe.match(/\.(md|markdown|mdown|txt)$/i)) {
    safe += '.md';
  }

  return safe || 'untitled.md';
}

// ========== STORAGE KEYS ==========

const LIB_KEY = 'inkdown:library';
const FOLDERS_KEY = 'inkdown:folders';
const VER_KEY = 'inkdown:versions';

export const STORAGE_KEYS = {
  LIBRARY: LIB_KEY,
  FOLDERS: FOLDERS_KEY,
  VERSIONS: VER_KEY,
  TODOS: 'inkdown:todos',
  SETTINGS: 'inkdown:settings',
  DOC: 'inkdown:doc',
  THEME: 'inkdown:theme',
  READ: 'inkdown:read',
  TODO_POS: 'inkdown:todoPos'
};

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ========== LIBRARY (Metadata in localStorage, Content in IDB for large files) ==========

/**
 * Get library (metadata only — no content for large files).
 * For large files, content must be loaded separately via getFileContent().
 */
export function getLibrary() {
  try {
    const data = JSON.parse(localStorage.getItem(LIB_KEY)) || [];
    return data.map(f => ({
      ...f,
      _hasExternalContent: f._useIDB === true
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Save library metadata.
 * Strips large content from metadata — large file content lives in IDB.
 */
export function saveLibrary(files) {
  try {
    const metadata = files.map(f => {
      const meta = { ...f };

      // If content is large, mark for IDB storage
      if (meta.md && meta.md.length > IDB_THRESHOLD) {
        meta._useIDB = true;
        meta._contentSize = meta.md.length;
        delete meta.md; // Don't store in localStorage
      } else {
        // Small file — keep content in localStorage
        delete meta._useIDB;
        delete meta._hasExternalContent;
        delete meta._contentSize;
      }

      return meta;
    });

    const data = JSON.stringify(metadata);

    // Check quota before saving
    if (typeof window !== 'undefined' && window.StorageMonitor) {
      const status = window.StorageMonitor.getQuotaStatus();
      if (!status.canSave) {
        document.dispatchEvent(new CustomEvent('storage:blocked', { detail: status }));
        return false;
      }
    }

    localStorage.setItem(LIB_KEY, data);

    if (typeof window !== 'undefined' && window.StorageMonitor) {
      window.StorageMonitor.checkAndNotify();
    }

    return true;
  } catch (e) {
    console.error('[Storage] Save failed:', e);

    // Fallback: save without content
    try {
      const minimal = files.map(f => ({
        id: f.id,
        name: f.name,
        folder: f.folder,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        scroll: f.scroll || 0,
        highlights: f.highlights || [],
        goal: f.goal || 0,
        _useIDB: true
      }));
      localStorage.setItem(LIB_KEY, JSON.stringify(minimal));
      document.dispatchEvent(new CustomEvent('storage:error', { detail: { error: 'Saved without content — using IndexedDB' } }));
      return true;
    } catch (e2) {
      console.error('[Storage] Even minimal save failed:', e2);
      document.dispatchEvent(new CustomEvent('storage:error', { detail: { error: e.message } }));
      return false;
    }
  }
}

// ========== FILE CONTENT LOADING ==========

/**
 * Get file metadata synchronously (no content for large files).
 * Backward-compatible — existing code using this still works.
 */
export function getFile(id) {
  return getLibrary().find(f => f.id === id) || null;
}

/**
 * Get file content (loads from IDB if needed). ASYNC.
 */
export async function getFileContent(fileId) {
  const file = getFile(fileId);
  if (!file) return null;

  if (file._useIDB || file._hasExternalContent) {
    try {
      const content = await loadFileContent(fileId);
      return content || '';
    } catch (e) {
      console.error('[Storage] IDB content load failed:', e);
      return '';
    }
  }

  return file.md || '';
}

/**
 * Get file with full content loaded (metadata + content). ASYNC.
 */
export async function getFileWithContent(id) {
  const file = getFile(id);
  if (!file) return null;

  if (file._useIDB || file._hasExternalContent) {
    try {
      const content = await loadFileContent(id);
      return { ...file, md: content || '' };
    } catch (e) {
      console.error('[Storage] getFileWithContent failed:', e);
      return { ...file, md: '' };
    }
  }

  return { ...file };
}

// ========== UPSERT / CREATE / DELETE ==========

/**
 * Insert or merge-update a file record.
 * For large files, content is saved to IDB asynchronously.
 */
export function upsertFile(record) {
  if (!record || !record.id) return false;

  const files = getLibrary();
  const i = files.findIndex(f => f.id === record.id);

  // If content is large, save it to IDB (async, non-blocking)
  if (record.md && record.md.length > IDB_THRESHOLD) {
    saveFileContent(record.id, record.md).catch(e => {
      console.error('[Storage] IDB content save failed:', e);
    });

    const meta = { ...record };
    meta._useIDB = true;
    meta._contentSize = record.md.length;
    delete meta.md;

    if (i > -1) {
      files[i] = { ...files[i], ...meta };
    } else {
      files.unshift({ createdAt: Date.now(), highlights: [], goal: 0, scroll: 0, ...meta });
    }
  } else {
    // Small file: everything in localStorage
    const meta = { ...record };
    delete meta._useIDB;
    delete meta._hasExternalContent;
    delete meta._contentSize;

    if (i > -1) {
      files[i] = { ...files[i], ...meta };
    } else {
      files.unshift({ createdAt: Date.now(), highlights: [], goal: 0, scroll: 0, ...meta });
    }
  }

  return saveLibrary(files);
}

export function createFile(name, md, extra = {}) {
  const rec = {
    id: uid(),
    name,
    md,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    scroll: 0,
    highlights: [],
    goal: 0,
    ...extra
  };
  upsertFile(rec);
  return rec;
}

export function deleteFile(id) {
  deleteFileContent(id).catch(() => {}); // Clean up IDB
  return saveLibrary(getLibrary().filter(f => f.id !== id));
}

// ========== FOLDERS ==========

export function getFolders() {
  try { return JSON.parse(localStorage.getItem(FOLDERS_KEY)) || []; }
  catch (e) { return []; }
}

export function saveFolders(folders) {
  try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); return true; }
  catch (e) { return false; }
}

export function createFolder(name) {
  const t = (name || '').trim();
  if (!t) return null;
  const folders = getFolders();
  if (!folders.includes(t)) { folders.push(t); saveFolders(folders); }
  return t;
}

export function renameFolder(oldName, newName) {
  const t = (newName || '').trim();
  if (!t) return;
  const folders = getFolders();
  const i = folders.indexOf(oldName);
  if (i === -1 || folders.includes(t)) return;
  folders[i] = t;
  saveFolders(folders);
  const files = getLibrary();
  files.forEach(f => { if ((f.folder || '') === oldName) f.folder = t; });
  saveLibrary(files);
}

export function deleteFolder(name) {
  saveFolders(getFolders().filter(f => f !== name));
  const files = getLibrary();
  files.forEach(f => { if ((f.folder || '') === name) f.folder = ''; });
  saveLibrary(files);
}

export function setFileFolder(fileId, folderName) {
  const files = getLibrary();
  const f = files.find(x => x.id === fileId);
  if (!f) return;
  f.folder = folderName || '';
  saveLibrary(files);
}

// ========== UNIQUE NAME ==========

export function uniqueName(base, files) {
  const names = new Set(files.map(f => f.name));
  if (!names.has(base)) return base;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '.md';
  let i = 2;
  while (names.has(`${stem} (${i})${ext}`)) i++;
  return `${stem} (${i})${ext}`;
}

// ========== LEGACY MIGRATION ==========

export function migrateLegacy() {
  try {
    const legacy = localStorage.getItem(STORAGE_KEYS.DOC);
    if (!legacy) return;
    if (getLibrary().length === 0) {
      const rec = JSON.parse(legacy);
      if (rec && rec.md) {
        createFile(rec.name || 'untitled.md', rec.md, {
          createdAt: rec.at || Date.now(),
          scroll: rec.scroll || 0,
          highlights: rec.highlights || [],
          goal: rec.goal || 0
        });
      }
    }
    localStorage.removeItem(STORAGE_KEYS.DOC);
  } catch (e) {}
}

/**
 * Migrate existing large files from localStorage to IndexedDB.
 * Call once on app startup.
 */
export async function migrateToIDB() {
  if (!isIDBAvailable()) return 0;

  try {
    await openDatabase();

    const files = getLibrary();
    let migrated = 0;
    let needsResave = false;

    for (const file of files) {
      // If file has content in localStorage and it's large, move to IDB
      if (file.md && file.md.length > IDB_THRESHOLD && !file._useIDB) {
        try {
          await saveFileContent(file.id, file.md);
          file._useIDB = true;
          file._contentSize = file.md.length;
          delete file.md;
          migrated++;
          needsResave = true;
        } catch (e) {
          console.warn('[Storage] Failed to migrate file:', file.id, e);
        }
      }
    }

    if (needsResave) {
      saveLibrary(files);
      console.log(`[Storage] Migrated ${migrated} files to IndexedDB`);
    }

    return migrated;
  } catch (e) {
    console.warn('[Storage] Migration failed:', e);
    return 0;
  }
}

// ========== VERSIONS ==========

export function pushVersion() {
  try {
    const key = state.fileId || state.name;
    const V = JSON.parse(localStorage.getItem(VER_KEY) || '{}');
    let arr = V[key] || [];
    if (!arr.length || arr[0].md !== state.md) {
      arr.unshift({ at: Date.now(), md: state.md });
      arr = arr.slice(0, 12);
    }
    V[key] = arr;

    // Try localStorage first
    try {
      localStorage.setItem(VER_KEY, JSON.stringify(V));
    } catch (e) {
      // If localStorage full, save versions to IDB (strip large content)
      console.warn('[Storage] Versions too large for localStorage, saving to IDB');
      const minimalArr = arr.map(v => ({ at: v.at, size: v.md.length }));
      V[key] = minimalArr;
      localStorage.setItem(VER_KEY, JSON.stringify(V));

      // Save full versions to IDB
      saveVersionsIDB(key, arr).catch(e2 => {
        console.error('[Storage] IDB version save failed:', e2);
      });
    }
  } catch (e) {}
}

export function getVersions() {
  try {
    const key = state.fileId || state.name;
    const V = JSON.parse(localStorage.getItem(VER_KEY) || '{}');
    return V[key] || [];
  } catch (e) {
    return [];
  }
}

/**
 * Get full version content (async, loads from IDB if needed).
 */
export async function getVersionContent(key, index = 0) {
  const versions = getVersions();
  const v = versions[index];
  if (!v) return null;

  if (v.md) return v.md;

  // Try IDB
  try {
    const allVersions = await loadVersionsIDB(key);
    return allVersions[index]?.md || null;
  } catch (e) {
    return null;
  }
}

// ========== STORAGE STATS ==========

export async function getStorageUsage() {
  const lsUsage = calculateLocalStorageUsage();
  let idbEstimate = { quota: 0, usage: 0, percent: 0 };

  try {
    idbEstimate = await estimateStorage();
  } catch (e) {}

  return {
    localStorage: lsUsage,
    indexedDB: idbEstimate,
    total: lsUsage.bytes + (idbEstimate.usage || 0)
  };
}

function calculateLocalStorageUsage() {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      if (value) bytes += (key.length + value.length) * 2;
    }
  } catch (e) {}
  return { bytes, formatted: formatSize(bytes) };
}