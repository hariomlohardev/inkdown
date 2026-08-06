import { $ } from './state.js';
import { getLibrary, saveLibrary, STORAGE_KEYS } from './storage.js';
import { setThemeMode } from './theme.js';
import { toast } from './ui.js';

const SETTINGS_KEY = 'inkdown:settings';

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
    const raw = localStorage.getItem(SETTINGS_KEY);
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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
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

/* ---------- Apply settings ---------- */
function applySetting(key, value) {
  if (key === 'theme') {
    setThemeMode(value);
  }
  // Other settings are applied on app init or when needed
}

/* ---------- Storage calculation ---------- */
function calculateStorageUsage() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    if (value) {
      total += (key.length + value.length) * 2; // UTF-16
    }
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

/* ---------- Export/Import ---------- */
async function exportAllData() {
  if (!window.JSZip) {
    toast('JSZip not loaded', 'warn');
    return;
  }

  try {
    const zip = new JSZip();
    
    // Export library
    const library = getLibrary();
    zip.file('library.json', JSON.stringify(library, null, 2));
    
    // Export todos
    const todos = localStorage.getItem('inkdown:todos');
    if (todos) {
      zip.file('todos.json', todos);
    }
    
    // Export settings
    zip.file('settings.json', JSON.stringify(currentSettings, null, 2));
    
    // Export versions
    const versions = localStorage.getItem('inkdown:versions');
    if (versions) {
      zip.file('versions.json', versions);
    }
    
    // Export folders
    const folders = localStorage.getItem('inkdown:folders');
    if (folders) {
      zip.file('folders.json', folders);
    }
    
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inkdown-backup-${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast('Library exported successfully');
  } catch (e) {
    console.error('[Inkdown] Export failed:', e);
    toast('Export failed', 'warn');
  }
}

async function importAllData(file) {
  if (!window.JSZip) {
    toast('JSZip not loaded', 'warn');
    return;
  }

  try {
    const zip = await JSZip.loadAsync(file);
    
    if (!confirm('This will replace all current data. Continue?')) {
      return;
    }
    
    // Import library
    const libraryFile = zip.file('library.json');
    if (libraryFile) {
      const libraryContent = await libraryFile.async('string');
      const library = JSON.parse(libraryContent);
      if (Array.isArray(library)) {
        saveLibrary(library);
      }
    }
    
    // Import todos
    const todosFile = zip.file('todos.json');
    if (todosFile) {
      const todosContent = await todosFile.async('string');
      localStorage.setItem('inkdown:todos', todosContent);
    }
    
    // Import settings
    const settingsFile = zip.file('settings.json');
    if (settingsFile) {
      const settingsContent = await settingsFile.async('string');
      const settings = JSON.parse(settingsContent);
      currentSettings = { ...DEFAULT_SETTINGS, ...settings };
      saveSettings();
    }
    
    // Import versions
    const versionsFile = zip.file('versions.json');
    if (versionsFile) {
      const versionsContent = await versionsFile.async('string');
      localStorage.setItem('inkdown:versions', versionsContent);
    }
    
    // Import folders
    const foldersFile = zip.file('folders.json');
    if (foldersFile) {
      const foldersContent = await foldersFile.async('string');
      localStorage.setItem('inkdown:folders', foldersContent);
    }
    
    toast('Library imported successfully. Reloading...');
    setTimeout(() => location.reload(), 1000);
  } catch (e) {
    console.error('[Inkdown] Import failed:', e);
    toast('Import failed: invalid file', 'warn');
  }
}

/* ---------- Clear all data ---------- */
function clearAllData() {
  if (!confirm('This will delete ALL your files, todos, and settings. This cannot be undone. Continue?')) {
    return;
  }
  
  // Clear all Inkdown-related keys
  const keysToClear = [
    STORAGE_KEYS.LIBRARY,
    'inkdown:todos',
    'inkdown:versions',
    'inkdown:folders',
    SETTINGS_KEY
  ];
  
  keysToClear.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Failed to remove ${key}:`, e);
    }
  });
  
  toast('All data cleared. Reloading...');
  setTimeout(() => location.reload(), 1000);
}

/* ---------- Reset settings ---------- */
function resetSettings() {
  if (!confirm('Reset all settings to default? Your files will not be affected.')) {
    return;
  }
  
  currentSettings = { ...DEFAULT_SETTINGS };
  saveSettings();
  
  // Re-apply theme
  setThemeMode(DEFAULT_SETTINGS.theme);
  
  // Update UI
  syncSettingsUI();
  
  toast('Settings reset to default');
}

/* ---------- UI sync ---------- */
function syncSettingsUI() {
  const themeSelect = $('#settingsTheme');
  const fontSelect = $('#settingsDefaultFont');
  const autosaveCheck = $('#settingsAutosave');
  const intervalSelect = $('#settingsAutosaveInterval');
  const storageUsed = $('#settingsStorageUsed');
  
  if (themeSelect) themeSelect.value = currentSettings.theme;
  if (fontSelect) fontSelect.value = currentSettings.defaultFont;
  if (autosaveCheck) autosaveCheck.checked = currentSettings.autosave;
  if (intervalSelect) intervalSelect.value = currentSettings.autosaveInterval;
  
  if (storageUsed) {
    const bytes = calculateStorageUsage();
    storageUsed.textContent = formatBytes(bytes) + ' used';
  }
}

/* ---------- Modal control ---------- */
export function openSettings() {
  loadSettings();
  syncSettingsUI();
  const modal = $('#settingsModal');
  if (modal) modal.hidden = false;
}

export function closeSettings() {
  const modal = $('#settingsModal');
  if (modal) modal.hidden = true;
}

/* ---------- Init ---------- */
export function initSettings() {
  loadSettings();
  
  const modal = $('#settingsModal');
  const closeBtn = $('#settingsClose');
  const themeSelect = $('#settingsTheme');
  const fontSelect = $('#settingsDefaultFont');
  const autosaveCheck = $('#settingsAutosave');
  const intervalSelect = $('#settingsAutosaveInterval');
  const exportBtn = $('#settingsExportAll');
  const importBtn = $('#settingsImportAll');
  const importFile = $('#settingsImportFile');
  const clearBtn = $('#settingsClearAll');
  const resetBtn = $('#settingsReset');
  
  // Close button
  if (closeBtn) closeBtn.onclick = closeSettings;
  
  // Click outside to close
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeSettings();
    });
  }
  
  // Theme select
  if (themeSelect) {
    themeSelect.addEventListener('change', e => {
      updateSetting('theme', e.target.value);
      toast('Theme updated');
    });
  }
  
  // Font select
  if (fontSelect) {
    fontSelect.addEventListener('change', e => {
      updateSetting('defaultFont', e.target.value);
      toast('Default font updated');
    });
  }
  
  // Autosave toggle
  if (autosaveCheck) {
    autosaveCheck.addEventListener('change', e => {
      updateSetting('autosave', e.target.checked);
      toast('Auto-save ' + (e.target.checked ? 'enabled' : 'disabled'));
    });
  }
  
  // Autosave interval
  if (intervalSelect) {
    intervalSelect.addEventListener('change', e => {
      updateSetting('autosaveInterval', parseInt(e.target.value));
      toast('Auto-save interval updated');
    });
  }
  
  // Export
  if (exportBtn) exportBtn.onclick = exportAllData;
  
  // Import
  if (importBtn && importFile) {
    importBtn.onclick = () => importFile.click();
    importFile.addEventListener('change', e => {
      if (e.target.files[0]) {
        importAllData(e.target.files[0]);
        e.target.value = '';
      }
    });
  }
  
  // Clear all
  if (clearBtn) clearBtn.onclick = clearAllData;
  
  // Reset settings
  if (resetBtn) resetBtn.onclick = resetSettings;
  
  // Listen for settings:open event
  document.addEventListener('settings:open', openSettings);
  
  console.log('[Inkdown] Settings initialized');
}