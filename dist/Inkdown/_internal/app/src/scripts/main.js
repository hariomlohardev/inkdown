import { initState } from './state.js';
import { migrateLegacy } from './storage.js';
import { initTheme } from './theme.js';
import { initUI, setupKeyboard, loadDoc, toast } from './ui.js';
import { initTOC } from './toc.js';
import { initNavigation } from './navigation.js';
import { initEditor } from './editor.js';
import { initSearch } from './search.js';
import { initHighlight } from './highlight.js';
import { initViewer } from './viewer.js';
import { initQuality } from './quality.js';
import { initLibrary, showLibrary } from './library.js';
import { initTodos } from './todos.js';
import { initChart } from './chart.js';
import { initAssist } from './assist.js';
import { initPWA } from './pwa.js';
import { restored } from './persist.js';   // ← NEW

// F11 → toggle native fullscreen (desktop build only; no-op in a normal browser)
document.addEventListener('keydown', (e) => {
  if (e.key === 'F11') {
    const api = window.pywebview && window.pywebview.api;
    if (api && typeof api.toggle_fullscreen === 'function') {
      e.preventDefault();
      api.toggle_fullscreen();
    }
  }
});

function hideSplash() { document.body.classList.add('ready'); }

function openSharedFromHash() {
  const h = location.hash;
  if (!h.startsWith('#doc=')) return false;
  try {
    const md = decodeURIComponent(escape(atob(h.slice(5))));
    if (md) {
      loadDoc(md, 'shared-' + Date.now().toString(36) + '.md');
      document.body.dataset.view = 'reader';
      return true;
    }
  } catch (e) {}
  return false;
}

(async function boot() {
  await restored;                       // ← NEW: load saved data from disk first
  setTimeout(hideSplash, 4000);

  initTheme();
  initState();
  migrateLegacy();

  initUI();
  initTOC();
  initNavigation();
  initEditor();
  initSearch();
  initHighlight();
  initViewer();
  initQuality();
  initLibrary();
  initTodos();
  initChart();
  initAssist();
  initPWA();
  setupKeyboard();

  if (!openSharedFromHash()) showLibrary();

  hideSplash();

  if (!window.marked || !window.DOMPurify) {
    toast('CDN libraries failed — some features limited', 'warn');
  }
})();