// Desktop persistence bridge.
// Mirrors the app's localStorage keys to a file on disk (via main.py's Api)
// so data survives even if the WebView clears storage or the origin changes.

const PERSIST_KEYS = [
  'inkdown:library',   // all markdown files
  'inkdown:todos',     // todos + settings
  'inkdown:versions',  // file version history
  'inkdown:doc',       // legacy single doc
  'inkdown:theme',     // light/dark
  'inkdown:read',      // reading preferences
  'inkdown:folders',
  'inkdown:todoPos'    // widget position
];

function api() {
  return (window.pywebview && window.pywebview.api) || null;
}

function collect() {
  const obj = {};
  for (const k of PERSIST_KEYS) {
    const v = localStorage.getItem(k);
    if (v !== null) obj[k] = v;
  }
  return obj;
}

async function flush() {
  const a = api();
  if (!a) return;
  try { await a.save_snapshot(JSON.stringify(collect())); } catch (e) {}
}

async function restore() {
  const a = api();
  if (!a) return;
  try {
    const raw = await a.load_snapshot();
    if (!raw) return;
    const obj = JSON.parse(raw);
    for (const k of PERSIST_KEYS) {
      // Only fill in keys that are missing locally (don't overwrite newer data)
      if (obj[k] !== undefined && obj[k] !== null && localStorage.getItem(k) === null) {
        localStorage.setItem(k, obj[k]);
      }
    }
  } catch (e) {}
}

// Resolve once restore is done. In a normal browser (no bridge) resolve instantly.
export const restored = new Promise(resolve => {
  let done = false;
  const finish = () => { if (!done) { done = true; resolve(); } };

  const isDesktopHost = location.protocol === 'http:' &&
    (location.hostname === '127.0.0.1' || location.hostname === 'localhost');

  if (!isDesktopHost) { finish(); return; }   // plain web → nothing to restore

  window.addEventListener('pywebviewready', async () => {
    await restore();
    finish();
  });
  setTimeout(finish, 1200);   // safety net so the app never hangs
});

// Keep the disk copy fresh
setInterval(flush, 2000);
window.addEventListener('beforeunload', flush);
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});