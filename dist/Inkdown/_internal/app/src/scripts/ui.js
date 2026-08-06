import { state, $, $$, esc, STORAGE_KEYS, debounce } from './state.js';
import { buildHTML, runMermaid, runMath } from './markdown.js';
import { decorate } from './decorate.js';
import { buildTOC } from './toc.js';
import { measureNav, updateReadProgress, updateMMThumb } from './navigation.js';
import { applyHighlights } from './highlight.js';
import { updateStats, lintDebounced, pushVersion } from './quality.js';
import { upsertFile, createFile, getLibrary, saveLibrary, uniqueName } from './storage.js';
import { ED_ACTS } from './editor.js';
import { openSearch, closeSearch } from './search.js';
import { SAMPLE } from './samples.js';

const ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

export function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = (type === 'ok' ? ICON_OK : '⚠️ ') + esc(msg);
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2300);
}

/* ================= RENDER ================= */
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
<<<<<<< HEAD:src/scripts/ui.js
  if (animate) { void target.offsetWidth; target.classList.add('anim'); }
=======
  if (animate) {
    void target.offsetWidth;
    target.classList.add('anim');
  }
  document.dispatchEvent(new CustomEvent('doc:rendered'));
>>>>>>> newfeatures:dist/Inkdown/_internal/app/src/scripts/ui.js
}
const renderPreviewDebounced = debounce(() => renderView(false), 280);

/* ================= OPEN / BACK ================= */
export function openFile(rec, opts = {}) {
  state.fileId = rec.id;
  document.body.classList.remove('focus');
  document.body.dataset.view = 'reader';
  loadDoc(rec.md, rec.name, true, rec);
  if (opts.edit) setEditing(true);
}
export function backToLibrary() {
  if (state.dirty) saveDoc(false);
  if (state.editing) setEditing(false);
  document.body.dataset.view = 'library';
  document.title = 'Inkdown — Library';
  document.dispatchEvent(new CustomEvent('library:shown'));
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
    const rec = createFile(state.name, state.md);
    state.fileId = rec.id;
  }
  const ok = upsertFile({
    id: state.fileId, name: state.name, md: state.md, updatedAt: Date.now(),
    scroll: state.scroll, highlights: state.highlights, goal: state.goal
  });
  if (ok) {
    state.dirty = false;
    setSaved('Saved · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const b = $('#btnSave');
    b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
    if (announce) toast('Saved to library');
  } else toast('Could not save (storage full?)', 'warn');
}
function setSaved(txt) { $('#saveDot').classList.remove('dirty'); $('#saveTxt').textContent = txt; }

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

/* ================= INIT ================= */
export function initUI() {
  bindStaticButtons();
  initMenus();
  initOverlay();
  initRename();
  initReading();
  initSaveExport();
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
  const showOverlay = drag => { overlay.classList.add('open'); overlay.classList.toggle('dragging', !!drag); };
  const hideOverlay = () => { overlay.classList.remove('open', 'dragging'); dragDepth = 0; };
  $('#btnOpen').onclick = () => showOverlay(false);
  $('#closeOverlay').onclick = hideOverlay;
  overlay.addEventListener('click', e => { if (e.target === overlay) hideOverlay(); });
  $('#btnBrowse').onclick = () => fileInput.click();
  fileInput.onchange = () => { if (fileInput.files[0]) readFile(fileInput.files[0]); fileInput.value = ''; };
  $('#btnSample').onclick = () => {
    const name = uniqueName('sample-readme.md', getLibrary());
    const rec = createFile(name, SAMPLE);
    hideOverlay(); openFile(rec);
    toast('Sample added to library');
  };
  $('#btnPaste').onclick = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim()) {
        const name = uniqueName('pasted.md', getLibrary());
        const rec = createFile(name, t);
        hideOverlay(); openFile(rec);
        toast('Pasted into library');
        return;
      }
    } catch (e) {}
    const name = uniqueName('untitled.md', getLibrary());
    const rec = createFile(name, '');
    hideOverlay(); openFile(rec, { edit: true });
    toast('Paste your Markdown (Ctrl+V)');
  };
  function readFile(f) {
    if (!/\.(md|markdown|mdown|txt)$/i.test(f.name)) { toast('Not a Markdown file', 'warn'); return; }
    const r = new FileReader();
    r.onload = () => {
      const name = uniqueName(f.name, getLibrary());
      const rec = createFile(name, r.result);
      hideOverlay(); openFile(rec);
      toast('Imported ' + f.name);
    };
    r.readAsText(f);
  }
  window.addEventListener('dragenter', e => { if (!inReader()) return; e.preventDefault(); dragMode = true; dragDepth++; showOverlay(true); });
  window.addEventListener('dragover', e => { if (inReader()) e.preventDefault(); });
  window.addEventListener('dragleave', e => { if (!inReader()) return; e.preventDefault(); if (dragMode && --dragDepth <= 0) overlay.classList.remove('dragging'); });
  window.addEventListener('drop', e => {
    if (!inReader()) return;
    e.preventDefault(); dragMode = false;
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (f) readFile(f);
    else {
      const t = e.dataTransfer.getData('text');
      if (t.trim()) { const rec = createFile(uniqueName('pasted.md', getLibrary()), t); openFile(rec); }
    }
    hideOverlay();
  });
  state._showOverlay = showOverlay;
  state._hideOverlay = hideOverlay;
}
function initRename() {
  const titleEl = $('#docTitle');
  titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); } });
  titleEl.addEventListener('blur', () => {
    const t = titleEl.textContent.replace(/\n/g, '').trim();
    titleEl.textContent = t;
    if (t && t !== state.name) {
      state.name = t; $('#stName').textContent = t;
      document.title = t + ' — Inkdown';
      markDirty();
    }
  });
}
function initReading() {
  let readCfg = Object.assign(
    { font: 'serif', size: 17, width: 860, lineNumbers: false },
    JSON.parse(localStorage.getItem(STORAGE_KEYS.READ) || '{}')
  );
  function applyRead() {
    document.body.dataset.font = readCfg.font;
    document.documentElement.style.setProperty('--docfs', readCfg.size + 'px');
    document.documentElement.style.setProperty('--pagew', readCfg.width + 'px');
    $$('.fontBtn').forEach(b => b.classList.toggle('on', b.dataset.f === readCfg.font));
    $('#fsVal').textContent = readCfg.size + 'px';
    $('#pwRange').value = readCfg.width;
    state.showLineNumbers = readCfg.lineNumbers === true;
    try { localStorage.setItem(STORAGE_KEYS.READ, JSON.stringify(readCfg)); } catch (e) {}
  }
  $$('.fontBtn').forEach(b => b.onclick = () => { readCfg.font = b.dataset.f; applyRead(); });
  $('#fsDown').onclick = () => { readCfg.size = Math.max(13, readCfg.size - 1); applyRead(); };
  $('#fsUp').onclick = () => { readCfg.size = Math.max(13, Math.min(24, readCfg.size + 1)); applyRead(); };
  $('#pwRange').addEventListener('input', e => { readCfg.width = +e.target.value; applyRead(); });
  const ln = $('#lnToggle');
  if (ln) {
    ln.checked = readCfg.lineNumbers === true;
    ln.onchange = e => { readCfg.lineNumbers = e.target.checked; applyRead(); renderView(false); };
  }
  applyRead();
}

/* ================= EXPORT THEMES ================= */
const EXPORT_CSS = {
  minimal: 'body{font:17px/1.75 "Source Serif 4",Georgia,serif;max-width:820px;margin:48px auto;padding:0 26px;color:#0a0a0a}h1,h2,h3,h4{font-family:"Bricolage Grotesque",sans-serif;letter-spacing:-.02em;line-height:1.25}h1{border-bottom:1px solid #d4d4d4;padding-bottom:.4em}h2{border-bottom:1px solid #e9e9e9;padding-bottom:.3em;margin-top:2em}pre{background:#0a0a0a!important;color:#e8e8e8;padding:18px 20px;overflow-x:auto;border-radius:12px}code{font-family:"JetBrains Mono",monospace;font-size:13.5px}:not(pre)>code{background:#f4f4f4;border:1px solid #e9e9e9;padding:2px 7px;border-radius:6px;font-size:.85em;color:#d1005f}table{border-collapse:collapse;width:100%}th{background:#f5f5f5;text-align:left;padding:10px 16px;border:1px solid #d4d4d4}td{padding:10px 16px;border:1px solid #e9e9e9}blockquote{border-left:4px solid #ff2e88;background:rgba(255,46,136,.07);padding:12px 20px;color:#3f3f3f;font-style:italic}img{max-width:100%;border-radius:12px}a{color:#d1005f}',
  classic: 'body{font:18px/1.8 Georgia,"Times New Roman",serif;max-width:760px;margin:56px auto;padding:0 26px;color:#1a1a1a}h1,h2,h3,h4{font-family:Georgia,serif;line-height:1.25}h1{text-align:center;font-size:2.2em;margin-bottom:.2em}h2{border-bottom:2px solid #1a1a1a;padding-bottom:.2em;margin-top:2em}pre{background:#f6f6f6;border:1px solid #ddd;padding:16px;overflow-x:auto;border-radius:6px}code{font-family:"Courier New",monospace;font-size:.95em}:not(pre)>code{background:#f2f2f2;padding:2px 5px;border-radius:4px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:9px 14px}th{background:#eee}blockquote{border-left:4px solid #1a1a1a;margin:1.4em 0;padding:8px 20px;color:#444;font-style:italic}img{max-width:100%}a{color:#0645ad}',
  github: 'body{font:16px/1.6 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 32px;color:#1f2328}h1,h2,h3,h4{font-weight:600;line-height:1.25;margin-top:24px;margin-bottom:16px}h1{font-size:2em;border-bottom:1px solid #d1d9e0;padding-bottom:.3em}h2{font-size:1.5em;border-bottom:1px solid #d1d9e0;padding-bottom:.3em}pre{background:#f6f8fa;border:1px solid #d1d9e0;padding:16px;overflow-x:auto;border-radius:6px}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:85%}:not(pre)>code{background:rgba(175,184,193,.2);padding:.2em .4em;border-radius:6px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d1d9e0;padding:6px 13px}th{background:#f6f8fa;font-weight:600}blockquote{border-left:4px solid #d1d9e0;margin:0 0 16px;padding:0 1em;color:#59636e}img{max-width:100%}a{color:#0969da;text-decoration:none}a:hover{text-decoration:underline}'
};

/* ================= EXPORT HANDLERS ================= */
function initSaveExport() {
  $('#btnSave').onclick = () => saveDoc(true);
  const menu = $('#exportMenu');
  menu.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    menu.classList.remove('open');
    const base = state.name.replace(/\.(md|markdown|mdown|txt)$/i, '');
    const act = b.dataset.act;
    if (act === 'md') { download(new Blob([state.md], { type: 'text/markdown' }), state.name.endsWith('.md') ? state.name : base + '.md'); toast('Downloaded ' + state.name); }
    else if (act === 'html') { download(new Blob([exportHTML()], { type: 'text/html' }), base + '.html'); toast('HTML exported'); }
    else if (act === 'pdf') { exportPDF(); }
    else if (act === 'png') { await exportPNG(); }
    else if (act === 'copy') { try { await navigator.clipboard.writeText(state.md); toast('Markdown copied'); } catch (err) { toast('Copy failed', 'warn'); } }
    else if (act === 'rich') { await copyRich(); }
    else if (act === 'share') { copyShareLink(); }
    else if (act === 'backup') { await backupZip(); }
    else if (act === 'synccopy') { syncCopy(); }
    else if (act === 'syncimport') { syncImport(); }
    else if (act === 'print') { window.print(); }
  });
}

function exportHTML() {
  const theme = (document.querySelector('input[name="expTheme"]:checked') || {}).value || 'minimal';
  const css = EXPORT_CSS[theme] || EXPORT_CSS.minimal;
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(state.name) + '</title>' +
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">' +
    '<style>' + css + '</style></head><body>' + state.docEl.innerHTML + '</body></html>';
}
function exportPDF() {
  toast('Opening print dialog — choose “Save as PDF”');
  setTimeout(() => window.print(), 350);
}
async function exportPNG() {
  if (!window.html2canvas) { toast('Image export library not loaded', 'warn'); return; }
  toast('Rendering image…');
  try {
    const bg = getComputedStyle(document.body).backgroundColor || '#ffffff';
    const canvas = await html2canvas(state.docEl, { scale: 2, backgroundColor: bg, useCORS: true });
    canvas.toBlob(b => {
      if (b) download(b, state.name.replace(/\.\w+$/, '') + '.png');
      toast('Image exported');
    }, 'image/png');
  } catch (e) {
    toast('Image export failed — try Save as PDF', 'warn');
  }
}
async function copyRich() {
  const html = state.docEl.innerHTML;
  const text = state.docEl.innerText;
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      });
      await navigator.clipboard.write([item]);
      toast('Rendered content copied — paste into email/Docs');
    } else {
      await navigator.clipboard.writeText(text);
      toast('Copied as plain text');
    }
  } catch (e) { toast('Copy failed', 'warn'); }
}
function buildShareLink() {
  try {
    const b64 = btoa(unescape(encodeURIComponent(state.md)));
    if (b64.length > 60000) { toast('Document too large for a share link', 'warn'); return null; }
    return location.href.split('#')[0] + '#doc=' + b64;
  } catch (e) { return null; }
}
function copyShareLink() {
  const url = buildShareLink();
  if (!url) return;
  navigator.clipboard.writeText(url)
    .then(() => toast('Share link copied — it contains the whole doc'))
    .catch(() => toast('Could not copy link', 'warn'));
}
async function backupZip() {
  if (!window.JSZip) { toast('Backup library not loaded', 'warn'); return; }
  const zip = new JSZip();
  const lib = getLibrary();
  lib.forEach(f => zip.file((f.name || 'untitled').replace(/[\\/:*?"<>|]/g, '_'), f.md || ''));
  zip.file('inkdown-library.json', JSON.stringify(lib, null, 2));
  const todos = localStorage.getItem('inkdown:todos');
  if (todos) zip.file('inkdown-todos.json', todos);
  const blob = await zip.generateAsync({ type: 'blob' });
  download(blob, 'inkdown-backup.zip');
  toast('Backup downloaded');
}
function syncCopy() {
  try {
    const payload = { v: 1, lib: getLibrary(), todos: JSON.parse(localStorage.getItem('inkdown:todos') || 'null') };
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    navigator.clipboard.writeText(code)
      .then(() => toast('Sync code copied — paste it on another device'))
      .catch(() => toast('Could not copy', 'warn'));
  } catch (e) { toast('Sync failed', 'warn'); }
}
function syncImport() {
  const code = prompt('Paste a sync code:');
  if (!code) return;
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const data = JSON.parse(json);
    if (Array.isArray(data.lib)) saveLibrary(data.lib);
    if (data.todos) localStorage.setItem('inkdown:todos', JSON.stringify(data.todos));
    toast('Imported — reloading…');
    setTimeout(() => location.reload(), 600);
  } catch (e) { toast('Invalid sync code', 'warn'); }
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
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
      else $('#libFileInput').click();
    }
    else if (mod && e.key === '\\' && inReader) { e.preventDefault(); document.body.classList.toggle('toc-open'); state._syncTocBtn?.(); }
    else if (mod && e.key.toLowerCase() === 'k' && inReader) {
      e.preventDefault();
      if (state.editing) { $('#frBar').classList.add('open'); $('#frFind').focus(); }
      else openSearch();
    }
    else if (mod && e.key.toLowerCase() === 'b' && state.editing && document.activeElement === state.editorEl) { e.preventDefault(); ED_ACTS.bold(); }
    else if (mod && e.key.toLowerCase() === 'i' && state.editing && document.activeElement === state.editorEl) { e.preventDefault(); ED_ACTS.italic(); }
    else if (mod && e.key === '`' && state.editing && document.activeElement === state.editorEl) { e.preventDefault(); ED_ACTS.code(); }
    else if (mod && e.key === '[' && inReader) { e.preventDefault(); if (state.lastJump !== null) state.scrollArea.scrollTo({ top: state.lastJump, behavior: 'smooth' }); }
    else if ((e.key === 'f' || e.key === 'F') && !mod && !typing && inReader) { e.preventDefault(); setFocus(!document.body.classList.contains('focus')); }
    else if (e.key === 'Escape') {
      if ($('#imgView').classList.contains('open')) $('#imgView').classList.remove('open');
      else if (document.body.classList.contains('focus')) setFocus(false);
      else if ($('#searchBar').classList.contains('open')) closeSearch();
      else { state._hideOverlay?.(); $$('.menu, .pop').forEach(m => m.classList.remove('open')); }
    }
  });
}
export { updateReadProgress };