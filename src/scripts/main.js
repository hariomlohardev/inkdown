// Entry point — orchestrates initialization in the CORRECT order
import { initState } from './state.js';
import { readSavedDoc } from './storage.js';
import { SAMPLE } from './samples.js';
import { initTheme } from './theme.js';
import { initUI, setupKeyboard, loadDoc, toast, updateReadProgress } from './ui.js';
import { initTOC } from './toc.js';
import { initNavigation } from './navigation.js';
import { initEditor } from './editor.js';
import { initSearch } from './search.js';
import { initHighlight } from './highlight.js';
import { initViewer } from './viewer.js';
import { initQuality } from './quality.js';

(async function boot() {
  // 1. Theme first (only touches <html> attribute)
  initTheme();

  // 2. Cache DOM references into state — MUST happen before any bindings
  initState();

  // 3. Bind all UI (safe now: state.docEl / state.editorEl exist)
  initUI();
  initTOC();
  initNavigation();
  initEditor();
  initSearch();
  initHighlight();
  initViewer();
  initQuality();
  setupKeyboard();

  // 4. Load content last
  const saved = readSavedDoc();
  if (saved) {
    await loadDoc(saved.md, saved.name || 'untitled.md', true, saved);
    toast('Restored your last document');
  } else {
    await loadDoc(SAMPLE, 'sample-readme.md');
  }

  updateReadProgress();

  if (!window.marked || !window.DOMPurify) {
    toast('CDN libraries failed — rendering is limited', 'warn');
  }
})();