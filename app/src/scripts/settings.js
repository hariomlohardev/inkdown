import { $, $$ } from './state.js';
import { getLibrary, saveLibrary, STORAGE_KEYS, getFileCount, getArchivedFiles, MAX_FILES, getStorageUsage } from './storage.js';
import { setThemeMode } from './theme.js';
import { toast } from './ui.js';
import { createBackup, getBackups, restoreBackup, deleteBackup, exportBackupAsZip, importBackupFromZip, formatBackupTime } from './backup-manager.js';

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

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
  const mode = currentSettings.theme;
  $$('.setThemeOpt').forEach(b => b.classList.toggle('on', b.dataset.themeValue === mode));
  const font = $('#settingsDefaultFont'); if (font) font.value = currentSettings.defaultFont;
  const as = $('#settingsAutosave'); if (as) as.checked = currentSettings.autosave;
  const iv = $('#settingsAutosaveInterval'); if (iv) iv.value = currentSettings.autosaveInterval;

  updateStorageUI();
}

/**
 * Update storage usage display (async for IDB support)
 */
export async function updateStorageUI() {
  const label = $('#settingsStorageUsed');
  const fill = $('#settingsStorageFill');
  const fileCount = $('#settingsFileCount');
  const archivedCount = $('#settingsArchivedCount');

  try {
    if (label) label.textContent = 'Calculating...';

    const usage = await getStorageUsage();

    if (label) {
      const totalFormatted = formatBytes(usage.total);
      label.textContent = totalFormatted;
    }

    if (fill) {
      // Visual max: 100MB for the progress bar
      const maxBytes = 100 * 1024 * 1024;
      const pct = Math.min(100, (usage.total / maxBytes) * 100);
      fill.style.width = pct + '%';

      // Color coding
      fill.className = 'storageFill';
      if (pct < 50) {
        fill.classList.add('level-safe');
      } else if (pct < 80) {
        fill.classList.add('level-warning');
      } else {
        fill.classList.add('level-critical');
      }
    }

    if (fileCount) {
      const activeFiles = getFileCount();
      fileCount.textContent = activeFiles + ' / ' + MAX_FILES + ' files';
    }

    if (archivedCount) {
      archivedCount.textContent = getArchivedFiles().length + ' files';
    }
  } catch (e) {
    console.error('[Settings] Storage calculation error:', e);
    if (label) label.textContent = 'Error';
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

  // global entry points
  document.addEventListener('settings:open', showSettingsPage);

  // Initialize backup handlers
  initBackupHandlers();
  initHotkeySettings();

  console.log('[Inkdown] Settings page initialized');
}

/* ---------- Backup handlers ---------- */
export function initBackupHandlers() {
  const createBtn = $('#settingsCreateBackup');
  if (createBtn) {
    createBtn.onclick = async () => {
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';

      const result = await createBackup('manual');

      createBtn.disabled = false;
      createBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Create Backup Now</span>';

      if (result.success) {
        toast('Backup created', 'success');
      } else {
        toast('Backup failed: ' + result.error, 'error');
      }
    };
  }

  const exportBtn = $('#settingsExportBackup');
  if (exportBtn) {
    exportBtn.onclick = async () => {
      exportBtn.disabled = true;
      const result = await exportBackupAsZip();
      exportBtn.disabled = false;

      if (!result.success) {
        toast('Export failed: ' + result.error, 'error');
      }
    };
  }

  const importBtn = $('#settingsImportBackup');
  const importFile = $('#settingsBackupFile');
  if (importBtn && importFile) {
    importBtn.onclick = () => importFile.click();
    importFile.onchange = async (e) => {
      if (e.target.files[0]) {
        if (confirm('Import this backup? Current data will be backed up first.')) {
          const result = await importBackupFromZip(e.target.files[0]);
          if (result.success) {
            toast('Backup imported. Reloading...', 'success');
            setTimeout(() => location.reload(), 1000);
          } else {
            toast('Import failed: ' + result.error, 'error');
          }
        }
        e.target.value = '';
      }
    };
  }
}

/* ---------- Hotkey management ---------- */
export async function initHotkeySettings() {
  const openInput = $('#settingsHotkeyOpen');
  const captureInput = $('#settingsHotkeyCapture');
  const saveBtn = $('#settingsSaveHotkeys');
  const resetBtn = $('#settingsResetHotkeys');
  const statusText = $('#settingsDaemonStatus');
  const statusDot = $('#daemonStatusDot');

  if (!openInput || !captureInput) return;

  await loadHotkeyConfig();
  updateDaemonStatus();
  setInterval(updateDaemonStatus, 30000);

  if (saveBtn) {
    saveBtn.onclick = async () => {
      const openHotkey = openInput.value.trim().toLowerCase();
      const captureHotkey = captureInput.value.trim().toLowerCase();

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
      if (statusText) statusText.textContent = 'Running (' + formatAge(status.age_seconds) + ')';
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
  for (const mod of modifiers) {
    if (!validModifiers.includes(mod)) return false;
  }
  if (!key || key.length === 0) return false;
  const reserved = ['ctrl+alt+del', 'win+l', 'ctrl+shift+esc'];
  if (reserved.includes(hotkey)) return false;
  return true;
}