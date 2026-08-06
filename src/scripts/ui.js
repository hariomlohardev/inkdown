// UI orchestration: toasts, menus, overlay, file IO, render loop
// RULE: no DOM access at module top-level — everything inside init functions
import { state, $, $$, esc, STORAGE_KEYS, debounce } from './state.js';
import { buildHTML, runMermaid, runMath } from './markdown.js';
import { decorate } from './decorate.js';
import { buildTOC } from './toc.js';
import { measureNav, updateReadProgress, updateMMThumb } from './navigation.js';
import { applyHighlights } from './highlight.js';
import { updateStats, lintDebounced, pushVersion } from './quality.js';
import { ED_ACTS } from './editor.js';
import { openSearch, closeSearch } from './search.js';
import { SAMPLE } from './samples.js';

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
}

const renderPreviewDebounced = debounce(() => renderView(false), 280);

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
  try {
    localStorage.setItem(STORAGE_KEYS.DOC, JSON.stringify({
      md: state.md, name: state.name, at: Date.now(),
      highlights: state.highlights, goal: state.goal, scroll: state.scroll
    }));
    state.dirty = false;
    setSaved('Saved · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const b = $('#btnSave');
    b.classList.remove('flash');
    void b.offsetWidth;
    b.classList.add('flash');
    if (announce) toast('Saved to this browser');
  } catch (e) {
    toast('Could not save', 'warn');
  }
}

function setSaved(txt) {
  $('#saveDot').classList.remove('dirty');
  $('#saveTxt').textContent = txt;
}

export async function loadDoc(md, name, animate = true, rec) {
  state.md = md;
  state.name = name || 'untitled.md';
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
  if (state.scroll && !state.editing) state.scrollArea.scrollTop = state.scroll;
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

/* ================= INIT — all DOM binding happens here ================= */
export function initUI() {
  bindStaticButtons();
  initMenus();
  initOverlay();
  initRename();
  initReading();
  initSaveExport();
}

function bindStaticButtons() {
  $('#btnEdit').onclick = () => setEditing(!state.editing);
  $('#btnFocus').onclick = () => setFocus(!document.body.classList.contains('focus'));
  $('#focusExit').onclick = () => setFocus(false);

  // Editor input → update state, mark dirty, re-render preview
  state.editorEl.addEventListener('input', () => {
    state.md = state.editorEl.value;
    markDirty();
    renderPreviewDebounced();
  });
}

function initMenus() {
  const closeAllMenus = () => {
    $$('.menu, .pop').forEach(m => m.classList.remove('open'));
  };

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

  $('#btnSample').onclick = async () => {
    await loadDoc(SAMPLE, 'sample-readme.md');
    hideOverlay();
    toast('Sample loaded');
  };

  $('#btnPaste').onclick = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim()) {
        await loadDoc(t, 'pasted.md');
        hideOverlay();
        toast('Pasted from clipboard');
        return;
      }
    } catch (e) {}
    await loadDoc('', 'untitled.md');
    hideOverlay();
    setEditing(true);
    toast('Paste your Markdown (Ctrl+V)');
  };

  function readFile(f) {
    if (!/\.(md|markdown|mdown|txt)$/i.test(f.name)) {
      toast('Not a Markdown file', 'warn');
      return;
    }
    const r = new FileReader();
    r.onload = async () => {
      await loadDoc(r.result, f.name);
      hideOverlay();
      toast('Loaded ' + f.name);
    };
    r.readAsText(f);
  }

  window.addEventListener('dragenter', e => {
    e.preventDefault();
    dragMode = true;
    dragDepth++;
    showOverlay(true);
  });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('dragleave', e => {
    e.preventDefault();
    if (dragMode && --dragDepth <= 0) overlay.classList.remove('dragging');
  });
  window.addEventListener('drop', e => {
    e.preventDefault();
    dragMode = false;
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (f) readFile(f);
    else {
      const t = e.dataTransfer.getData('text');
      if (t.trim()) loadDoc(t, 'pasted.md');
    }
    hideOverlay();
  });

  // Expose for keyboard shortcuts
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
      download(new Blob([state.md], { type: 'text/markdown' }), state.name.endsWith('.md') ? state.name : base + '.md');
      toast('Downloaded ' + state.name);
    }
    if (b.dataset.act === 'copy') {
      try { await navigator.clipboard.writeText(state.md); toast('Markdown copied'); }
      catch (err) { toast('Copy failed', 'warn'); }
    }
    if (b.dataset.act === 'html') {
      download(new Blob([exportHTML()], { type: 'text/html' }), base + '.html');
      toast('HTML exported');
    }
    if (b.dataset.act === 'print') window.print();
  });
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function exportHTML() {
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(state.name) + '</title>' +
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"><style>' +
    'body{font:17px/1.75 "Source Serif 4",Georgia,serif;max-width:820px;margin:48px auto;padding:0 26px;color:#0a0a0a}' +
    'h1,h2,h3,h4{font-family:"Bricolage Grotesque",sans-serif;letter-spacing:-.02em;line-height:1.25}' +
    'h1{border-bottom:1px solid #d4d4d4;padding-bottom:.4em}h2{border-bottom:1px solid #e9e9e9;padding-bottom:.3em;margin-top:2em}' +
    '.codebox{border-radius:12px;overflow:hidden;border:1px solid #242424;margin:1.1em 0}.codehead{background:#121212;color:#8f8f8f;font:600 11px monospace;padding:8px 16px;letter-spacing:.2em;text-transform:uppercase}.ccopy{display:none}' +
    'pre{background:#0a0a0a!important;color:#e8e8e8;padding:18px 20px;overflow-x:auto;margin:0}code{font-family:"JetBrains Mono",monospace;font-size:13.5px}' +
    ':not(pre)>code{background:#f4f4f4;border:1px solid #e9e9e9;padding:2px 7px;border-radius:6px;font-size:.85em;color:#d1005f}' +
    '.tableWrap{overflow-x:auto;border:1px solid #e9e9e9;border-radius:12px}table{border-collapse:collapse;width:100%}' +
    'th{background:#f5f5f5;text-align:left;padding:10px 16px;border-bottom:2px solid #d4d4d4;font-family:sans-serif;font-size:.8em;text-transform:uppercase;letter-spacing:.08em}td{padding:10px 16px;border-bottom:1px solid #e9e9e9}' +
    'blockquote{border-left:4px solid #ff2e88;background:rgba(255,46,136,.07);border-radius:0 12px 12px 0;padding:12px 20px;color:#3f3f3f;font-style:italic}' +
    'img{max-width:100%;border-radius:12px}a{color:#d1005f}hr{border:none;height:2px;background:#d4d4d4;margin:2.4em 0}' +
    '.mermaid{text-align:center;padding:20px;border:1px solid #e9e9e9;border-radius:12px}details{border:1px solid #e9e9e9;border-radius:10px;padding:12px 16px}summary{cursor:pointer;font-weight:700}' +
    '.hl{background:rgba(255,46,136,.25)}' +
    '</style></head><body>' + state.docEl.innerHTML + '</body></html>';
}

/* ================= KEYBOARD ================= */
export function setupKeyboard() {
  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;

    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveDoc(true); }
    else if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); setEditing(!state.editing); }
    else if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); state._showOverlay?.(false); }
    else if (mod && e.key === '\\') {
      e.preventDefault();
      document.body.classList.toggle('toc-open');
      state._syncTocBtn?.();
    }
    else if (mod && e.key.toLowerCase() === 'k') {
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
    else if (mod && e.key === '[') {
      e.preventDefault();
      if (state.lastJump !== null) state.scrollArea.scrollTo({ top: state.lastJump, behavior: 'smooth' });
    }
    else if ((e.key === 'f' || e.key === 'F') && !mod && !typing) {
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