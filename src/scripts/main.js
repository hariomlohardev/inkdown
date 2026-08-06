// Main entry point - orchestrates initialization
import { initState } from './state.js';
import { loadSavedDoc, loadSample } from './storage.js';
import { initTheme } from './theme.js';
import { initUI, setupKeyboard, renderView, updateReadProgress, setEditing } from './ui.js';
import { initTOC } from './toc.js';
import { initNavigation } from './navigation.js';
import { initEditor } from './editor.js';
import { initSearch } from './search.js';
import { initHighlight } from './highlight.js';
import { initViewer } from './viewer.js';
import { initQuality } from './quality.js';
import { toast } from './ui.js';

(async function boot() {
  initTheme();
  initState();
  initUI();
  initTOC();
  initNavigation();
  initEditor();
  initSearch();
  initHighlight();
  initViewer();
  initQuality();
  setupKeyboard();

  const loaded = await loadSavedDoc();
  if (!loaded) {
    await loadSample();
  } else {
    toast('Restored your last document');
  }

  updateReadProgress();

  if (!window.marked || !window.DOMPurify) {
    toast('CDN libraries failed — rendering is limited', 'warn');
  }
})();
