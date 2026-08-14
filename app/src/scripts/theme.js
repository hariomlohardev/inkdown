import { $, $$ } from './state.js';
import { rerenderMermaidOnThemeChange } from './markdown.js';

const THEME_KEY = 'inkdown:theme';
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

// Resolve the stored mode into an actual theme
function resolved(mode) {
  if (mode === 'light' || mode === 'dark') return mode;
  return (mq && mq.matches) ? 'dark' : 'light';   // 'system'
}

export function getMode() {
  let m = 'system';
  try { m = localStorage.getItem(THEME_KEY) || 'system'; } catch (e) {}
  if (m !== 'light' && m !== 'dark' && m !== 'system') m = 'system';
  return m;
}

export function isDark() {
  return document.documentElement.dataset.theme === 'dark';
}

// Highlight the currently selected option in the settings panel
function syncSelectors(mode) {
  $$('.themeOption').forEach(el => {
    const on = el.dataset.themeValue === mode;
    el.classList.toggle('on', on);
    el.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

function apply() {
  const mode = getMode();
  const actual = resolved(mode);
  document.documentElement.dataset.theme = actual;
  document.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: actual, mode } }));
  syncSelectors(mode);
}

export function setThemeMode(mode) {
  if (mode !== 'light' && mode !== 'dark' && mode !== 'system') mode = 'system';
  try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
  apply();
  // Re-render mermaid diagrams with new theme
  setTimeout(rerenderMermaidOnThemeChange, 200);
}
// Backwards-compatible helpers
export function setTheme(t) { setThemeMode(t); }
export function toggleTheme() { setThemeMode(isDark() ? 'light' : 'dark'); }

// Settings modal wiring
function initSettingsPanel() {
  const modal = $('#settingsModal');
  if (!modal) return;
  const open = () => { syncSelectors(getMode()); modal.hidden = false; };
  const close = () => { modal.hidden = true; };

  const openBtn = $('#libSettings');
  if (openBtn) openBtn.onclick = open;
  const closeBtn = $('#settingsClose');
  if (closeBtn) closeBtn.onclick = close;

  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });

  $$('.themeOption').forEach(btn => {
    btn.addEventListener('click', () => setThemeMode(btn.dataset.themeValue));
  });
  document.addEventListener('settings:open', open);
}

export function initTheme() {
  apply();
  // Follow the OS when mode is 'system'
  if (mq) {
    const onChange = () => { if (getMode() === 'system') apply(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
  // Quick light/dark toggle in the reader header
  const readerToggle = $('#btnTheme');
  if (readerToggle) readerToggle.onclick = toggleTheme;

  initSettingsPanel();
}