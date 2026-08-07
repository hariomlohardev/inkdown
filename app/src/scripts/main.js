import { initState } from './state.js';
import { migrateLegacy, createFile, getLibrary } from './storage.js';
import { initTheme } from './theme.js';
import { initUI, setupKeyboard, toast, openFile } from './ui.js';
import { initTOC } from './toc.js';
import { initNavigation } from './navigation.js';
import { initEditor } from './editor.js';
import { initSearch } from './search.js';
import { initHighlight } from './highlight.js';
import { initViewer } from './viewer.js';
import { initQuality } from './quality.js';
import { initLibrary, showLibrary } from './home.js';
import { initTodos } from './todos.js';
import { initChart } from './chart.js';
import { initAssist } from './assist.js';
import { initPWA } from './pwa.js';
import { restored } from './persist.js';
import { initSettings } from './settings.js';
import { initSlides } from './slides.js';
import { initShortcuts } from './shortcuts.js';


// Global safety net: one bad error should never white-screen the whole app.
window.addEventListener('error', (e) => {
  try { console.error('[Inkdown] error:', e.message, e.filename, e.lineno); } catch (_) {}
});
window.addEventListener('unhandledrejection', (e) => {
  try { console.error('[Inkdown] unhandled rejection:', e.reason); } catch (_) {}
});

function hideSplash() { document.body.classList.add('ready'); }

// F11 → toggle native fullscreen (desktop build).
// Registered on the document so it fires regardless of which element has focus.
document.addEventListener('keydown', (e) => {
  if (e.key === 'F11' || e.code === 'F11') {
    const api = window.pywebview && window.pywebview.api;
    if (api && typeof api.toggle_fullscreen === 'function') {
      e.preventDefault();
      api.toggle_fullscreen();
    }
  }
});

// Wait until the PyWebView bridge (and our API) is actually available.
function waitForApi(timeout = 6000) {
  return new Promise(resolve => {
    const start = Date.now();
    (function poll() {
      const api = window.pywebview && window.pywebview.api;
      if (api && typeof api.get_launch_docs === 'function') { resolve(api); return; }
      if (Date.now() - start > timeout) { resolve(null); return; }
      setTimeout(poll, 100);
    })();
  });
}

function openSharedFromHash() {
  const h = location.hash;
  if (!h.startsWith('#doc=')) return false;
  try {
    const md = decodeURIComponent(escape(atob(h.slice(5))));
    if (md) {
      const rec = { id: 'shared-' + Date.now().toString(36), name: 'shared.md', md, highlights: [], goal: 0, scroll: 0 };
      openFile(rec);
      return true;
    }
  } catch (e) {}
  return false;
}

async function openLaunchFiles() {
  const api = await waitForApi();
  if (!api) return false;
  let opened = false;
  try {
    const docs = await api.get_launch_docs();
    if (docs && docs.length) {
      for (const d of docs) {
        try {
          const existing = getLibrary().find(f => f.name === d.name);
          if (existing) openFile(existing);
          else openFile(createFile(d.name, d.content));
          opened = true;
        } catch (e) {}
      }
    }
  } catch (e) {}
  return opened;
}

(async function boot() {
  await restored;
  setTimeout(hideSplash, 4000);

  initTheme(); initState(); migrateLegacy();
  initUI(); initTOC(); initNavigation(); initEditor(); initSearch(); initHighlight();
  initViewer(); initQuality(); initLibrary(); initTodos(); initChart(); initAssist(); initPWA();
  initSettings();
  initSlides();
  initShortcuts();
  setupKeyboard();

  const shared = openSharedFromHash();
  const launched = await openLaunchFiles();
  if (!shared && !launched) showLibrary();

  hideSplash();
  if (!window.marked || !window.DOMPurify) toast('CDN libraries failed — some features limited', 'warn');
})();