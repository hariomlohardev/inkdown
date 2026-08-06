import { $ } from './state.js';

const THEME_KEY = 'inkdown:theme';

export function isDark() {
  return document.documentElement.dataset.theme === 'dark';
}

export function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  document.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: t } }));
}

export function toggleTheme() {
  setTheme(isDark() ? 'light' : 'dark');
}

export function initTheme() {
  let saved = 'light';
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  if (!saved) saved = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = saved;

  // Bind every theme toggle button (reader header + library header)
  ['#btnTheme', '#libTheme'].forEach(sel => {
    const el = $(sel);
    if (el) el.onclick = toggleTheme;
  });
}