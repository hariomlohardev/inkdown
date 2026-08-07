// Storage quota monitoring system
// Prevents silent save failures by tracking localStorage usage
import { $ } from './state.js';

const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024; // 5MB conservative limit
const WARN_THRESHOLD = 0.70;
const CRITICAL_THRESHOLD = 0.90;
const BLOCK_THRESHOLD = 0.95;

let lastLevel = 'safe';

/** Calculate total localStorage usage in bytes */
export function calculateStorageUsage() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      if (value !== null) {
        // UTF-16 uses 2 bytes per character
        total += (key.length + value.length) * 2;
      }
    }
  } catch (e) {
    console.warn('[StorageMonitor] Usage calculation failed:', e);
  }
  return total;
}

/** Get current quota status */
export function getQuotaStatus() {
  const used = calculateStorageUsage();
  const percent = used / STORAGE_LIMIT_BYTES;

  let level = 'safe';
  if (percent >= BLOCK_THRESHOLD) level = 'blocked';
  else if (percent >= CRITICAL_THRESHOLD) level = 'critical';
  else if (percent >= WARN_THRESHOLD) level = 'warning';

  return {
    used,
    limit: STORAGE_LIMIT_BYTES,
    percent: Math.round(percent * 100),
    level,
    canSave: percent < BLOCK_THRESHOLD
  };
}

/** Check if a write of given size is allowed */
export function canWrite(additionalBytes = 0) {
  const status = getQuotaStatus();
  const projectedPercent = (status.used + additionalBytes) / STORAGE_LIMIT_BYTES;
  return projectedPercent < BLOCK_THRESHOLD;
}

/** Dispatch storage events when threshold crossed */
export function checkAndNotify() {
  const status = getQuotaStatus();

  if (status.level !== lastLevel) {
    const eventMap = {
      warning: 'storage:warning',
      critical: 'storage:critical',
      blocked: 'storage:blocked'
    };

    const eventName = eventMap[status.level];
    if (eventName) {
      document.dispatchEvent(new CustomEvent(eventName, { detail: status }));
    }

    lastLevel = status.level;
  }

  updateStorageUI(status);
  return status;
}

/** Update storage UI in settings page */
function updateStorageUI(status) {
  const bar = $('#settingsStorageFill');
  const label = $('#settingsStorageUsed');

  if (bar) {
    bar.style.width = Math.min(status.percent, 100) + '%';
    bar.className = 'storageFill level-' + status.level;
  }

  if (label) {
    label.textContent = formatBytes(status.used) + ' of ' + formatBytes(status.limit) + ' (' + status.percent + '%)';
  }
}

/** Format bytes to human readable */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/** Initialize storage monitor */
export function initStorageMonitor() {
  // Check on load
  checkAndNotify();

  // Check periodically
  setInterval(checkAndNotify, 30000);

  // Listen for storage events from other tabs
  window.addEventListener('storage', () => {
    checkAndNotify();
  });

  // Wire up event handlers for toasts
  document.addEventListener('storage:warning', (e) => {
    showToast('Storage getting full (' + e.detail.percent + '% used). Consider exporting your data.', 'warn');
  });

  document.addEventListener('storage:critical', (e) => {
    showToast('Storage almost full (' + e.detail.percent + '%)! Export your data now.', 'error');
  });

  document.addEventListener('storage:blocked', () => {
    showStorageBlockedDialog();
  });

  console.log('[Inkdown] Storage monitor initialized');
}

function showToast(message, type = 'info') {
  document.dispatchEvent(new CustomEvent('toast', { detail: { message, type } }));
}

function showStorageBlockedDialog() {
  const existing = $('#storageBlockedDialog');
  if (existing) return;

  const dialog = document.createElement('div');
  dialog.id = 'storageBlockedDialog';
  dialog.className = 'storageBlockedDialog';
  dialog.innerHTML = `
    <div class="sbdBox">
      <h3>⚠️ Storage Full</h3>
      <p>Your browser storage is full. New changes cannot be saved.</p>
      <p><strong>Recommended actions:</strong></p>
      <ul>
        <li>Export your library as a backup</li>
        <li>Delete files you no longer need</li>
        <li>Archive old files</li>
      </ul>
      <div class="sbdActions">
        <button class="sbdBtn primary" id="sbdExport">Export Backup</button>
        <button class="sbdBtn" id="sbdClose">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  $('#sbdExport').onclick = () => {
    document.dispatchEvent(new CustomEvent('backup:create'));
    dialog.remove();
  };

  $('#sbdClose').onclick = () => dialog.remove();

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.remove();
  });
}