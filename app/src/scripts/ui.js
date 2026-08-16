// UI orchestration: toasts, menus, overlay, file IO, render loop
import { state, $, $$, esc, STORAGE_KEYS, debounce } from './state.js';
import { buildHTML, runMermaid, runMath } from './markdown.js';
import { decorate } from './decorate.js';
import { buildTOC } from './toc.js';
import { measureNav, updateReadProgress, updateMMThumb } from './navigation.js';
import { applyHighlights } from './highlight.js';
import { updateStats, lintDebounced, pushVersion } from './quality.js';
import { upsertFile, createFile, getLibrary, uniqueName } from './storage.js';
import { ED_ACTS } from './editor.js';
import { openSearch, closeSearch } from './search.js';
import { SAMPLE } from './samples.js';
import * as tabs from './tabs.js';

const ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

export function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = (type === 'ok' ? ICON_OK : '⚠️ ') + esc(msg);
  $('#toasts').appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 320);
  }, 2300);
}

// Guard: don't lose words on reload/close when dirty
window.addEventListener('beforeunload', e => {
  if (state.dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});


/** Restore saved scroll position after file is rendered */
function restoreScrollPosition(file) {
  if (!file || typeof file.scroll !== 'number' || file.scroll <= 0) return;
  
  const scrollArea = $('#scrollArea');
  if (!scrollArea) return;

  // Wait for render to settle, then scroll
  requestAnimationFrame(() => {
    setTimeout(() => {
      const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
      const targetScroll = Math.min(file.scroll, maxScroll);
      
      if (targetScroll > 0) {
        scrollArea.scrollTop = targetScroll;
        updateReadProgress();
        updateMMThumb();
      }
    }, 50);
  });
}

/* ================= RENDER PIPELINE ================= */
export async function renderView(animate = false) {
  const target = state.editing ? state.previewEl : state.docEl;
  target.classList.remove('anim');
  target.innerHTML = buildHTML(state.md);
  decorate(target);
  await runMermaid(target);
  runMath(target);
  applyHighlights(target);
  buildTOC(target);
  measureNav();
  updateMMThumb();
  updateStats();
  if (animate) {
    void target.offsetWidth;
    target.classList.add('anim');
  }
  document.dispatchEvent(new CustomEvent('doc:rendered'));
}

const renderPreviewDebounced = debounce(() => renderView(false), 280);

/* ================= FILE OPEN / BACK ================= */
export async function openFile(rec, opts = {}) {
  let fullRec = rec;
  if (rec._useIDB || rec._hasExternalContent) {
    const { getFileWithContent } = await import('./storage.js');
    fullRec = await getFileWithContent(rec.id);
  }
  tabs.openTab(fullRec, opts);
  restoreScrollPosition(fullRec);
}

export function backToLibrary() {
  tabs.snapshotCurrent();
  if (state.dirty) saveDoc(false);
  document.body.dataset.view = 'library';
  document.title = 'Inkdown — Library';
  document.dispatchEvent(new CustomEvent('library:shown'));
  tabs.renderTabBar();
}

function activateUI(tab) {
  document.body.classList.remove('focus');
  document.body.dataset.view = 'reader';
  document.body.classList.toggle('editing', !!tab.editing);
  const be = $('#btnEdit'); if (be) be.classList.toggle('active', !!tab.editing);
  state.editorEl.value = state.md;
  $('#docTitle').textContent = state.name;
  $('#stName').textContent = state.name;
  document.title = state.name + ' — Inkdown';
  if (state.dirty) { $('#saveDot').classList.add('dirty'); $('#saveTxt').textContent = 'Unsaved changes'; }
  else { $('#saveDot').classList.remove('dirty'); $('#saveTxt').textContent = 'Saved'; }
  
  renderView(false).then(() => {
    // 🎯 Restore scroll position when switching to this tab
    if (state.scroll && state.scroll > 0) {
      const scrollArea = $('#scrollArea');
      if (scrollArea) {
        const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
        const targetScroll = Math.min(state.scroll, maxScroll);
        if (targetScroll > 0) {
          scrollArea.scrollTop = targetScroll;
          updateReadProgress();
          updateMMThumb();
        }
      }
    }
    if (tab.editing) state.editorEl.focus();
  });
}

/* ================= SAVE / DIRTY ================= */
export function markDirty() {
  state.dirty = true;
  $('#saveDot').classList.add('dirty');
  $('#saveTxt').textContent = 'Unsaved changes';
  autoSave();
}

const autoSave = debounce(() => saveDoc(false), 1200);

export function saveDoc(announce = false) {
  pushVersion();
  if (!state.fileId) {
    // safety: create a record if somehow missing
    const rec = createFile(state.name, state.md);
    state.fileId = rec.id;
  }
  const ok = upsertFile({
    id: state.fileId,
    name: state.name,
    md: state.md,
    updatedAt: Date.now(),
    scroll: state.scroll,
    highlights: state.highlights,
    goal: state.goal
  });
  if (ok) {
    state.dirty = false;
    setSaved('Saved · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const b = $('#btnSave');
    b.classList.remove('flash');
    void b.offsetWidth;
    b.classList.add('flash');
    if (announce) toast('Saved to library');
  } else {
    toast('Could not save (storage full?)', 'warn');
  }
}

function setSaved(txt) {
  $('#saveDot').classList.remove('dirty');
  $('#saveTxt').textContent = txt;
}

export async function loadDoc(md, name, animate = true, rec) {
  state.md = md;
  state.name = name || 'untitled.md';
  if (rec?.id) state.fileId = rec.id;
  state.dirty = false;
  state.highlights = rec?.highlights || [];
  state.goal = rec?.goal || 0;
  state.scroll = rec?.scroll || 0;
  state.collapsed.clear();
  $('#docTitle').textContent = state.name;
  $('#stName').textContent = state.name;
  document.title = state.name + ' — Inkdown';
  setSaved('Saved');
  closeSearch();
  if (state.editing) state.editorEl.value = md;
  await renderView(animate);
  // 🎯 Scroll restoration happens via doc:rendered event listener now
}

export function setEditing(on) {
  state.editing = on;
  document.body.classList.toggle('editing', on);
  $('#btnEdit').classList.toggle('active', on);
  $('#btnEdit').title = on ? 'Done editing (Ctrl+E)' : 'Quick edit (Ctrl+E)';
  if (on) {
    state.editorEl.value = state.md;
    renderView(false);
    lintDebounced();
    setTimeout(() => state.editorEl.focus(), 60);
  } else {
    renderView(true);
    updateReadProgress();
  }
}

function setFocus(on) {
  document.body.classList.toggle('focus', on);
  $('#btnFocus').classList.toggle('active', on);
  if (on) state.scrollArea.focus();
}

/* ================= INIT ================= */
export function initUI() {
  bindStaticButtons();
  initMenus();
  initOverlay();
  initRename();
  initReading();
  initSaveExport();
  initScrollMemory();
  tabs.init({ onActivate: activateUI, onEmpty: backToLibrary, onPlus: backToLibrary });
}

/** Wire up scroll position memory */
function initScrollMemory() {
  // Restore scroll position after every render (for re-renders)
  document.addEventListener('doc:rendered', () => {
    if (!state.fileId || state.editing) return;
    if (!state.scroll || state.scroll <= 0) return;
    
    const scrollArea = $('#scrollArea');
    if (!scrollArea) return;

    setTimeout(() => {
      const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
      const targetScroll = Math.min(state.scroll, maxScroll);
      if (targetScroll > 0) {
        // Only restore if we're significantly off (avoids fighting with user scroll)
        const currentDiff = Math.abs(scrollArea.scrollTop - targetScroll);
        if (currentDiff > 100) {
          scrollArea.scrollTop = targetScroll;
          updateReadProgress();
          updateMMThumb();
        }
      }
    }, 100);
  });
}

function bindStaticButtons() {
  $('#btnBack').onclick = backToLibrary;
  $('#logoHome').onclick = backToLibrary;
  $('#btnEdit').onclick = () => setEditing(!state.editing);
  $('#btnFocus').onclick = () => setFocus(!document.body.classList.contains('focus'));
  $('#focusExit').onclick = () => setFocus(false);

  state.editorEl.addEventListener('input', () => {
    state.md = state.editorEl.value;
    markDirty();
    renderPreviewDebounced();
  });
}

function initMenus() {
  const closeAllMenus = () => $$('.menu, .pop').forEach(m => m.classList.remove('open'));

  $('#btnRead').onclick = e => {
    e.stopPropagation();
    const isOpen = $('#readMenu').classList.contains('open');
    closeAllMenus();
    if (!isOpen) $('#readMenu').classList.add('open');
  };
  $('#btnRead').addEventListener('mousedown', e => e.stopPropagation());
  $('#readMenu').addEventListener('click', e => e.stopPropagation());

  $('#btnExport').onclick = e => {
    e.stopPropagation();
    const isOpen = $('#exportMenu').classList.contains('open');
    closeAllMenus();
    if (!isOpen) $('#exportMenu').classList.add('open');
  };

  document.addEventListener('mousedown', e => {
    if (!e.target.closest('.menuWrap')) $('#exportMenu').classList.remove('open');
    if (!e.target.closest('#editTools')) $$('.pop').forEach(p => p.classList.remove('open'));
  });
}

function initOverlay() {
  const overlay = $('#overlay');
  const fileInput = $('#fileInput');
  let dragDepth = 0, dragMode = false;

  const inReader = () => document.body.dataset.view === 'reader';

  const showOverlay = drag => {
    overlay.classList.add('open');
    overlay.classList.toggle('dragging', !!drag);
  };
  const hideOverlay = () => {
    overlay.classList.remove('open', 'dragging');
    dragDepth = 0;
  };

  $('#btnOpen').onclick = () => showOverlay(false);
  $('#closeOverlay').onclick = hideOverlay;
  overlay.addEventListener('click', e => { if (e.target === overlay) hideOverlay(); });
  $('#btnBrowse').onclick = () => fileInput.click();

  fileInput.onchange = () => {
    if (fileInput.files[0]) readFile(fileInput.files[0]);
    fileInput.value = '';
  };

  // Every import creates a NEW library file and opens it
  $('#btnSample').onclick = () => {
    const name = uniqueName('sample-readme.md', getLibrary());
    const rec = createFile(name, SAMPLE);
    hideOverlay();
    openFile(rec);
    toast('Sample added to library');
  };

  $('#btnPaste').onclick = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim()) {
        const name = uniqueName('pasted.md', getLibrary());
        const rec = createFile(name, t);
        hideOverlay();
        openFile(rec);
        toast('Pasted into library');
        return;
      }
    } catch (e) {}
    const name = uniqueName('untitled.md', getLibrary());
    const rec = createFile(name, '');
    hideOverlay();
    openFile(rec, { edit: true });
    toast('Paste your Markdown (Ctrl+V)');
  };

  function readFile(f) {
    if (!/\.(md|markdown|mdown|txt)$/i.test(f.name)) {
      toast('Not a Markdown file', 'warn');
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      const name = uniqueName(f.name, getLibrary());
      const rec = createFile(name, r.result);
      hideOverlay();
      openFile(rec);
      toast('Imported ' + f.name);
    };
    r.readAsText(f);
  }

  // Drag & drop ONLY active inside the reader view
  window.addEventListener('dragenter', e => {
    if (!inReader()) return;
    e.preventDefault();
    dragMode = true;
    dragDepth++;
    showOverlay(true);
  });
  window.addEventListener('dragover', e => { if (inReader()) e.preventDefault(); });
  window.addEventListener('dragleave', e => {
    if (!inReader()) return;
    e.preventDefault();
    if (dragMode && --dragDepth <= 0) overlay.classList.remove('dragging');
  });
  window.addEventListener('drop', e => {
    if (!inReader()) return;
    e.preventDefault();
    dragMode = false;
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (f) readFile(f);
    else {
      const t = e.dataTransfer.getData('text');
      if (t.trim()) {
        const name = uniqueName('pasted.md', getLibrary());
        const rec = createFile(name, t);
        openFile(rec);
      }
    }
    hideOverlay();
  });

  state._showOverlay = showOverlay;
  state._hideOverlay = hideOverlay;
}

function initRename() {
  const titleEl = $('#docTitle');
  titleEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
  });
  titleEl.addEventListener('blur', () => {
    const t = titleEl.textContent.replace(/\n/g, '').trim();
    titleEl.textContent = t;
    if (t && t !== state.name) {
      state.name = t;
      $('#stName').textContent = t;
      document.title = t + ' — Inkdown';
      markDirty();
    }
  });
}

function initReading() {
  let readCfg = Object.assign(
    { font: 'serif', size: 17, width: 860 },
    JSON.parse(localStorage.getItem(STORAGE_KEYS.READ) || '{}')
  );

  function applyRead() {
    document.body.dataset.font = readCfg.font;
    document.documentElement.style.setProperty('--docfs', readCfg.size + 'px');
    document.documentElement.style.setProperty('--pagew', readCfg.width + 'px');
    $$('.fontBtn').forEach(b => b.classList.toggle('on', b.dataset.f === readCfg.font));
    $('#fsVal').textContent = readCfg.size + 'px';
    $('#pwRange').value = readCfg.width;
    try { localStorage.setItem(STORAGE_KEYS.READ, JSON.stringify(readCfg)); } catch (e) {}
  }

  $$('.fontBtn').forEach(b => b.onclick = () => { readCfg.font = b.dataset.f; applyRead(); });
  $('#fsDown').onclick = () => { readCfg.size = Math.max(13, readCfg.size - 1); applyRead(); };
  $('#fsUp').onclick = () => { readCfg.size = Math.max(13, Math.min(24, readCfg.size + 1)); applyRead(); };
  $('#pwRange').addEventListener('input', e => { readCfg.width = +e.target.value; applyRead(); });
  applyRead();
}

function initSaveExport() {
  $('#btnSave').onclick = () => saveDoc(true);

  const menu = $('#exportMenu');
  menu.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    menu.classList.remove('open');
    const base = state.name.replace(/\.(md|markdown|mdown|txt)$/i, '');

    if (b.dataset.act === 'md') {
      const content = state.md;
      const blob = new Blob([content], { type: 'text/markdown' });
      const filename = state.name.endsWith('.md') ? state.name : base + '.md';
      await download(blob, filename);

    } else if (b.dataset.act === 'copy') {
      try {
        await navigator.clipboard.writeText(state.md);
        toast('Markdown copied to clipboard');
      } catch (err) {
        toast('Copy failed', 'warn');
      }

    } else if (b.dataset.act === 'html') {
      const content = exportHTML();
      const blob = new Blob([content], { type: 'text/html' });
      await download(blob, base + '.html');

    } else if (b.dataset.act === 'rich') {
      // Copy rendered HTML to clipboard
      try {
        const htmlContent = state.docEl.innerHTML;
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([htmlContent], { type: 'text/html' }),
            'text/plain': new Blob([state.docEl.textContent], { type: 'text/plain' })
          })
        ]);
        toast('Rendered content copied');
      } catch (err) {
        toast('Copy failed', 'warn');
      }

    } else if (b.dataset.act === 'png') {
      // Export as image
      try {
        toast('Generating image...');
        const canvas = await html2canvas(state.docEl, {
          backgroundColor: '#ffffff',
          scale: 2
        });
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];

        const api = window.pywebview && window.pywebview.api;
        if (api && typeof api.save_binary_file === 'function') {
          const result = await api.save_binary_file(base + '.png', base64);
          if (result) {
            toast('Image saved: ' + result.split(/[/\\]/).pop());
          }
        } else {
          // Browser fallback
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = base + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          toast('Image downloaded');
        }
      } catch (err) {
        console.error('[Export] PNG export failed:', err);
        toast('Image export failed', 'warn');
      }

    } else if (b.dataset.act === 'pdf') {
      // PDF: use browser print dialog
      toast('Opening print dialog — choose "Save as PDF"');
      setTimeout(() => window.print(), 300);

    } else if (b.dataset.act === 'print') {
      window.print();

    } else if (b.dataset.act === 'share') {
      // Copy share link
      try {
        const encoded = btoa(unescape(encodeURIComponent(state.md)));
        const url = location.origin + location.pathname + '#doc=' + encoded;
        await navigator.clipboard.writeText(url);
        toast('Share link copied to clipboard');
      } catch (err) {
        toast('Could not create share link', 'warn');
      }

    } else if (b.dataset.act === 'backup') {
      // Export backup as zip
      await exportBackupZip();
    }
  });
}

/** Export entire library as a ZIP backup */
async function exportBackupZip() {
  if (typeof JSZip === 'undefined') {
    toast('JSZip not loaded — cannot create backup', 'warn');
    return;
  }

  try {
    toast('Creating backup...');
    const zip = new JSZip();
    const library = getLibrary();

    // Add all files
    library.forEach(file => {
      const safeName = file.name.replace(/[/\\?%*:|"<>]/g, '-');
      zip.file(safeName, file.md || '');
    });

    // Add metadata
    zip.file('_backup-info.json', JSON.stringify({
      created: new Date().toISOString(),
      app: 'Inkdown',
      fileCount: library.length
    }, null, 2));

    const blob = await zip.generateAsync({ type: 'blob' });
    const filename = 'inkdown-backup-' + new Date().toISOString().split('T')[0] + '.zip';

    const api = window.pywebview && window.pywebview.api;
    if (api && typeof api.save_binary_file === 'function') {
      const base64 = await blobToBase64(blob);
      const result = await api.save_binary_file(filename, base64);
      if (result) {
        toast('Backup saved: ' + result.split(/[/\\]/).pop());
      }
    } else {
      await download(blob, filename);
    }

  } catch (err) {
    console.error('[Export] Backup failed:', err);
    toast('Backup failed', 'warn');
  }
}

/** Convert Blob to base64 string */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Download/save a file. Uses PyWebView API in desktop mode,
 * falls back to browser download in web mode.
 */
async function download(blob, name) {
  const api = window.pywebview && window.pywebview.api;

  if (api && typeof api.save_file === 'function') {
    // Desktop mode: use PyWebView save dialog
    try {
      const text = await blob.text();
      const result = await api.save_file(name, text);

      if (result) {
        toast('Saved to: ' + result.split(/[/\\]/).pop());
        return true;
      } else {
        // User cancelled the save dialog
        return false;
      }
    } catch (e) {
      console.error('[Export] PyWebView save failed:', e);
      toast('Export failed', 'warn');
      return false;
    }
  } else {
    // Browser mode: use standard download
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Downloaded ' + name);
      return true;
    } catch (e) {
      console.error('[Export] Browser download failed:', e);
      toast('Export failed', 'warn');
      return false;
    }
  }
}
function exportHTML() {
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(state.name) + '</title>' +
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"><style>' +
    'body{font:17px/1.75 "Source Serif 4",Georgia,serif;max-width:820px;margin:48px auto;padding:0 26px;color:#0a0a0a}' +
    'h1,h2,h3,h4{font-family:"Bricolage Grotesque",sans-serif;letter-spacing:-.02em;line-height:1.25}' +
    'h1{border-bottom:1px solid #d4d4d4;padding-bottom:.4em}h2{border-bottom:1px solid #e9e9e9;padding-bottom:.3em;margin-top:2em}' +
    'pre{background:#0a0a0a!important;color:#e8e8e8;padding:18px 20px;overflow-x:auto;border-radius:12px}code{font-family:"JetBrains Mono",monospace;font-size:13.5px}' +
    ':not(pre)>code{background:#f4f4f4;border:1px solid #e9e9e9;padding:2px 7px;border-radius:6px;font-size:.85em;color:#d1005f}' +
    'table{border-collapse:collapse;width:100%}th{background:#f5f5f5;text-align:left;padding:10px 16px;border:1px solid #d4d4d4}td{padding:10px 16px;border:1px solid #e9e9e9}' +
    'blockquote{border-left:4px solid #ff2e88;background:rgba(255,46,136,.07);padding:12px 20px;color:#3f3f3f;font-style:italic}' +
    'img{max-width:100%;border-radius:12px}a{color:#d1005f}' +
    '</style></head><body>' + state.docEl.innerHTML + '</body></html>';
}

/* ================= KEYBOARD ================= */
export function setupKeyboard() {
  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    const inReader = document.body.dataset.view === 'reader';
    const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;

    if (mod && e.key.toLowerCase() === 's' && inReader) { e.preventDefault(); saveDoc(true); }
    else if (mod && e.key.toLowerCase() === 'e' && inReader) { e.preventDefault(); setEditing(!state.editing); }
    else if (mod && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      if (inReader) state._showOverlay?.(false);
      else $('#libFileInput').click();   // upload from library
    }
    else if (mod && e.key === '\\' && inReader) {
      e.preventDefault();
      document.body.classList.toggle('toc-open');
      state._syncTocBtn?.();
    }
    else if (mod && e.key.toLowerCase() === 'k' && inReader) {
      e.preventDefault();
      if (state.editing) { $('#frBar').classList.add('open'); $('#frFind').focus(); }
      else openSearch();
    }
    else if (mod && e.key.toLowerCase() === 'b' && state.editing && document.activeElement === state.editorEl) {
      e.preventDefault(); ED_ACTS.bold();
    }
    else if (mod && e.key.toLowerCase() === 'i' && state.editing && document.activeElement === state.editorEl) {
      e.preventDefault(); ED_ACTS.italic();
    }
    else if (mod && e.key === '`' && state.editing && document.activeElement === state.editorEl) {
      e.preventDefault(); ED_ACTS.code();
    }
    else if (mod && e.key === '[' && inReader) {
      e.preventDefault();
      if (state.lastJump !== null) state.scrollArea.scrollTo({ top: state.lastJump, behavior: 'smooth' });
    }
    else if ((e.key === 'f' || e.key === 'F') && !mod && !typing && inReader) {
      e.preventDefault();
      setFocus(!document.body.classList.contains('focus'));
    }
    else if (e.key === 'Escape') {
      if ($('#imgView').classList.contains('open')) $('#imgView').classList.remove('open');
      else if (document.body.classList.contains('focus')) setFocus(false);
      else if ($('#searchBar').classList.contains('open')) closeSearch();
      else { state._hideOverlay?.(); $$('.menu, .pop').forEach(m => m.classList.remove('open')); }
    }
  });
}

export { updateReadProgress };