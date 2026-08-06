// Persistence layer — multi-file library model
import { state } from './state.js';

const LIB_KEY = 'inkdown:library';
const FOLDERS_KEY = 'inkdown:folders';
const VER_KEY = 'inkdown:versions';

// Export all storage keys for use in other modules (settings, backup, etc.)
export const STORAGE_KEYS = {
  LIBRARY: LIB_KEY,
  FOLDERS: FOLDERS_KEY,
  VERSIONS: VER_KEY,
  TODOS: 'inkdown:todos',
  SETTINGS: 'inkdown:settings',
  DOC: 'inkdown:doc',  // legacy
  THEME: 'inkdown:theme',
  READ: 'inkdown:read',
  TODO_POS: 'inkdown:todoPos'
};

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getLibrary() {
  try {
    return JSON.parse(localStorage.getItem(LIB_KEY)) || [];
  } catch (e) {
    return [];
  }
}

export function saveLibrary(files) {
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(files));
    return true;
  } catch (e) {
    return false;
  }
}

export function getFolders() {
  try { return JSON.parse(localStorage.getItem(FOLDERS_KEY)) || []; }
  catch (e) { return []; }
}

export function saveFolders(folders) {
  try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); return true; }
  catch (e) { return false; }
}

export function createFolder(name) {
  const t = (name || '').trim();
  if (!t) return null;
  const folders = getFolders();
  if (!folders.includes(t)) { folders.push(t); saveFolders(folders); }
  return t;
}

export function renameFolder(oldName, newName) {
  const t = (newName || '').trim();
  if (!t) return;
  const folders = getFolders();
  const i = folders.indexOf(oldName);
  if (i === -1 || folders.includes(t)) return;
  folders[i] = t;
  saveFolders(folders);
  const files = getLibrary();
  files.forEach(f => { if ((f.folder || '') === oldName) f.folder = t; });
  saveLibrary(files);
}

export function deleteFolder(name) {
  saveFolders(getFolders().filter(f => f !== name));
  const files = getLibrary();
  files.forEach(f => { if ((f.folder || '') === name) f.folder = ''; });  // files go to root, not deleted
  saveLibrary(files);
}

export function setFileFolder(fileId, folderName) {
  const files = getLibrary();
  const f = files.find(x => x.id === fileId);
  if (!f) return;
  f.folder = folderName || '';
  saveLibrary(files);
}

export function getFile(id) {
  return getLibrary().find(f => f.id === id) || null;
}

/** Insert or merge-update a file record (partial records are merged) */
export function upsertFile(record) {
  if (!record || !record.id) return false;
  const files = getLibrary();
  const i = files.findIndex(f => f.id === record.id);
  if (i > -1) files[i] = { ...files[i], ...record };
  else files.unshift({ createdAt: Date.now(), highlights: [], goal: 0, scroll: 0, ...record });
  return saveLibrary(files);
}

export function createFile(name, md, extra = {}) {
  const rec = {
    id: uid(),
    name,
    md,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    scroll: 0,
    highlights: [],
    goal: 0,
    ...extra
  };
  upsertFile(rec);
  return rec;
}

export function deleteFile(id) {
  return saveLibrary(getLibrary().filter(f => f.id !== id));
}

/** Avoid duplicate names: readme.md → readme (2).md */
export function uniqueName(base, files) {
  const names = new Set(files.map(f => f.name));
  if (!names.has(base)) return base;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '.md';
  let i = 2;
  while (names.has(`${stem} (${i})${ext}`)) i++;
  return `${stem} (${i})${ext}`;
}

/** Import a document saved by the OLD single-file version */
export function migrateLegacy() {
  try {
    const legacy = localStorage.getItem(STORAGE_KEYS.DOC);
    if (!legacy) return;
    if (getLibrary().length === 0) {
      const rec = JSON.parse(legacy);
      if (rec && rec.md) {
        createFile(rec.name || 'untitled.md', rec.md, {
          createdAt: rec.at || Date.now(),
          scroll: rec.scroll || 0,
          highlights: rec.highlights || [],
          goal: rec.goal || 0
        });
      }
    }
    localStorage.removeItem(STORAGE_KEYS.DOC);
  } catch (e) {}
}

/* ---- versions (keyed per file id now) ---- */
export function pushVersion() {
  try {
    const key = state.fileId || state.name;
    const V = JSON.parse(localStorage.getItem(VER_KEY) || '{}');
    let arr = V[key] || [];
    if (!arr.length || arr[0].md !== state.md) {
      arr.unshift({ at: Date.now(), md: state.md });
      arr = arr.slice(0, 12);
    }
    V[key] = arr;
    localStorage.setItem(VER_KEY, JSON.stringify(V));
  } catch (e) {}
}

export function getVersions() {
  try {
    const key = state.fileId || state.name;
    const V = JSON.parse(localStorage.getItem(VER_KEY) || '{}');
    return V[key] || [];
  } catch (e) {
    return [];
  }
}