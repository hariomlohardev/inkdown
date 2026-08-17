// Text highlights — select text, click the floating button or press H, survives reloads.
// Robust: flexible context matching, color cycling, debounced saves, legacy migration.
import { state, $ } from './state.js';
import { upsertFile } from './storage.js';

const HIGHLIGHT_COLORS = [
  { name: 'yellow', bg: 'var(--hl-yellow-bg)', text: 'var(--hl-yellow-text)' },
  { name: 'pink',   bg: 'var(--hl-pink-bg)',   text: 'var(--hl-pink-text)' },
  { name: 'green',  bg: 'var(--hl-green-bg)',  text: 'var(--hl-green-text)' },
  { name: 'blue',   bg: 'var(--hl-blue-bg)',   text: 'var(--hl-blue-text)' },
  { name: 'purple', bg: 'var(--hl-purple-bg)', text: 'var(--hl-purple-text)' },
];

let saveTimeout = null;
const SAVE_DELAY = 500;

/** Migrate old {q: text} format to new structured format */
function migrateHighlights() {
  if (!state.highlights) state.highlights = [];
  if (!Array.isArray(state.highlights)) {
    state.highlights = [];
    return;
  }
  let changed = false;
  state.highlights = state.highlights.map(h => {
    if (h && h.q && !h.text) {
      changed = true;
      return {
        id: 'hl_' + Math.random().toString(36).slice(2, 10),
        text: h.q,
        before: '',
        after: '',
        blockId: '',
        start: -1,
        color: 0,
        createdAt: Date.now()
      };
    }
    // Migrate existing to add blockId if missing (keep working, will use context fallback)
    if (h && h.text && h.blockId === undefined) {
      h.blockId = '';
      h.start = -1;
      changed = true;
    }
    return h;
  }).filter(Boolean);
  if (changed) saveHighlights();
}

/** Core highlight action (shared by button click and H key) */
function performHighlight() {
  const sel = getSelection();
  if (!sel || sel.isCollapsed) return false;

  const text = sel.toString().trim();
  if (!text) return false;
  if (text.length > 500) {
    sel.removeAllRanges();
    return false;
  }

  try {
    const range = sel.getRangeAt(0);
    const ctx = getContext(range, text);
    const block = getBlockInfo(range);

    // Check if this exact highlight already exists → cycle color
    const existing = state.highlights.find(h =>
      h.text === text && h.before === ctx.before && h.after === ctx.after && (h.blockId || '') === (block.id || '')
    );

    if (existing) {
      existing.color = ((existing.color || 0) + 1) % HIGHLIGHT_COLORS.length;
      // Update block info if we now have it
      if (block.id && !existing.blockId) { existing.blockId = block.id; existing.start = block.start; }
      saveHighlights();
      applyHighlights(state.docEl);
    } else {
      // Add new highlight
      const newHighlight = {
        id: 'hl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        text: text,
        before: ctx.before,
        after: ctx.after,
        blockId: block.id || '',
        start: block.start ?? -1,
        color: 0,
        createdAt: Date.now()
      };

      state.highlights.push(newHighlight);
      saveHighlights();
      applySingleHighlight(newHighlight);
    }

    sel.removeAllRanges();
    return true;
  } catch (err) {
    console.error('[Highlight] Error:', err);
    return false;
  }
}

export function initHighlight() {
  migrateHighlights();

  // Show the floating "Highlight" button near a text selection
  document.addEventListener('mouseup', () => {
    const btn = $('#hlBtn');
    if (!btn) return;
    setTimeout(() => {
      const sel = getSelection();
      if (
        state.editing ||
        sel.isCollapsed ||
        !sel.toString().trim() ||
        !state.docEl || !state.docEl.contains(sel.anchorNode)
      ) {
        btn.style.display = 'none';
        return;
      }
      try {
        const r = sel.getRangeAt(0).getBoundingClientRect();
        btn.style.display = 'block';
        btn.style.left = Math.min(innerWidth - 130, Math.max(8, r.left + r.width / 2 - 55)) + 'px';
        btn.style.top = (r.top - 42) + 'px';
      } catch (e) {
        btn.style.display = 'none';
      }
    }, 10);
  });

  // Apply the highlight on button click
  const hlBtn = $('#hlBtn');
  if (hlBtn) {
    hlBtn.onclick = () => {
      performHighlight();
      hlBtn.style.display = 'none';
    };
  }

  // 🎯 KEYBOARD SHORTCUT: Press 'H' to highlight selected text
  document.addEventListener('keydown', (e) => {
    // Check if 'H' key is pressed (case insensitive)
    if (e.key === 'h' || e.key === 'H') {
      // Don't trigger if:
      // - User is typing in an input/textarea
      // - User is in edit mode
      // - No modifier keys pressed (allow Ctrl+H for browser history)
      // - No text is selected
      const target = e.target;
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable;
      
      if (isInput || state.editing || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const sel = getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        return;
      }

      // Check if selection is within the document
      if (!state.docEl || !state.docEl.contains(sel.anchorNode)) {
        return;
      }

      // Prevent default 'H' key behavior
      e.preventDefault();
      
      // Perform highlight
      const success = performHighlight();
      if (success) {
        // Hide the floating button if visible
        const btn = $('#hlBtn');
        if (btn) btn.style.display = 'none';
      }
    }
  });

  // Click a highlight to remove it (delegated on doc)
  if (state.docEl) {
    state.docEl.addEventListener('click', e => {
      const hl = e.target.closest('.hl');
      if (!hl) return;
      const id = hl.dataset.hlId;
      if (!id) {
        // Legacy highlight without ID — match by text
        const q = hl.textContent;
        state.highlights = state.highlights.filter(h => h.text !== q);
      } else {
        state.highlights = state.highlights.filter(h => h.id !== id);
      }
      saveHighlights();
      applyHighlights(state.docEl);
    });
  }
}

/** Get context before and after the selection (shorter for better matching) */
function getContext(range, text) {
  try {
    if (!state.docEl) return { before: '', after: '' };

    // Walk text nodes to find the absolute character offset
    const walker = document.createTreeWalker(state.docEl, NodeFilter.SHOW_TEXT);
    let charCount = 0;
    let rangeStart = -1;
    let node;

    while ((node = walker.nextNode())) {
      if (node === range.startContainer) {
        rangeStart = charCount + range.startOffset;
        break;
      }
      charCount += node.textContent.length;
    }

    if (rangeStart === -1) return { before: '', after: '' };

    // Get shorter context (20 chars) for more flexible matching
    const fullText = state.docEl.textContent || '';
    return {
      before: fullText.slice(Math.max(0, rangeStart - 20), rangeStart),
      after: fullText.slice(rangeStart + text.length, rangeStart + text.length + 20)
    };
  } catch (e) {
    return { before: '', after: '' };
  }
}

function getBlockInfo(range) {
  try {
    if (!state.docEl) return { id: '', start: -1 };
    let el = range.startContainer;
    if (el.nodeType === 3) el = el.parentElement;
    // Walk up to find block-level element with an id or create one
    while (el && el !== state.docEl) {
      if (/^(P|H[1-6]|LI|BLOCKQUOTE|TD|TH|DT|DD)$/.test(el.tagName)) {
        if (!el.dataset.hlBlock) {
          // Assign stable block id based on position among siblings
          const idx = [...state.docEl.querySelectorAll(el.tagName)].indexOf(el);
          el.dataset.hlBlock = el.tagName.toLowerCase() + '-' + idx;
        }
        // Compute start offset within block
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let off = 0;
        let n;
        let found = false;
        while ((n = walker.nextNode())) {
          if (n === range.startContainer) { off += range.startOffset; found = true; break; }
          off += n.textContent.length;
        }
        return { id: el.dataset.hlBlock, start: found ? off : -1 };
      }
      el = el.parentElement;
    }
  } catch (e) {}
  return { id: '', start: -1 };
}

/** Apply a single highlight immediately (no full re-render) */
function applySingleHighlight(item) {
  if (!state.docEl || !item || !item.text) return;
  
  const matches = findMatches(state.docEl, item);
  if (matches.length === 0) return;
  
  // Apply to first match only
  const match = matches[0];
  try {
    const range = document.createRange();
    range.setStart(match.node, match.start);
    range.setEnd(match.node, match.end);

    const color = HIGHLIGHT_COLORS[item.color || 0];
    const span = document.createElement('span');
    span.className = 'hl';
    span.dataset.hlId = item.id || '';
    span.style.backgroundColor = color.bg;
    span.style.color = color.text;
    span.style.borderRadius = '3px';
    span.style.padding = '1px 2px';
    span.title = 'Click to remove highlight';

    range.surroundContents(span);
  } catch (e) {
    console.warn('[Highlight] Could not apply:', e);
  }
}

/**
 * Re-apply all saved highlights onto freshly rendered HTML.
 * Called by ui.js after every renderView().
 */
export function applyHighlights(root) {
  if (!root) return;

  // Clear any existing marks first (re-render case)
  root.querySelectorAll('.hl').forEach(h => {
    const parent = h.parentNode;
    if (parent) {
      while (h.firstChild) parent.insertBefore(h.firstChild, h);
      parent.removeChild(h);
      parent.normalize();
    }
  });

  // The live preview re-renders on every keystroke — skip persisting marks there
  if (root === state.previewEl) return;

  if (!state.highlights || !state.highlights.length) return;

  state.highlights.forEach(item => {
    if (!item || !item.text) return;
    const matches = findMatches(root, item);
    
    // Apply to first match (or all matches if no context was saved)
    const toApply = (item.before || item.after) ? [matches[0]] : matches;
    
    toApply.forEach(match => {
      if (!match) return;
      try {
        const range = document.createRange();
        range.setStart(match.node, match.start);
        range.setEnd(match.node, match.end);

        const color = HIGHLIGHT_COLORS[item.color || 0];
        const span = document.createElement('span');
        span.className = 'hl';
        span.dataset.hlId = item.id || '';
        span.style.backgroundColor = color.bg;
        span.style.color = color.text;
        span.style.borderRadius = '3px';
        span.style.padding = '1px 2px';
        span.title = 'Click to remove highlight';

        range.surroundContents(span);
      } catch (e) {
        // Range error — skip this highlight
      }
    });
  });
}

/** Find matches with flexible context matching */
function findMatches(root, item) {
  const matches = [];

  // If we have blockId, try that first (more precise for duplicate text)
  if (item.blockId) {
    const block = root.querySelector(`[data-hl-block="${CSS.escape(item.blockId)}"]`);
    if (block) {
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      let full = '';
      const nodes = [];
      let n;
      while ((n = walker.nextNode())) { nodes.push(n); full += n.textContent; }
      let idx = -1;
      if (typeof item.start === 'number' && item.start >= 0) {
        idx = item.start;
        // Verify text at that offset
        if (full.slice(idx, idx + item.text.length) !== item.text) idx = full.indexOf(item.text);
      } else {
        idx = full.indexOf(item.text);
      }
      if (idx !== -1) {
        // Map idx to node
        let off = 0;
        for (const node of nodes) {
          const len = node.textContent.length;
          if (idx >= off && idx + item.text.length <= off + len) {
            matches.push({ node, start: idx - off, end: idx + item.text.length - off });
            break;
          }
          if (idx < off + len) break;
          off += len;
        }
        if (matches.length) return matches;
      }
    }
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      let p = node.parentElement;
      while (p && p !== root) {
        const tag = p.tagName;
        if (p.classList && p.classList.contains('hl')) return NodeFilter.FILTER_REJECT;
        if (tag === 'CODE' || tag === 'PRE' || tag === 'SCRIPT' ||
            tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'MARK') {
          return NodeFilter.FILTER_REJECT;
        }
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  // Build full text with node boundary map
  let fullText = '';
  const boundaries = [];
  textNodes.forEach(n => {
    const start = fullText.length;
    fullText += n.textContent;
    boundaries.push({ node: n, start, end: fullText.length });
  });

  const needle = item.text;
  const before = item.before || '';
  const after = item.after || '';
  let idx = 0;
  let matchCount = 0;

  while ((idx = fullText.indexOf(needle, idx)) !== -1) {
    const actualBefore = fullText.slice(Math.max(0, idx - before.length), idx);
    const actualAfter = fullText.slice(idx + needle.length, idx + needle.length + after.length);

    // Flexible matching: exact context OR partial match OR no context
    const beforeOk = !before || actualBefore === before || actualBefore.endsWith(before.slice(-10));
    const afterOk = !after || actualAfter === after || actualAfter.startsWith(after.slice(0, 10));

    if (beforeOk && afterOk) {
      const containing = boundaries.find(b =>
        b.start <= idx && idx + needle.length <= b.end
      );
      if (containing) {
        matches.push({
          node: containing.node,
          start: idx - containing.start,
          end: idx + needle.length - containing.start
        });
        matchCount++;
      }
    }
    idx += needle.length;
    
    // Safety: don't find too many matches
    if (matchCount > 10) break;
  }

  return matches;
}

/** Debounced save to library */
function saveHighlights() {
  if (!state.fileId) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      upsertFile({ id: state.fileId, highlights: state.highlights });
    } catch (e) {
      console.error('[Highlight] Save failed:', e);
    }
  }, SAVE_DELAY);
}