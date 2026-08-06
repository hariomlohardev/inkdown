import { $, $$ } from './state.js';
import { getLibrary, saveLibrary, STORAGE_KEYS } from './storage.js';
import { setThemeMode, getMode } from './theme.js';
import { toast } from './ui.js';

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

/* ---------- Storage calculation ---------- */
function calculateStorageUsage() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    if (value) total += (key.length + value.length) * 2;
  }
  return total;
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