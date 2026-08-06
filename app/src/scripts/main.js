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
import { initLibrary, showLibrary } from './library.js';
import { initTodos } from './todos.js';
import { initChart } from './chart.js';
import { initAssist } from './assist.js';
import { initPWA } from './pwa.js';
import { restored } from './persist.js';

function hideSplash() { document.body.classList.add('ready'); }

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
  const api = window.pywebview && window.pywebview.api;
  if (!api || !api.get_launch_files) return false;
  let opened = false;
  try {
    const paths = await api.get_launch_files();
    if (paths && paths.length) {
      for (const p of paths) {
        const content = await api.read_external_file(p);
        if (content == null) continue;
        const name = p.split(/[\\/]/).pop();
        const existing = getLibrary().find(f => f.name === name);
        if (existing) openFile(existing);
        else openFile(createFile(name, content));
        opened = true;
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
  setupKeyboard();

  const shared = openSharedFromHash();
  const launched = await openLaunchFiles();
  if (!shared && !launched) showLibrary();

  hideSplash();
  if (!window.marked || !window.DOMPurify) toast('CDN libraries failed — some features limited', 'warn');
})();