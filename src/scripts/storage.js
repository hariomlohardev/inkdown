// Persistence layer — NO ui.js import (breaks circular dependency)
import { state, STORAGE_KEYS } from './state.js';

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

/** Returns the saved document record, or null if none exists */
export function readSavedDoc() {
  const saved = load(STORAGE_KEYS.DOC);
  if (saved && typeof saved.md === 'string' && saved.md.trim()) {
    return saved;
  }
  return null;
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