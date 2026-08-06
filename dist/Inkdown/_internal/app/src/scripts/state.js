// Shared state and utility functions
export const STORAGE_KEYS = {
  DOC: 'inkdown:doc',       // legacy single-file key (migrated)
  THEME: 'inkdown:theme',
  READ: 'inkdown:read'
};

export const state = {
  fileId: null,            // ← currently open library file id
  md: '',
  name: 'untitled.md',
  dirty: false,
  editing: false,
  mmd: [],
  goal: 0,
  highlights: [],
  scroll: 0,
  collapsed: new Set(),
  lastJump: null
};

export const ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
export const ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function initState() {
  state.docEl = $('#doc');
  state.previewEl = $('#preview');
  state.scrollArea = $('#scrollArea');
  state.editorEl = $('#editor');
  state.prevScroll = $('#prevScroll');
}

export function rememberJump() {
  state.lastJump = state.scrollArea.scrollTop;
}