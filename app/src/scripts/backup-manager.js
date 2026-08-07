// Backup Manager - Auto-backup before destructive operations
// Keeps last 3 backups, allows restore
import { $ } from './state.js';
import { getLibrary, saveLibrary } from './storage.js';

const BACKUP_KEY = 'inkdown:backups';
const MAX_BACKUPS = 3;

// Keys to include in backups
const BACKUP_KEYS = [
  'inkdown:library',
  'inkdown:todos',
  'inkdown:settings',
  'inkdown:versions',
  'inkdown:folders',
  'inkdown:theme',
  'inkdown:read'
];

/** Create a backup of all data */
export async function createBackup(reason = 'manual') {
  try {
    const backupData = {
      timestamp: Date.now(),
      reason,
      version: '1.0',
      data: {}
    };

    // Collect all relevant localStorage keys
    for (const key of BACKUP_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        backupData.data[key] = value;
      }
    }

    // Calculate size
    const size = JSON.stringify(backupData).length * 2;

    // Check if we can store the backup
    const backups = getBackups();

    // Remove oldest if at capacity
    while (backups.length >= MAX_BACKUPS) {
      backups.shift();
    }

    backups.push({
      id: generateBackupId(),
      timestamp: backupData.timestamp,
      reason,
      size,
      fileCount: (JSON.parse(backupData.data['inkdown:library'] || '[]')).length,
      data: backupData.data
    });

    saveBackups(backups);

    document.dispatchEvent(new CustomEvent('backup:created', {
      detail: { id: backups[backups.length - 1].id, reason }
    }));

    return { success: true, id: backups[backups.length - 1].id };
  } catch (e) {
    console.error('[Backup] Creation failed:', e);
    return { success: false, error: e.message };
  }
}

/** Get all backups */
export function getBackups() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

/** Save backups list */
function saveBackups(backups) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
  } catch (e) {
    console.error('[Backup] Save failed:', e);
  }
}

/** Restore from a backup */
export async function restoreBackup(backupId) {
  try {
    const backups = getBackups();
    const backup = backups.find(b => b.id === backupId);

    if (!backup) {
      return { success: false, error: 'Backup not found' };
    }

    // Create a backup of current state first
    await createBackup('before-restore');

    // Restore all keys
    for (const [key, value] of Object.entries(backup.data)) {
      localStorage.setItem(key, value);
    }

    document.dispatchEvent(new CustomEvent('backup:restored', { detail: { id: backupId } }));

    return { success: true };
  } catch (e) {
    console.error('[Backup] Restore failed:', e);
    return { success: false, error: e.message };
  }
}

/** Delete a specific backup */
export function deleteBackup(backupId) {
  try {
    const backups = getBackups().filter(b => b.id !== backupId);
    saveBackups(backups);
    return true;
  } catch (e) {
    return false;
  }
}

/** Export backup as downloadable ZIP */
export async function exportBackupAsZip() {
  if (typeof JSZip === 'undefined') {
    return { success: false, error: 'JSZip not loaded' };
  }

  try {
    const zip = new JSZip();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // Add all localStorage data
    for (const key of BACKUP_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        const filename = key.replace('inkdown:', '') + '.json';
        zip.file(filename, value);
      }
    }

    // Add backup info
    zip.file('backup-info.json', JSON.stringify({
      created: new Date().toISOString(),
      app: 'Inkdown',
      version: '1.0',
      fileCount: getLibrary().length
    }, null, 2));

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inkdown-backup-' + timestamp + '.zip';
    a.click();
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (e) {
    console.error('[Backup] Export failed:', e);
    return { success: false, error: e.message };
  }
}

/** Import backup from ZIP file */
export async function importBackupFromZip(file) {
  if (typeof JSZip === 'undefined') {
    return { success: false, error: 'JSZip not loaded' };
  }

  try {
    // Create backup of current state first
    await createBackup('before-import');

    const zip = await JSZip.loadAsync(file);
    let importedCount = 0;

    for (const key of BACKUP_KEYS) {
      const filename = key.replace('inkdown:', '') + '.json';
      const zipFile = zip.file(filename);

      if (zipFile) {
        const content = await zipFile.async('string');
        localStorage.setItem(key, content);
        importedCount++;
      }
    }

    if (importedCount === 0) {
      return { success: false, error: 'No valid backup data found in ZIP' };
    }

    document.dispatchEvent(new CustomEvent('backup:imported', { detail: { count: importedCount } }));

    return { success: true, count: importedCount };
  } catch (e) {
    console.error('[Backup] Import failed:', e);
    return { success: false, error: e.message };
  }
}

/** Check if daily auto-backup is needed */
export function checkDailyBackup() {
  try {
    const lastBackupTime = localStorage.getItem('inkdown:last-backup');
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    if (!lastBackupTime || (now - parseInt(lastBackupTime)) > ONE_DAY) {
      createBackup('daily-auto').then(result => {
        if (result.success) {
          localStorage.setItem('inkdown:last-backup', now.toString());
        }
      });
    }
  } catch (e) {
    console.warn('[Backup] Daily check failed:', e);
  }
}

function generateBackupId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Format timestamp for display */
export function formatBackupTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' minutes ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' hours ago';
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Initialize backup manager */
export function initBackupManager() {
  // Check for daily backup
  checkDailyBackup();

  // Listen for backup requests
  document.addEventListener('backup:create', async () => {
    const result = await createBackup('manual');
    if (result.success) {
      document.dispatchEvent(new CustomEvent('toast', {
        detail: { message: 'Backup created successfully', type: 'success' }
      }));
    }
  });

  console.log('[Inkdown] Backup manager initialized');
}