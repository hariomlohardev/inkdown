import { state, $, $$ } from './state.js';
import {
  getLibrary, saveLibrary, createFile, uniqueName,
  getFolders, createFolder, renameFolder, deleteFolder, setFileFolder
} from './storage.js';
import { openFile, toast } from './ui.js';
import { SAMPLE } from './samples.js';

let currentFolder = '';
let searchQuery = '';

/* ---------- helpers ---------- */
const fileFolder = f => f.folder || '';
const filesIn = folder => getLibrary().filter(f => fileFolder(f) === folder);
const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FOLDER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
const MOVE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><polyline points="12 10 12 16"/><polyline points="9 13 12 10 15 13"/></svg>';
const TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

function readEntry(file){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsText(file);
  });
}
function toRawGithub(url){
  const m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (m) return 'https://raw.githubusercontent.com/' + m[1] + '/' + m[2] + '/' + m[3];
  return url;
}
async function fetchUrlText(url){
  const api = window.pywebview && window.pywebview.api;
  if (api && api.fetch_url) { const t = await api.fetch_url(url); if (t) return t; }
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
function snippetOf(md){
  const lines = String(md || '').split('\n');
  for (let raw of lines){
    const l = raw.trim();
    if (!l) continue;
    if (/^```/.test(l)) continue;
    const cleaned = l
      .replace(/^#{1,6}\s+/, '')
      .replace(/^>\s?/, '')
      .replace(/^[-*+]\s+(?:\[[ xX]\]\s+)?/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_~`]/g, '')
      .trim();
    if (cleaned) return cleaned;
  }
  return 'Empty document';
}
function iconLetters(name){
  const base = String(name || 'MD').replace(/\.(md|markdown|mdown|txt)$/i, '');
  const parts = base.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase() || 'MD';
}
function relTime(ts){
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  if (d < 7) return d + 'd ago';
  return new Date(ts).toLocaleDateString();
}

/* ---------- sidebar ---------- */
function renderSidebar(){
  const navAll = $('#navAll');
  if (navAll) navAll.classList.toggle('active', currentFolder === '');
  const navTodos = $('#navTodos');
  if (navTodos) navTodos.classList.remove('active');
  const c = $('#navAllCount');
  if (c) c.textContent = getLibrary().length;

  const wrap = $('#sideFolders');
  if (!wrap) return;
  wrap.innerHTML = '';
  const folders = getFolders();
  if (!folders.length){
    const d = document.createElement('div');
    d.className = 'sideEmpty';
    d.textContent = 'No folders yet';
    wrap.appendChild(d);
    return;
  }
  folders.forEach(name => {
    const item = document.createElement('div');
    item.className = 'fItem' + (currentFolder === name ? ' active' : '');
    item.title = name;
    const count = filesIn(name).length;
    item.innerHTML = FOLDER_SVG + '<span></span><em class="count">' + count + '</em><span class="fActs"></span>';
    item.querySelector('span').textContent = name;
    const acts = item.querySelector('.fActs');
    const ren = document.createElement('button');
    ren.className = 'fib'; ren.title = 'Rename folder'; ren.textContent = '✎';
    ren.onclick = e => { e.stopPropagation(); doRenameFolder(name); };
    const del = document.createElement('button');
    del.className = 'fib'; del.title = 'Delete folder'; del.textContent = '🗑';
    del.onclick = e => { e.stopPropagation(); doDeleteFolder(name); };
    acts.append(ren, del);

    item.onclick = () => { currentFolder = name; searchQuery=''; const s=$('#libSearch'); if(s)s.value=''; renderLibrary(); };

    item.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect='move'; item.classList.add('dragover'); });
    item.addEventListener('dragleave', () => item.classList.remove('dragover'));
    item.addEventListener('drop', e => {
      e.preventDefault(); item.classList.remove('dragover');
      const id = e.dataTransfer.getData('text/plain');
      if (id) { setFileFolder(id, name); renderLibrary(); toast('Moved to “' + name + '”'); }
    });
    wrap.appendChild(item);
  });
}

/* ---------- header / greeting / stats ---------- */
function updateGreeting(){
  const t = $('#greetTitle');
  const s = $('#greetSub');
  if (!t) return;
  const q = searchQuery.trim();
  if (q){
    t.textContent = 'Search results';
    const n = getLibrary().filter(f => (f.name||'').toLowerCase().includes(q.toLowerCase()) || (f.md||'').toLowerCase().includes(q.toLowerCase())).length;
    if (s) s.textContent = n + ' match' + (n===1?'':'es') + ' for “' + q + '”';
    return;
  }
  if (currentFolder === ''){
    const h = new Date().getHours();
    const g = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    t.textContent = g + ' 👋';
    const files = getLibrary().length, folders = getFolders().length;
    if (s) s.textContent = files + ' file' + (files===1?'':'s') + ' · ' + folders + ' folder' + (folders===1?'':'s') + ' — ' + new Date().toLocaleDateString(undefined,{weekday:'long', month:'long', day:'numeric'});
  } else {
    t.textContent = currentFolder;
    const n = filesIn(currentFolder).length;
    if (s) s.textContent = n + ' file' + (n===1?'':'s') + ' in this folder';
  }
}
function renderStats(){
  const files = getLibrary();
  const folders = getFolders();
  const words = files.reduce((a,f)=>a+(((f.md||'').trim().match(/\S+/g)||[]).length),0);
  const last = files.reduce((a,f)=>Math.max(a, f.updatedAt||f.createdAt||0),0);
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('#statFiles', files.length);
  set('#statFolders', folders.length);
  set('#statWords', words >= 1000 ? (words/1000).toFixed(1)+'k' : String(words));
  set('#statRecent', last ? relTime(last) : '—');
}

/* ---------- cards ---------- */
function fileCard(f, showFolder){
  const el = document.createElement('div');
  el.className = 'card fileCard';
  el.setAttribute('role','listitem');
  el.title = f.name;
  el.draggable = true;
  const words = ((f.md||'').trim().match(/\S+/g)||[]).length;

  const top = document.createElement('div'); top.className='cardTop';
  const ico = document.createElement('div'); ico.className='fileIco'; ico.textContent = iconLetters(f.name);
  const acts = document.createElement('div'); acts.className='cardActs';
  const mv = document.createElement('button'); mv.className='cab'; mv.title='Move to folder'; mv.innerHTML = MOVE_SVG;
  mv.onclick = e => { e.stopPropagation(); showMoveMenu(f, el); };
  const dl = document.createElement('button'); dl.className='cab'; dl.title='Delete'; dl.innerHTML = TRASH_SVG;
  dl.onclick = e => { e.stopPropagation(); doDeleteFile(f, dl); };
  acts.append(mv, dl);
  top.append(ico, acts);

  const nm = document.createElement('div'); nm.className='cardName'; nm.textContent = f.name;
  const sn = document.createElement('div'); sn.className='cardSnippet'; sn.textContent = snippetOf(f.md);
  const meta = document.createElement('div'); meta.className='cardMeta';
  let metaHtml = '<span>'+words+' words</span>';
  if ((f.updatedAt||f.createdAt)) metaHtml += '<span class="dot"></span><span>'+relTime(f.updatedAt||f.createdAt)+'</span>';
  if (showFolder && f.folder) metaHtml += '<span class="dot"></span><span class="inFolder">📁 '+escHtml(f.folder)+'</span>';
  meta.innerHTML = metaHtml;

  el.append(top, nm, sn, meta);
  el.onclick = () => openFile(f);

  el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', f.id); e.dataTransfer.effectAllowed='move'; el.classList.add('dragging'); });
  el.addEventListener('dragend', () => el.classList.remove('dragging'));
  return el;
}
function folderCard(name){
  const el = document.createElement('div');
  el.className = 'card folderCard';
  el.setAttribute('role','listitem');
  el.title = name;
  const count = filesIn(name).length;

  const top = document.createElement('div'); top.className='cardTop';
  const ico = document.createElement('div'); ico.className='folderIco'; ico.innerHTML = FOLDER_SVG;
  const acts = document.createElement('div'); acts.className='cardActs';
  const rn = document.createElement('button'); rn.className='cab'; rn.title='Rename folder'; rn.textContent='✎';
  rn.onclick = e => { e.stopPropagation(); doRenameFolder(name); };
  const dl = document.createElement('button'); dl.className='cab'; dl.title='Delete folder'; dl.innerHTML = TRASH_SVG;
  dl.onclick = e => { e.stopPropagation(); doDeleteFolder(name); };
  acts.append(rn, dl);
  top.append(ico, acts);

  const nm = document.createElement('div'); nm.className='cardName'; nm.textContent = name;
  const meta = document.createElement('div'); meta.className='cardMeta';
  meta.innerHTML = '<span>'+count+' file'+(count===1?'':'s')+'</span>';

  el.append(top, nm, meta);
  el.onclick = () => { currentFolder = name; renderLibrary(); };
  nm.ondblclick = e => { e.stopPropagation(); doRenameFolder(name); };

  el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect='move'; el.classList.add('dragover'); });
  el.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el.addEventListener('drop', e => {
    e.preventDefault(); el.classList.remove('dragover');
    const id = e.dataTransfer.getData('text/plain');
    if (id) { setFileFolder(id, name); renderLibrary(); toast('Moved to “' + name + '”'); }
  });
  return el;
}
function upCard(){
  const el = document.createElement('div');
  el.className = 'card upCard';
  el.title = 'Back to All files — drop a file here to move it out';
  el.innerHTML =
    '<div class="cardTop"><div class="fileIco upIco">↩</div></div>' +
    '<div class="cardName">..</div>' +
    '<div class="cardSnippet">Back to All files · drop a file to move it out</div>';
  el.onclick = () => { currentFolder = ''; renderLibrary(); };
  el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect='move'; el.classList.add('dragover'); });
  el.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el.addEventListener('drop', e => {
    e.preventDefault(); el.classList.remove('dragover');
    const id = e.dataTransfer.getData('text/plain');
    if (id) { setFileFolder(id, ''); renderLibrary(); toast('Moved to All files'); }
  });
  return el;
}
function emptyState(){
  const el = document.createElement('div');
  el.className = 'emptyState';
  if (getLibrary().length === 0){
    el.innerHTML =
      '<div class="emptyIco">📝</div>' +
      '<h3>Your library is empty</h3>' +
      '<p>Create your first file, drop .md files anywhere, or start from a sample.</p>' +
      '<div class="emptyBtns"><button class="btn primary" data-act="new">+ New file</button><button class="ghostBtn" data-act="sample">Use sample</button></div>';
    const nb = el.querySelector('[data-act="new"]');
    const sb = el.querySelector('[data-act="sample"]');
    if (nb) nb.onclick = newFile;
    if (sb) sb.onclick = newSample;
  } else if (searchQuery.trim()){
    el.innerHTML = '<div class="emptyIco">🔍</div><h3>No matches</h3><p>Nothing found for “'+escHtml(searchQuery)+'”.</p>';
  } else {
    el.innerHTML =
      '<div class="emptyIco">📂</div>' +
      '<h3>This folder is empty</h3>' +
      '<p>Drag files here, or create a new file in this folder.</p>' +
      '<div class="emptyBtns"><button class="btn primary" data-act="new">+ New file</button></div>';
    const nb = el.querySelector('[data-act="new"]');
    if (nb) nb.onclick = newFile;
  }
  return el;
}

/* ---------- main render ---------- */
export function renderLibrary(){
  const grid = $('#libGrid');
  if (!grid) return;
  renderSidebar();
  updateGreeting();
  renderStats();
  grid.innerHTML = '';

  const q = searchQuery.trim().toLowerCase();
  if (q){
    const matches = getLibrary().filter(f => (f.name||'').toLowerCase().includes(q) || (f.md||'').toLowerCase().includes(q));
    if (!matches.length) grid.appendChild(emptyState());
    else matches.forEach(f => grid.appendChild(fileCard(f, true)));
    return;
  }

  if (currentFolder === ''){
    getFolders().forEach(n => grid.appendChild(folderCard(n)));
    filesIn('').forEach(f => grid.appendChild(fileCard(f, false)));
  } else {
    grid.appendChild(upCard());
    filesIn(currentFolder).forEach(f => grid.appendChild(fileCard(f, false)));
  }
  if (!grid.children.length) grid.appendChild(emptyState());
}

/* ---------- actions ---------- */
function newFile(){
  const rec = createFile(uniqueName('untitled.md', getLibrary()), '', { folder: currentFolder });
  renderLibrary();
  openFile(rec, { edit:true });
}
function newSample(){
  const rec = createFile(uniqueName('sample-readme.md', getLibrary()), SAMPLE, { folder: currentFolder });
  renderLibrary();
  openFile(rec);
  toast('Sample loaded');
}
function doNewFolder(){
  const name = prompt('New folder name:');
  if (name == null) return;
  const t = name.trim();
  if (!t) return;
  if (getFolders().includes(t)) { toast('That folder already exists','warn'); return; }
  createFolder(t);
  renderLibrary();
  toast('Folder “'+t+'” created');
}
function doRenameFolder(name){
  const nn = prompt('Rename folder:', name);
  if (nn == null) return;
  const t = nn.trim();
  if (!t || t === name) return;
  if (getFolders().includes(t)) { toast('A folder with that name already exists','warn'); return; }
  renameFolder(name, t);
  if (currentFolder === name) currentFolder = t;
  renderLibrary();
  toast('Folder renamed');
}
function doDeleteFolder(name){
  if (!confirm('Delete folder “'+name+'”? Its files will move to All files (they are NOT deleted).')) return;
  deleteFolder(name);
  if (currentFolder === name) currentFolder = '';
  renderLibrary();
  toast('Folder deleted');
}
function doDeleteFile(f, btn){
  if (btn && btn.dataset.armed){
    saveLibrary(getLibrary().filter(x => x.id !== f.id));
    renderLibrary();
    toast('Deleted '+f.name);
  } else if (btn){
    btn.dataset.armed = '1';
    btn.textContent = '✕';
    btn.classList.add('armed');
    btn.title = 'Click again to confirm';
    setTimeout(() => {
      if (btn.isConnected){ delete btn.dataset.armed; btn.innerHTML = TRASH_SVG; btn.classList.remove('armed'); btn.title='Delete'; }
    }, 2500);
  }
}
function showMoveMenu(f, anchorEl){
  closeMoveMenu();
  const menu = document.createElement('div');
  menu.className = 'moveMenu'; menu.id = 'moveMenu';
  const add = (label, target) => {
    const it = document.createElement('button');
    it.className = 'moveItem' + (fileFolder(f) === target ? ' current':'');
    it.textContent = label;
    it.onclick = e => {
      e.stopPropagation();
      setFileFolder(f.id, target);
      closeMoveMenu();
      renderLibrary();
      toast(target ? 'Moved to “'+target+'”' : 'Moved to All files');
    };
    menu.appendChild(it);
  };
  add('🗂 All files (root)', '');
  getFolders().forEach(n => add('📁 '+n, n));
  const rect = anchorEl.getBoundingClientRect();
  menu.style.left = Math.min(rect.left, innerWidth-240) + 'px';
  menu.style.top = Math.min(rect.bottom+6, innerHeight-220) + 'px';
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', closeMoveMenu, { once:true }), 0);
}
function closeMoveMenu(){
  const m = $('#moveMenu');
  if (m) m.remove();
}

/* ---------- init ---------- */
export function initLibrary(){
  const search = $('#libSearch');
  if (search) search.addEventListener('input', e => { searchQuery = e.target.value; renderLibrary(); });

  const libNew = $('#libNew');
  if (libNew) libNew.onclick = newFile;

  const sideNewFolder = $('#sideNewFolder');
  if (sideNewFolder) sideNewFolder.onclick = doNewFolder;

  const navAll = $('#navAll');
  if (navAll) navAll.onclick = () => { currentFolder=''; if(search){search.value=''; searchQuery='';} renderLibrary(); };

  const navTodos = $('#navTodos');
  if (navTodos) navTodos.onclick = () => document.dispatchEvent(new CustomEvent('todos:open'));
  const legacyTodos = $('#libTodos');
  if (legacyTodos) legacyTodos.onclick = () => { if(navTodos) navTodos.onclick(); };

  const sideSettings = $('#sideSettings');
  if (sideSettings) sideSettings.onclick = () => document.dispatchEvent(new CustomEvent('settings:open'));

  const sideSample = $('#sideSample');
  if (sideSample) sideSample.onclick = newSample;
  const libSample = $('#libSample');
  if (libSample) libSample.onclick = newSample;

  const installBtn = $('#installBtn');
  if (installBtn) installBtn.onclick = () => toast('Use your browser/app menu → Install');

  const libUpload = $('#libUpload'), libFileInput = $('#libFileInput');
  if (libUpload && libFileInput){
    libUpload.onclick = () => libFileInput.click();
    libFileInput.addEventListener('change', async e => {
      const files = [...e.target.files];
      if (!files.length) return;
      let count=0;
      for (const f of files){
        createFile(uniqueName(f.name, getLibrary()), await readEntry(f), { folder: currentFolder });
        count++;
      }
      renderLibrary();
      toast('Imported '+count+' file'+(count>1?'s':''));
      e.target.value='';
    });
  }

  const libFolder = $('#libFolder'), folderInput = $('#folderInput');
  if (libFolder && folderInput){
    libFolder.onclick = () => folderInput.click();
    folderInput.addEventListener('change', async e => {
      const files = [...e.target.files].filter(f => /\.(md|markdown|mdown|txt)$/i.test(f.name));
      if (!files.length){ toast('No markdown files in that folder','warn'); return; }
      let count=0;
      for (const f of files){
        createFile(uniqueName(f.name, getLibrary()), await readEntry(f), { folder: currentFolder });
        count++;
      }
      renderLibrary();
      toast('Imported '+count+' file'+(count>1?'s':''));
      e.target.value='';
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
      toast('Imported '+name);
    } catch(err){ toast('Could not fetch that URL','warn'); }
  };

  // shortcuts on home
  document.addEventListener('keydown', e => {
    if (document.body.dataset.view !== 'library') return;
    const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (typing) return;
    if (e.key === '/'){ e.preventDefault(); const s=$('#libSearch'); if(s)s.focus(); }
    if ((e.ctrlKey||e.metaKey) && !e.shiftKey && (e.key==='n'||e.key==='N')){ e.preventDefault(); newFile(); }
    if ((e.ctrlKey||e.metaKey) && e.shiftKey && (e.key==='f'||e.key==='F')){ e.preventDefault(); doNewFolder(); }
  });

  renderLibrary();
}

export function showLibrary(){
  document.body.dataset.view = 'library';
  document.title = 'Inkdown — Library';
  renderLibrary();
}









// Command palette events
document.addEventListener('library:new', () => {
  const btn = $('#libNew');
  if (btn) btn.click();
});
document.addEventListener('library:newfolder', () => {
  const btn = $('#sideNewFolder');
  if (btn) btn.click();
});
document.addEventListener('file:open', (e) => {
  if (e.detail && e.detail.file) {
    openFile(e.detail.file);
  }
});
document.addEventListener('app:toggleedit', () => {
  const btn = $('#btnEdit');
  if (btn) btn.click();
});
document.addEventListener('app:focus', () => {
  const btn = $('#btnFocus');
  if (btn) btn.click();
});
document.addEventListener('app:search', () => {
  const btn = $('#btnSearch');
  if (btn) btn.click();
});
document.addEventListener('slides:show', () => {
  // Import showSlides if available
  document.dispatchEvent(new CustomEvent('slides:open'));
});
document.addEventListener('todo:quickadd', () => {
  document.dispatchEvent(new CustomEvent('quickadd:open'));
});
document.addEventListener('export:pdf', () => {
  const btn = document.querySelector('[data-act="pdf"]');
  if (btn) btn.click();
});
document.addEventListener('export:html', () => {
  const btn = document.querySelector('[data-act="html"]');
  if (btn) btn.click();
});
document.addEventListener('export:png', () => {
  const btn = document.querySelector('[data-act="png"]');
  if (btn) btn.click();
});
document.addEventListener('export:share', () => {
  const btn = document.querySelector('[data-act="share"]');
  if (btn) btn.click();
});
document.addEventListener('settings:export', () => {
  const btn = $('#settingsExportAll');
  if (btn) btn.click();
});
document.addEventListener('shortcuts:open', () => {
  const modal = $('#shortcutsModal');
  if (modal) modal.hidden = false;
});