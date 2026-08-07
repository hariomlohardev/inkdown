import { $, $$ } from './state.js';
import { getLibrary, saveLibrary, STORAGE_KEYS } from './storage.js';
import { setThemeMode, getMode } from './theme.js';
import { toast } from './ui.js';

// Add these imports at the top
import { calculateStorageUsage, getQuotaStatus, formatBytes } from './storage-monitor.js';
import { createBackup, getBackups, restoreBackup, deleteBackup, exportBackupAsZip, importBackupFromZip, formatBackupTime } from './backup-manager.js';
import { getFileCount, getArchivedFiles, MAX_FILES } from './storage.js';


const DEFAULT_SETTINGS = {
  theme: 'system',
  defaultFont: 'serif',
  autosave: true,
  autosaveInterval: 2
};

let currentSettings = { ...DEFAULT_SETTINGS };

/* ---------- Storage helpers ---------- */
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('[Inkdown] Failed to load settings:', e);
    currentSettings = { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(currentSettings));
  } catch (e) {
    console.error('[Inkdown] Failed to save settings:', e);
  }
}

export function getSettings() {
  return { ...currentSettings };
}

export function updateSetting(key, value) {
  currentSettings[key] = value;
  saveSettings();
  applySetting(key, value);
}

function applySetting(key, value) {
  if (key === 'theme') setThemeMode(value);
}

/* ---------- Export / Import ---------- */
async function exportAllData() {
  if (!window.JSZip) { toast('JSZip not loaded', 'warn'); return; }
  try {
    const zip = new JSZip();
    zip.file('library.json', JSON.stringify(getLibrary(), null, 2));
    const todos = localStorage.getItem(STORAGE_KEYS.TODOS);
    if (todos) zip.file('todos.json', todos);
    zip.file('settings.json', JSON.stringify(currentSettings, null, 2));
    const versions = localStorage.getItem(STORAGE_KEYS.VERSIONS);
    if (versions) zip.file('versions.json', versions);
    const folders = localStorage.getItem(STORAGE_KEYS.FOLDERS);
    if (folders) zip.file('folders.json', folders);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inkdown-backup-${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Library exported successfully');
  } catch (e) {
    console.error('[Inkdown] Export failed:', e);
    toast('Export failed', 'warn');
  }
}

async function importAllData(file) {
  if (!window.JSZip) { toast('JSZip not loaded', 'warn'); return; }
  try {
    const zip = await JSZip.loadAsync(file);
    if (!confirm('This will replace all current data. Continue?')) return;

    const libFile = zip.file('library.json');
    if (libFile) {
      const lib = JSON.parse(await libFile.async('string'));
      if (Array.isArray(lib)) saveLibrary(lib);
    }
    const todosFile = zip.file('todos.json');
    if (todosFile) localStorage.setItem(STORAGE_KEYS.TODOS, await todosFile.async('string'));
    const setFile = zip.file('settings.json');
    if (setFile) {
      currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(await setFile.async('string')) };
      saveSettings();
    }
    const verFile = zip.file('versions.json');
    if (verFile) localStorage.setItem(STORAGE_KEYS.VERSIONS, await verFile.async('string'));
    const fldFile = zip.file('folders.json');
    if (fldFile) localStorage.setItem(STORAGE_KEYS.FOLDERS, await fldFile.async('string'));

    toast('Library imported. Reloading…');
    setTimeout(() => location.reload(), 1000);
  } catch (e) {
    console.error('[Inkdown] Import failed:', e);
    toast('Import failed: invalid file', 'warn');
  }
}

/* ---------- Danger actions ---------- */
function clearAllData() {
  if (!confirm('This will delete ALL files, todos, and settings. This cannot be undone. Continue?')) return;
  Object.values(STORAGE_KEYS).forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
  toast('All data cleared. Reloading…');
  setTimeout(() => location.reload(), 1000);
}

function resetSettings() {
  if (!confirm('Reset all settings to default? Your files will not be affected.')) return;
  currentSettings = { ...DEFAULT_SETTINGS };
  saveSettings();
  setThemeMode(DEFAULT_SETTINGS.theme);
  syncUI();
  toast('Settings reset to default');
}

/* ---------- UI sync ---------- */
function syncUI() {
  // theme buttons
  const mode = currentSettings.theme;
  $$('.setThemeOpt').forEach(b => b.classList.toggle('on', b.dataset.themeValue === mode));
  const font = $('#settingsDefaultFont'); if (font) font.value = currentSettings.defaultFont;
  const as = $('#settingsAutosave'); if (as) as.checked = currentSettings.autosave;
  const iv = $('#settingsAutosaveInterval'); if (iv) iv.value = currentSettings.autosaveInterval;

  // storage bar
  const label = $('#settingsStorageUsed');
  const fill = $('#settingsStorageFill');
  if (label) {
    const bytes = calculateStorageUsage();
    const max = 5 * 1024 * 1024; // visual 5MB "budget"
    const pct = Math.min(100, (bytes / max) * 100);
    label.textContent = formatBytes(bytes) + ' used';
    if (fill) fill.style.width = pct + '%';
  }
}

/* ---------- Page control ---------- */
export function showSettingsPage() {
  loadSettings();
  document.body.dataset.view = 'settings';
  document.title = 'Inkdown — Settings';
  syncUI();
}

/* ---------- Init ---------- */
export function initSettings() {
  loadSettings();

  // sidebar nav
  const navAll = $('#settingsNavAll'); if (navAll) navAll.onclick = () => {
    document.body.dataset.view = 'library';
    document.title = 'Inkdown — Library';
    document.dispatchEvent(new CustomEvent('library:shown'));
  };
  const navTodos = $('#settingsNavTodos'); if (navTodos) navTodos.onclick = () => {
    document.dispatchEvent(new CustomEvent('todos:open'));
  };

  // theme buttons
  $$('.setThemeOpt').forEach(b => {
    b.addEventListener('click', () => {
      updateSetting('theme', b.dataset.themeValue);
      syncUI();
      toast('Theme updated');
    });
  });

  // font
  const font = $('#settingsDefaultFont');
  if (font) font.addEventListener('change', e => {
    updateSetting('defaultFont', e.target.value);
    toast('Default font updated');
  });

  // autosave
  const as = $('#settingsAutosave');
  if (as) as.addEventListener('change', e => {
    updateSetting('autosave', e.target.checked);
    toast('Auto-save ' + (e.target.checked ? 'enabled' : 'disabled'));
  });

  // interval
  const iv = $('#settingsAutosaveInterval');
  if (iv) iv.addEventListener('change', e => {
    updateSetting('autosaveInterval', parseInt(e.target.value));
    toast('Auto-save interval updated');
  });

  // export/import/clear/reset
  const ex = $('#settingsExportAll'); if (ex) ex.onclick = exportAllData;
  const im = $('#settingsImportAll'), imf = $('#settingsImportFile');
  if (im && imf) {
    im.onclick = () => imf.click();
    imf.addEventListener('change', e => {
      if (e.target.files[0]) { importAllData(e.target.files[0]); e.target.value = ''; }
    });
  }
  const cl = $('#settingsClearAll'); if (cl) cl.onclick = clearAllData;
  const rs = $('#settingsReset'); if (rs) rs.onclick = resetSettings;

  // global entry points (sidebar settings buttons)
  document.addEventListener('settings:open', showSettingsPage);

  console.log('[Inkdown] Settings page initialized');
}














// Add this function to update the storage/backup UI
export function updateStorageUI() {
  // Storage usage
  const status = getQuotaStatus();
  const storageUsed = $('#settingsStorageUsed');
  const storageFill = $('#settingsStorageFill');

  if (storageUsed) {
    storageUsed.textContent = formatBytes(status.used) + ' of ' + formatBytes(status.limit) + ' (' + status.percent + '%)';
  }

  if (storageFill) {
    storageFill.style.width = Math.min(status.percent, 100) + '%';
    storageFill.className = 'storageFill level-' + status.level;
  }

  // File counts
  const fileCount = $('#settingsFileCount');
  const archivedCount = $('#settingsArchivedCount');

  if (fileCount) {
    fileCount.textContent = getFileCount() + ' / ' + MAX_FILES + ' files';
  }

  if (archivedCount) {
    archivedCount.textContent = getArchivedFiles().length + ' files';
  }

  // Backup list
  renderBackupList();
}

function renderBackupList() {
  const list = $('#backupList');
  if (!list) return;

  const backups = getBackups();

  if (backups.length === 0) {
    list.innerHTML = '<div class="backupEmpty">No backups yet. Create one to protect your data.</div>';
    return;
  }

  list.innerHTML = backups.map(b => `
    <div class="backupItem" data-id="${b.id}">
      <div class="backupInfo">
        <b>${b.reason === 'daily-auto' ? '🕐 Daily backup' : b.reason === 'manual' ? '💾 Manual backup' : '📦 ' + b.reason}</b>
        <span>${formatBackupTime(b.timestamp)} · ${b.fileCount} files · ${(b.size / 1024).toFixed(1)} KB</span>
      </div>
      <div class="backupActions">
        <button class="backupBtn restore" data-action="restore">Restore</button>
        <button class="backupBtn danger" data-action="delete">Delete</button>
      </div>
    </div>
  `).join('');

  // Wire up buttons
  list.querySelectorAll('.backupItem').forEach(item => {
    const id = item.dataset.id;

    item.querySelector('[data-action="restore"]').onclick = async () => {
      if (confirm('Restore this backup? Current data will be backed up first.')) {
        const result = await restoreBackup(id);
        if (result.success) {
          alert('Backup restored successfully. Reloading...');
          location.reload();
        } else {
          alert('Restore failed: ' + result.error);
        }
      }
    };

    item.querySelector('[data-action="delete"]').onclick = () => {
      if (confirm('Delete this backup?')) {
        deleteBackup(id);
        renderBackupList();
      }
    };
  });
}

// Add these event handlers in initSettings()
export function initBackupHandlers() {
  // Create backup
  const createBtn = $('#settingsCreateBackup');
  if (createBtn) {
    createBtn.onclick = async () => {
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';

      const result = await createBackup('manual');

      createBtn.disabled = false;
      createBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Create Backup Now</span>';

      if (result.success) {
        renderBackupList();
        document.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Backup created', type: 'success' } }));
      } else {
        alert('Backup failed: ' + result.error);
      }
    };
  }

  // Export backup
  const exportBtn = $('#settingsExportBackup');
  if (exportBtn) {
    exportBtn.onclick = async () => {
      exportBtn.disabled = true;
      const result = await exportBackupAsZip();
      exportBtn.disabled = false;

      if (!result.success) {
        alert('Export failed: ' + result.error);
      }
    };
  }

  // Import backup
  const importBtn = $('#settingsImportBackup');
  const importFile = $('#settingsBackupFile');
  if (importBtn && importFile) {
    importBtn.onclick = () => importFile.click();
    importFile.onchange = async (e) => {
      if (e.target.files[0]) {
        if (confirm('Import this backup? Current data will be backed up first.')) {
          const result = await importBackupFromZip(e.target.files[0]);
          if (result.success) {
            alert('Backup imported. Reloading...');
            location.reload();
          } else {
            alert('Import failed: ' + result.error);
          }
        }
        e.target.value = '';
      }
    };
  }
}







// Hotkey management
export async function initHotkeySettings() {
  const openInput = $('#settingsHotkeyOpen');
  const captureInput = $('#settingsHotkeyCapture');
  const saveBtn = $('#settingsSaveHotkeys');
  const resetBtn = $('#settingsResetHotkeys');
  const statusText = $('#settingsDaemonStatus');
  const statusDot = $('#daemonStatusDot');

  if (!openInput || !captureInput) return;

  // Load current hotkeys from daemon
  await loadHotkeyConfig();

  // Update daemon status periodically
  updateDaemonStatus();
  setInterval(updateDaemonStatus, 30000);

  // Save hotkeys
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const openHotkey = openInput.value.trim().toLowerCase();
      const captureHotkey = captureInput.value.trim().toLowerCase();

      // Validate
      if (!validateHotkey(openHotkey)) {
        toast('Invalid "Open" hotkey format', 'error');
        return;
      }
      if (!validateHotkey(captureHotkey)) {
        toast('Invalid "Capture" hotkey format', 'error');
        return;
      }
      if (openHotkey === captureHotkey) {
        toast('Hotkeys must be different', 'error');
        return;
      }

      // Save via pywebview API
      const api = window.pywebview && window.pywebview.api;
      if (api && api.save_hotkey_config) {
        const result = await api.save_hotkey_config({
          open_app: openHotkey,
          quick_capture: captureHotkey,
          custom: true,
          last_updated: new Date().toISOString()
        });

        if (result) {
          toast('Hotkeys saved. Restart daemon to apply.', 'success');
        } else {
          toast('Failed to save hotkeys', 'error');
        }
      } else {
        toast('Hotkey API not available (desktop only)', 'warn');
      }
    };
  }

  // Reset to defaults
  if (resetBtn) {
    resetBtn.onclick = async () => {
      openInput.value = 'ctrl+alt+space';
      captureInput.value = 'ctrl+alt+c';

      const api = window.pywebview && window.pywebview.api;
      if (api && api.save_hotkey_config) {
        await api.save_hotkey_config({
          open_app: 'ctrl+alt+space',
          quick_capture: 'ctrl+alt+c',
          custom: false,
          last_updated: new Date().toISOString()
        });
        toast('Hotkeys reset to defaults', 'success');
      }
    };
  }
}

async function loadHotkeyConfig() {
  const api = window.pywebview && window.pywebview.api;
  if (api && api.get_hotkey_config) {
    const config = await api.get_hotkey_config();
    if (config) {
      const openInput = $('#settingsHotkeyOpen');
      const captureInput = $('#settingsHotkeyCapture');
      if (openInput) openInput.value = config.open_app || 'ctrl+alt+space';
      if (captureInput) captureInput.value = config.quick_capture || 'ctrl+alt+c';
    }
  }
}

async function updateDaemonStatus() {
  const statusText = $('#settingsDaemonStatus');
  const statusDot = $('#daemonStatusDot');

  const api = window.pywebview && window.pywebview.api;
  if (api && api.get_daemon_status) {
    const status = await api.get_daemon_status();

    if (status && status.running) {
      if (statusText) statusText.textContent = 'Running (last heartbeat: ' + formatAge(status.age_seconds) + ')';
      if (statusDot) statusDot.className = 'statusIndicator running';
    } else {
      if (statusText) statusText.textContent = 'Not running';
      if (statusDot) statusDot.className = 'statusIndicator stopped';
    }
  } else {
    if (statusText) statusText.textContent = 'Desktop app only';
    if (statusDot) statusDot.className = 'statusIndicator';
  }
}

function formatAge(seconds) {
  if (seconds === null || seconds === undefined) return 'unknown';
  if (seconds < 60) return Math.round(seconds) + 's ago';
  if (seconds < 3600) return Math.round(seconds / 60) + 'm ago';
  return Math.round(seconds / 3600) + 'h ago';
}

function validateHotkey(hotkey) {
  if (!hotkey) return false;

  const parts = hotkey.split('+');
  if (parts.length < 2) return false;

  const validModifiers = ['ctrl', 'alt', 'shift', 'win'];
  const modifiers = parts.slice(0, -1);
  const key = parts[parts.length - 1];

  // All but last must be modifiers
  for (const mod of modifiers) {
    if (!validModifiers.includes(mod)) return false;
  }

  // Last must be a valid key
  if (!key || key.length === 0) return false;

  // Check for reserved combinations
  const reserved = ['ctrl+alt+del', 'win+l', 'ctrl+shift+esc'];
  if (reserved.includes(hotkey)) return false;

  return true;
}