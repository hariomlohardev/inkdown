import { $ } from './state.js';
import { state } from './state.js';
import { getLibrary, getFile } from './storage.js';
import { toast } from './ui.js';

let isOpen = false;
let results = [];
let selectedIndex = 0;
let commandRegistry = [];

/* ---------- Command Registry ---------- */
function buildRegistry() {
  commandRegistry = [];

  // Files
  const files = getLibrary();
  files.forEach(f => {
    commandRegistry.push({
      type: 'file',
      id: f.id,
      title: f.name,
      subtitle: f.folder ? '📁 ' + f.folder : 'Library',
      icon: '📄',
      keywords: (f.name + ' ' + (f.folder || '') + ' ' + (f.md || '').slice(0, 200)).toLowerCase(),
      action: () => openFileById(f.id)
    });
  });

  // Actions
  const actions = [
    { title: 'New file', subtitle: 'Create a new markdown file', icon: '➕', keywords: 'new file create add', action: () => dispatch('library:new') },
    { title: 'New folder', subtitle: 'Create a folder to organize files', icon: '📁', keywords: 'new folder create organize', action: () => dispatch('library:newfolder') },
    { title: 'Open Todos', subtitle: 'View your todo list', icon: '✅', keywords: 'todos tasks open view', action: () => dispatch('todos:open') },
    { title: 'Open Settings', subtitle: 'App settings and preferences', icon: '⚙️', keywords: 'settings preferences options config', action: () => dispatch('settings:open') },
    { title: 'Toggle theme', subtitle: 'Switch between light and dark', icon: '🌙', keywords: 'theme dark light toggle switch', action: () => toggleTheme() },
    { title: 'Toggle edit mode', subtitle: 'Switch between read and edit', icon: '✏️', keywords: 'edit mode toggle write read', action: () => dispatch('app:toggleedit') },
    { title: 'Toggle focus mode', subtitle: 'Distraction-free reading', icon: '🎯', keywords: 'focus zen distraction free', action: () => dispatch('app:focus') },
    { title: 'Present as slides', subtitle: 'Convert document to presentation', icon: '📽️', keywords: 'slides presentation present powerpoint', action: () => dispatch('slides:show') },
    { title: 'Toggle todo widget', subtitle: 'Show/hide floating widget', icon: '📌', keywords: 'widget floating todo popup', action: () => { if (window.toggleTodoWidget) window.toggleTodoWidget(); } },
    { title: 'Quick add todo', subtitle: 'Add a todo instantly', icon: '⚡', keywords: 'quick add todo task', action: () => dispatch('todo:quickadd') },
    { title: 'Search document', subtitle: 'Find text in current document', icon: '🔍', keywords: 'search find document text', action: () => dispatch('app:search') },
    { title: 'Export as PDF', subtitle: 'Save document as PDF', icon: '📄', keywords: 'export pdf save print', action: () => dispatch('export:pdf') },
    { title: 'Export as HTML', subtitle: 'Save document as HTML file', icon: '🌐', keywords: 'export html save web', action: () => dispatch('export:html') },
    { title: 'Export as image', subtitle: 'Save document as PNG image', icon: '🖼️', keywords: 'export image png picture', action: () => dispatch('export:png') },
    { title: 'Copy share link', subtitle: 'Generate a shareable URL', icon: '🔗', keywords: 'share link url copy', action: () => dispatch('export:share') },
    { title: 'Download backup', subtitle: 'Export entire library as zip', icon: '💾', keywords: 'backup zip download export all', action: () => dispatch('settings:export') },
    { title: 'Show keyboard shortcuts', subtitle: 'View all keybindings', icon: '⌨️', keywords: 'shortcuts keys help keybindings', action: () => dispatch('shortcuts:open') },
  ];

  actions.forEach(a => {
    commandRegistry.push({
      type: 'action',
      title: a.title,
      subtitle: a.subtitle,
      icon: a.icon,
      keywords: a.keywords.toLowerCase(),
      action: a.action
    });
  });

  // Navigation
  const nav = [
    { title: 'Go to Home', subtitle: 'Open the library', icon: '🏠', keywords: 'home library files go navigate', action: () => goView('library') },
    { title: 'Go to Todos', subtitle: 'Open the todos page', icon: '✅', keywords: 'todos tasks go navigate', action: () => goView('todos') },
    { title: 'Go to Settings', subtitle: 'Open settings page', icon: '⚙️', keywords: 'settings preferences go navigate', action: () => goView('settings') },
    { title: 'Back to library', subtitle: 'Return from current view', icon: '←', keywords: 'back return library home', action: () => goView('library') },
  ];

  nav.forEach(n => {
    commandRegistry.push({
      type: 'nav',
      title: n.title,
      subtitle: n.subtitle,
      icon: n.icon,
      keywords: n.keywords.toLowerCase(),
      action: n.action
    });
  });
}

/* ---------- Fuzzy Search ---------- */
function fuzzyScore(query, text) {
  if (!query) return 1;
  query = query.toLowerCase();
  text = text.toLowerCase();

  if (text === query) return 100;
  if (text.startsWith(query)) return 90;
  if (text.includes(query)) return 70;

  // Fuzzy: all query chars appear in order
  let qi = 0;
  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i] === query[qi]) qi++;
  }
  if (qi === query.length) return 50;

  return 0;
}

function searchCommands(query) {
  if (!query.trim()) {
    // Show recent files + common actions
    return commandRegistry
      .filter(c => c.type === 'file')
      .slice(0, 8)
      .concat(commandRegistry.filter(c => c.type === 'action').slice(0, 6));
  }

  const q = query.toLowerCase().trim();
  const scored = commandRegistry.map(cmd => {
    const titleScore = fuzzyScore(q, cmd.title) * 2;
    const keywordScore = fuzzyScore(q, cmd.keywords || '');
    const subtitleScore = fuzzyScore(q, cmd.subtitle || '') * 0.5;
    const score = Math.max(titleScore, keywordScore, subtitleScore);
    return { ...cmd, score };
  }).filter(c => c.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 15);
}

/* ---------- Rendering ---------- */
function renderResults(items) {
  const container = $('#cmdResults');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="cmdEmpty">
        <div class="cmdEmptyIcon">🔍</div>
        <div>No results found</div>
      </div>
    `;
    return;
  }

  let html = '';
  let lastType = '';

  items.forEach((item, i) => {
    if (item.type !== lastType) {
      const labels = { file: 'Files', action: 'Actions', nav: 'Navigation' };
      html += `<div class="cmdGroup">${labels[item.type] || item.type}</div>`;
      lastType = item.type;
    }

    html += `
      <div class="cmdItem ${i === selectedIndex ? 'selected' : ''}" data-index="${i}">
        <div class="cmdIcon">${item.icon}</div>
        <div class="cmdText">
          <b>${escHtml(item.title)}</b>
          <span>${escHtml(item.subtitle || '')}</span>
        </div>
        ${item.type === 'file' ? '<span class="cmdHint">Open</span>' : ''}
      </div>
    `;
  });

  container.innerHTML = html;

  // Click handlers
  container.querySelectorAll('.cmdItem').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      executeCommand(items[idx]);
    });
    el.addEventListener('mouseenter', () => {
      selectedIndex = parseInt(el.dataset.index);
      updateSelection();
    });
  });
}

function updateSelection() {
  const container = $('#cmdResults');
  if (!container) return;
  container.querySelectorAll('.cmdItem').forEach((el, i) => {
    el.classList.toggle('selected', i === selectedIndex);
  });
  // Scroll selected into view
  const sel = container.querySelector('.cmdItem.selected');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

/* ---------- Execution ---------- */
function executeCommand(cmd) {
  if (!cmd) return;
  closePalette();
  if (cmd.action) {
    setTimeout(() => cmd.action(), 50);
  }
}

function openFileById(id) {
  const file = getFile(id);
  if (file) {
    dispatch('file:open', { file });
  }
}

function dispatch(event, detail) {
  document.dispatchEvent(new CustomEvent(event, { detail }));
}

function goView(view) {
  document.body.dataset.view = view;
  if (view === 'library') document.dispatchEvent(new CustomEvent('library:shown'));
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.dataset.theme;
  html.dataset.theme = current === 'dark' ? 'light' : 'dark';
  toast('Theme switched to ' + html.dataset.theme);
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------- Open / Close ---------- */
export function openPalette() {
  if (isOpen) return;
  buildRegistry();
  isOpen = true;
  selectedIndex = 0;

  const palette = $('#cmdPalette');
  const input = $('#cmdInput');
  if (!palette || !input) return;

  palette.hidden = false;
  input.value = '';
  results = searchCommands('');
  renderResults(results);
  setTimeout(() => input.focus(), 30);
}

export function closePalette() {
  if (!isOpen) return;
  isOpen = false;
  const palette = $('#cmdPalette');
  if (palette) palette.hidden = true;
}

export function togglePalette() {
  if (isOpen) closePalette();
  else openPalette();
}

/* ---------- Init ---------- */
export function initPalette() {
  const input = $('#cmdInput');
  const palette = $('#cmdPalette');

  if (!input || !palette) return;

  // Search on input
  input.addEventListener('input', () => {
    selectedIndex = 0;
    results = searchCommands(input.value);
    renderResults(results);
  });

  // Keyboard navigation
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) executeCommand(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  });

  // Click outside to close
  palette.addEventListener('click', e => {
    if (e.target === palette) closePalette();
  });

  // Global hotkey: Ctrl+P
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      togglePalette();
    }
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      closePalette();
    }
  });

  console.log('[Inkdown] Command palette initialized');
}