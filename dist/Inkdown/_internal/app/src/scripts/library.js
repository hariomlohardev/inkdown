// Library home screen — grid of saved files, upload, delete, rename
import { state, $, esc } from './state.js';
import { getLibrary, deleteFile, createFile, upsertFile, uniqueName } from './storage.js';
import { openFile, toast } from './ui.js';
import { SAMPLE } from './samples.js';

const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

let query = '';

export function initLibrary() {
  $('#libNew').onclick = onNew;
  $('#libEmptyNew').onclick = onNew;
  $('#libUpload').onclick = () => $('#libFileInput').click();
  $('#libSample').onclick = onSample;
  $('#libFileInput').onchange = e => {
    importFiles(e.target.files);
    e.target.value = '';
  };
  $('#libSearch').addEventListener('input', e => {
    query = e.target.value.trim().toLowerCase();
    renderLibrary();
  });
  // Reader dispatches this when going back home
  document.addEventListener('library:shown', renderLibrary);
  bindDrop();
}

export function showLibrary() {
  document.body.dataset.view = 'library';
  document.title = 'Inkdown — Library';
  renderLibrary();
}

export function renderLibrary() {
  const files = getLibrary();
  const grid = $('#libGrid');
  grid.innerHTML = '';

  const filtered = query
    ? files.filter(f => f.name.toLowerCase().includes(query) || f.md.toLowerCase().includes(query))
    : files;

  // Stats line
  const kb = Math.max(1, Math.round(JSON.stringify(files).length / 1024));
  $('#libStats').textContent = files.length
    ? files.length + ' file' + (files.length > 1 ? 's' : '') + ' · ' + kb + ' KB'
    : '';

  // Empty vs no-match states
  $('#libEmpty').hidden = files.length > 0;
  $('#libNoMatch').hidden = !(files.length > 0 && filtered.length === 0);
  if (files.length > 0 && filtered.length === 0) {
    $('#libNoMatchQ').textContent = query;
  }

  filtered.forEach((f, i) => {
    const words = (f.md.trim().match(/\S+/g) || []).length;
    const card = document.createElement('article');
    card.className = 'fileCard';
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.style.animationDelay = Math.min(i * 0.04, 0.5) + 's';
    card.innerHTML =
      '<div class="fcTop">' +
        '<span class="fcIcon">M<b>↓</b></span>' +
        '<button class="fcDel" title="Delete file" aria-label="Delete ' + esc(f.name) + '">' + TRASH + '</button>' +
      '</div>' +
      '<h3 class="fcName" title="Double-click to rename">' + esc(f.name) + '</h3>' +
      '<p class="fcMeta"><b>' + words.toLocaleString() + ' words</b><span>·</span>' + relTime(f.updatedAt || f.createdAt) + '</p>';

    // Open on click / Enter
    const open = () => openFile(f);
    card.addEventListener('click', e => {
      if (e.target.closest('.fcDel') || e.target.closest('.fcName[contenteditable="true"]')) return;
      open();
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.target.closest('.fcName[contenteditable="true"]')) open();
    });

    // Delete (two-step confirm)
    const del = card.querySelector('.fcDel');
    del.addEventListener('click', e => {
      e.stopPropagation();
      if (del.dataset.armed) {
        deleteFile(f.id);
        renderLibrary();
        toast('Deleted ' + f.name);
      } else {
        del.dataset.armed = '1';
        del.classList.add('armed');
        del.textContent = 'Sure?';
        setTimeout(() => {
          if (!del.isConnected) return;
          delete del.dataset.armed;
          del.classList.remove('armed');
          del.innerHTML = TRASH;
        }, 2600);
      }
    });

    // Rename on double-click
    const nameEl = card.querySelector('.fcName');
    nameEl.addEventListener('dblclick', e => {
      e.stopPropagation();
      nameEl.contentEditable = 'true';
      nameEl.focus();
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    nameEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
      if (e.key === 'Escape') { nameEl.textContent = f.name; nameEl.blur(); }
    });
    nameEl.addEventListener('blur', () => {
      nameEl.contentEditable = 'false';
      const newName = nameEl.textContent.trim();
      if (newName && newName !== f.name) {
        upsertFile({ id: f.id, name: newName, updatedAt: Date.now() });
        toast('Renamed to ' + newName);
      }
      renderLibrary();
    });

    grid.appendChild(card);
  });
}

/* ---- actions ---- */
function onNew() {
  const name = uniqueName('untitled.md', getLibrary());
  const rec = createFile(name, '');
  openFile(rec, { edit: true });
  toast('Created ' + name);
}

function onSample() {
  const name = uniqueName('sample-readme.md', getLibrary());
  const rec = createFile(name, SAMPLE);
  openFile(rec);
  toast('Sample loaded');
}

export async function importFiles(fileList) {
  let count = 0;
  for (const f of fileList) {
    if (!/\.(md|markdown|mdown|txt)$/i.test(f.name)) continue;
    try {
      const text = await f.text();
      const name = uniqueName(f.name, getLibrary());
      createFile(name, text);
      count++;
    } catch (e) {}
  }
  renderLibrary();
  if (count) toast('Imported ' + count + ' file' + (count > 1 ? 's' : ''));
  else toast('No markdown files found', 'warn');
}

/* ---- drag & drop import ---- */
function bindDrop() {
  const lib = $('#library');
  let depth = 0;
  lib.addEventListener('dragenter', e => {
    e.preventDefault();
    depth++;
    lib.classList.add('dragging');
  });
  lib.addEventListener('dragover', e => e.preventDefault());
  lib.addEventListener('dragleave', e => {
    e.preventDefault();
    if (--depth <= 0) lib.classList.remove('dragging');
  });
  lib.addEventListener('drop', e => {
    e.preventDefault();
    depth = 0;
    lib.classList.remove('dragging');
    if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
  });
}

/* ---- helpers ---- */
function relTime(ts) {
  if (!ts) return '';
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const days = Math.floor(h / 24);
  if (days < 7) return days + 'd ago';
  return new Date(ts).toLocaleDateString();
}