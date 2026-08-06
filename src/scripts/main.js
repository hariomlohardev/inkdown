import { initState } from './state.js';
import { migrateLegacy } from './storage.js';
import { initTheme } from './theme.js';
import { initUI, setupKeyboard, toast } from './ui.js';
import { initTOC } from './toc.js';
import { initNavigation } from './navigation.js';
import { initEditor } from './editor.js';
import { initSearch } from './search.js';
import { initHighlight } from './highlight.js';
import { initViewer } from './viewer.js';
import { initQuality } from './quality.js';
import { initLibrary, showLibrary } from './library.js';

(async function boot() {
  initTheme();
  initState();
  migrateLegacy();     // bring over any old single-file save

  initUI();
  initTOC();
  initNavigation();
  initEditor();
  initSearch();
  initHighlight();
  initViewer();
  initQuality();
  initLibrary();
  setupKeyboard();

  showLibrary();       // ← app boots into the Library home screen

  if (!window.marked || !window.DOMPurify) {
    toast('CDN libraries failed — rendering is limited', 'warn');
  }
})();