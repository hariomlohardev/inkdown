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
import { initChart } from './chart.js';   // NEW

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
  initChart();            // NEW
  setupKeyboard();

  if (!openSharedFromHash()) showLibrary();   // NEW: shared link wins over home

  if (!window.marked || !window.DOMPurify) {
    toast('CDN libraries failed — rendering is limited', 'warn');
  }
})();