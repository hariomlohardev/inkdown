// Theme management
import { $, STORAGE_KEYS } from './state.js';

export function isDark() {
  return document.documentElement.dataset.theme === 'dark';
}

export function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, t);
  } catch (e) {
    // localStorage might fail on file:// URLs
  }
  // Notify listeners (mermaid needs re-render on theme change)
  document.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: t } }));
}

export function toggleTheme() {
  setTheme(isDark() ? 'light' : 'dark');
}

export function initTheme() {
  let saved = 'light';
  try {
    saved = localStorage.getItem(STORAGE_KEYS.THEME);
  } catch (e) {}
  if (!saved) {
    saved = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = saved;

  // Single button toggles between sun/moon via CSS
  $('#btnTheme').onclick = toggleTheme;
}
