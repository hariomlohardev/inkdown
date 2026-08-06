import { state, $, $$, esc } from './state.js';
import {
  getLibrary, saveLibrary, createFile, uniqueName,
  getFolders, createFolder, renameFolder, deleteFolder, setFileFolder
} from './storage.js';
import { openFile, toast } from './ui.js';
import { SAMPLE } from './samples.js';

let currentFolder = '';   // '' = root
let searchQuery = '';

/* ---------- helpers ---------- */
const fileFolder = f => f.folder || '';
const filesIn = folder => getLibrary().filter(f => fileFolder(f) === folder);

function readEntry(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsText(file);
  });
}
function toRawGithub(url) {
  const m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (m) return 'https://raw.githubusercontent.com/' + m[1] + '/' + m[2] + '/' + m[3];
  return url;
}
async function fetchUrlText(url) {
  const api = window.pywebview && window.pywebview.api;
  if (api && api.fetch_url) { const t = await api.fetch_url(url); if (t) return t; }
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
function iconBtn(symbol, title) {
  const b = document.createElement('button');
  b.className = 'fcIconBtn';
  b.textContent = symbol;
  b.title = title;
  return b;
}

/* ---------- cards ---------- */
function fileCard(f, showFolderBadge) {
  const el = document.createElement('div');
  el.className = 'fileCard';
  el.setAttribute('role', 'listitem');
  el.title = f.name;
  el.draggable = true;

  const words = ((f.md || '').trim().match(/\S+/g) || []).length;

  const top = document.createElement('div'); top.className = 'fcTop';
  const ico = document.createElement('div'); ico.className = 'fcIcon'; ico.textContent = 'M↓';
  const actions = document.createElement('div'); actions.className = 'fcActions';
  const mov = iconBtn('🗂', 'Move to folder');
  mov.onclick = e => { e.stopPropagation(); showMoveMenu(f, el); };
  const del = iconBtn('🗑', 'Delete');
  del.onclick = e => { e.stopPropagation(); doDeleteFile(f, del); };
  actions.append(mov, del);
  top.append(ico, actions);

  const nm = document.createElement('div'); nm.className = 'fcName'; nm.textContent = f.name;
  const meta = document.createElement('div'); meta.className = 'fcMeta';
  meta.textContent = words + ' words' + (showFolderBadge && f.folder ? ' · in ' + f.folder : '');

  el.append(top, nm, meta);
  el.onclick = () => openFile(f);

  el.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', f.id);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => el.classList.remove('dragging'));
  return el;
}

function folderCard(name) {
  const count = filesIn(name).length;
  const el = document.createElement('div');
  el.className = 'fileCard folderCard';
  el.setAttribute('role', 'listitem');
  el.title = name;

  const top = document.createElement('div'); top.className = 'fcTop';
  const ico = document.createElement('div'); ico.className = 'fcIcon folder'; ico.textContent = '📁';
  const actions = document.createElement('div'); actions.className = 'fcActions';
  const ren = iconBtn('✎', 'Rename folder');
  ren.onclick = e => { e.stopPropagation(); doRenameFolder(name); };
  const del = iconBtn('🗑', 'Delete folder');
  del.onclick = e => { e.stopPropagation(); doDeleteFolder(name); };
  actions.append(ren, del);
  top.append(ico, actions);

  const nm = document.createElement('div'); nm.className = 'fcName'; nm.textContent = name;
  const meta = document.createElement('div'); meta.className = 'fcMeta';
  meta.textContent = count + ' file' + (count === 1 ? '' : 's');

  el.append(top, nm, meta);
  el.onclick = () => { currentFolder = name; renderLibrary(); };
  nm.ondblclick = e => { e.stopPropagation(); doRenameFolder(name); };

  el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('dragover'); });
  el.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el.addEventListener('drop', e => {
    e.preventDefault(); el.classList.remove('dragover');
    const fileId = e.dataTransfer.getData('text/plain');
    if (fileId) { setFileFolder(fileId, name); renderLibrary(); toast('Moved to “' + name + '”'); }
  });
  return el;
}

function upCard() {
  const el = document.createElement('div');
  el.className = 'fileCard upCard';
  el.title = 'Back to Library — or drop a file here to move it out';
  el.innerHTML =
    '<div class="fcTop"><div class="fcIcon folder">↩</div></div>' +
    '<div class="fcName">..</div>' +
    '<div class="fcMeta">Back to Library · drop a file to move it out</div>';
  el.onclick = () => { currentFolder = ''; renderLibrary(); };
  el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('dragover'); });
  el.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el.addEventListener('drop', e => {
    e.preventDefault(); el.classList.remove('dragover');
    const fileId = e.dataTransfer.getData('text/plain');
    if (fileId) { setFileFolder(fileId, ''); renderLibrary(); toast('Moved to Library'); }
  });
  return el;
}

/* ---------- breadcrumb ---------- */
function renderCrumbs() {
  const bar = $('#libCrumbs');
  if (!bar) return;
  bar.innerHTML = '';
  const root = document.createElement('button');
  root.className = 'crumb' + (currentFolder === '' ? ' here' : '');
  root.textContent = '🗂 Library';
  root.onclick = () => { currentFolder = ''; renderLibrary(); };
  makeDropToRoot(root);
  bar.appendChild(root);
  if (currentFolder !== '') {
    const sep = document.createElement('span'); sep.className = 'crumbSep'; sep.textContent = '▸';
    const cur = document.createElement('span'); cur.className = 'crumb here'; cur.textContent = currentFolder;
    bar.append(sep, cur);
  }
}
function makeDropToRoot(el) {
  el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('dragover'); });
  el.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el.addEventListener('drop', e => {
    e.preventDefault(); el.classList.remove('dragover');
    const fileId = e.dataTransfer.getData('text/plain');
    if (fileId) { setFileFolder(fileId, ''); renderLibrary(); toast('Moved to Library'); }
  });
}

/* ---------- render ---------- */
export function renderLibrary() {
  const grid = $('#libGrid');
  if (!grid) return;
  grid.innerHTML = '';
  renderCrumbs();

  const q = searchQuery.trim().toLowerCase();
  if (q) {
    const all = getLibrary().filter(f =>
      (f.name || '').toLowerCase().includes(q) || (f.md || '').toLowerCase().includes(q));
    $('#libNoMatch').hidden = all.length > 0;
    if (!all.length) $('#libNoMatchQ').textContent = searchQuery;
    $('#libEmpty').hidden = true;
    all.forEach(f => grid.appendChild(fileCard(f, true)));
    updateStats();
    return;
  }

  $('#libNoMatch').hidden = true;
  if (currentFolder === '') {
    const folders = getFolders();
    folders.forEach(name => grid.appendChild(folderCard(name)));
    const files = filesIn('');
    files.forEach(f => grid.appendChild(fileCard(f, false)));
    $('#libEmpty').hidden = !(folders.length === 0 && files.length === 0);
  } else {
    grid.appendChild(upCard());
    filesIn(currentFolder).forEach(f => grid.appendChild(fileCard(f, false)));
    $('#libEmpty').hidden = true;
  }
  updateStats();
}

function updateStats() {
  const el = $('#libStats');
  if (!el) return;
  el.textContent = getLibrary().length + ' files · ' + getFolders().length + ' folders';
}

/* ---------- folder/file actions ---------- */
function doNewFolder() {
  const name = prompt('New folder name:');
  if (name == null) return;
  const t = name.trim();
  if (!t) return;
  if (getFolders().includes(t)) { toast('That folder already exists', 'warn'); return; }
  createFolder(t);
  renderLibrary();
  toast('Folder “' + t + '” created');
}
function doRenameFolder(name) {
  const nn = prompt('Rename folder:', name);
  if (nn == null) return;
  const t = nn.trim();
  if (!t || t === name) return;
  if (getFolders().includes(t)) { toast('A folder with that name already exists', 'warn'); return; }
  renameFolder(name, t);
  if (currentFolder === name) currentFolder = t;
  renderLibrary();
  toast('Folder renamed');
}
function doDeleteFolder(name) {
  if (!confirm('Delete folder “' + name + '”? Its files will move to Library (they are NOT deleted).')) return;
  deleteFolder(name);
  if (currentFolder === name) currentFolder = '';
  renderLibrary();
  toast('Folder deleted');
}
function doDeleteFile(f, btn) {
  if (btn && btn.dataset.armed) {
    saveLibrary(getLibrary().filter(x => x.id !== f.id));
    renderLibrary();
    toast('Deleted ' + f.name);
  } else if (btn) {
    btn.dataset.armed = '1';
    btn.textContent = '✕';
    btn.classList.add('armed');
    btn.title = 'Click again to confirm';
    setTimeout(() => {
      if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = '🗑'; btn.classList.remove('armed'); btn.title = 'Delete'; }
    }, 2500);
  }
}

/* ---------- move-to-folder popup ---------- */
function showMoveMenu(f, anchorEl) {
  closeMoveMenu();
  const menu = document.createElement('div');
  menu.className = 'moveMenu';
  menu.id = 'moveMenu';
  const add = (label, target) => {
    const it = document.createElement('button');
    it.className = 'moveItem' + (fileFolder(f) === target ? ' current' : '');
    it.textContent = label;
    it.onclick = e => {
      e.stopPropagation();
      setFileFolder(f.id, target);
      closeMoveMenu();
      renderLibrary();
      toast(target ? 'Moved to “' + target + '”' : 'Moved to Library');
    };
    menu.appendChild(it);
  };
  add('🗂 Library (root)', '');
  getFolders().forEach(name => add('📁 ' + name, name));
  const rect = anchorEl.getBoundingClientRect();
  menu.style.left = Math.min(rect.left, innerWidth - 230) + 'px';
  menu.style.top = Math.min(rect.bottom + 6, innerHeight - 200) + 'px';
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', closeMoveMenu, { once: true }), 0);
}
function closeMoveMenu() {
  const m = $('#moveMenu');
  if (m) m.remove();
}

/* ---------- init ---------- */
export function initLibrary() {
  const search = $('#libSearch');
  if (search) search.addEventListener('input', e => { searchQuery = e.target.value; renderLibrary(); });

  const libNew = $('#libNew');
  if (libNew) libNew.onclick = () => {
    const rec = createFile(uniqueName('untitled.md', getLibrary()), '', { folder: currentFolder });
    renderLibrary();
    openFile(rec, { edit: true });
  };

  const libNewFolder = $('#libNewFolder');
  if (libNewFolder) libNewFolder.onclick = doNewFolder;

  const libUpload = $('#libUpload'), libFileInput = $('#libFileInput');
  if (libUpload && libFileInput) {
    libUpload.onclick = () => libFileInput.click();
    libFileInput.addEventListener('change', async e => {
      const files = [...e.target.files];
      if (!files.length) return;
      let count = 0;
      for (const f of files) {
        createFile(uniqueName(f.name, getLibrary()), await readEntry(f), { folder: currentFolder });
        count++;
      }
      renderLibrary();
      toast('Imported ' + count + ' file' + (count > 1 ? 's' : ''));
      e.target.value = '';
    });
  }

  const libFolder = $('#libFolder'), folderInput = $('#folderInput');
  if (libFolder && folderInput) {
    libFolder.onclick = () => folderInput.click();
    folderInput.addEventListener('change', async e => {
      const files = [...e.target.files].filter(f => /\.(md|markdown|mdown|txt)$/i.test(f.name));
      if (!files.length) { toast('No markdown files in that folder', 'warn'); return; }
      let count = 0;
      for (const f of files) {
        createFile(uniqueName(f.name, getLibrary()), await readEntry(f), { folder: currentFolder });
        count++;
      }
      renderLibrary();
      toast('Imported ' + count + ' file' + (count > 1 ? 's' : ''));
      e.target.value = '';
    });
  }

  const libUrl = $('#libUrl');
  if (libUrl) libUrl.onclick = async () => {
    const input = prompt('Paste a raw Markdown URL (GitHub raw works best):');
    if (!input) return;
    const url = toRawGithub(input.trim());
    toast('Fetching…');
    try {
      const text = await fetchUrlText(url);
      if (!text) throw new Error('empty');
      const name = url.split('/').pop().split('?')[0] || 'imported.md';
      const rec = createFile(uniqueName(name, getLibrary()), text, { folder: currentFolder });
      renderLibrary();
      openFile(rec);
      toast('Imported ' + name);
    } catch (err) { toast('Could not fetch that URL', 'warn'); }
  };

  const libSample = $('#libSample');
  if (libSample) libSample.onclick = () => {
    const rec = createFile(uniqueName('sample-readme.md', getLibrary()), SAMPLE, { folder: currentFolder });
    renderLibrary();
    openFile(rec);
    toast('Sample loaded');
  };

  const libTodos = $('#libTodos');
  if (libTodos) libTodos.onclick = () => {
    document.body.dataset.view = 'todos';
    document.title = 'Inkdown — Todos';
    document.dispatchEvent(new CustomEvent('todos:shown'));
  };

  renderLibrary();
}

export function showLibrary() {
  document.body.dataset.view = 'library';
  document.title = 'Inkdown — Library';
  renderLibrary();
}