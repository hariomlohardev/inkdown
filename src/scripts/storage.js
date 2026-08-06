// Persistence layer - wraps localStorage with safety
import { state, STORAGE_KEYS } from './state.js';
import { loadDoc } from './ui.js';
import { SAMPLE } from './samples.js';

export function save(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveDocRecord() {
  return save(STORAGE_KEYS.DOC, {
    md: state.md,
    name: state.name,
    at: Date.now(),
    highlights: state.highlights,
    goal: state.goal,
    scroll: state.scroll
  });
}

export async function loadSavedDoc() {
  const saved = load(STORAGE_KEYS.DOC);
  if (saved && typeof saved.md === 'string' && saved.md.trim()) {
    await loadDoc(saved.md, saved.name || 'untitled.md', true, saved);
    return true;
  }
  return false;
}

export async function loadSample() {
  await loadDoc(SAMPLE, 'sample-readme.md');
}

export function pushVersion() {
  const V = load(STORAGE_KEYS.VERSIONS) || {};
  let arr = V[state.name] || [];
  if (!arr.length || arr[0].md !== state.md) {
    arr.unshift({ at: Date.now(), md: state.md });
    arr = arr.slice(0, 12);
  }
  V[state.name] = arr;
  save(STORAGE_KEYS.VERSIONS, V);
}

export function getVersions() {
  const V = load(STORAGE_KEYS.VERSIONS) || {};
  return V[state.name] || [];
}
