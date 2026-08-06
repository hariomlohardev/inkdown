// Text highlights — select text, click the floating button, survives reloads.
// Note: deliberately does NOT import ui.js (ui.js imports us → avoid cycles).
import { state, $ } from './state.js';
import { upsertFile } from './storage.js';

export function initHighlight() {
  // Show the floating "Highlight" button near a text selection
  document.addEventListener('mouseup', () => {
    const btn = $('#hlBtn');
    setTimeout(() => {
      const sel = getSelection();
      if (
        state.editing ||
        sel.isCollapsed ||
        !sel.toString().trim() ||
        !state.docEl.contains(sel.anchorNode)
      ) {
        btn.style.display = 'none';
        return;
      }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      btn.style.display = 'block';
      btn.style.left = Math.min(innerWidth - 130, Math.max(8, r.left + r.width / 2 - 55)) + 'px';
      btn.style.top = (r.top - 42) + 'px';
    }, 10);
  });

  // Apply the highlight
  $('#hlBtn').onclick = () => {
    const sel = getSelection();
    if (sel.isCollapsed) return;

    const text = sel.toString();
    try {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.className = 'hl';
      span.appendChild(range.extractContents());
      range.insertNode(span);
      state.highlights.push({ q: text });
      saveHighlights();
    } catch (err) {
      // Selection crossed element boundaries in an unsplittable way — ignore
    }

    sel.removeAllRanges();
    $('#hlBtn').style.display = 'none';
  };

  // Click a highlight to remove it
  state.docEl.addEventListener('click', e => {
    const hl = e.target.closest('.hl');
    if (hl) {
      const q = hl.textContent;
      state.highlights = state.highlights.filter(
        (h, i) => !(h.q === q && state.highlights.findIndex(x => x.q === q) === i)
      );
      saveHighlights();
      hl.replaceWith(...hl.childNodes);
      state.docEl.normalize();
      return;
    }
    // (Image clicks are handled by viewer.js, which binds its own listener)
  });
}

/**
 * Re-apply saved highlights onto freshly rendered HTML.
 * Called by ui.js after every renderView().
 */
export function applyHighlights(root) {
  // Clear any existing marks first (re-render case)
  root.querySelectorAll('.hl').forEach(h => h.replaceWith(...h.childNodes));

  // The live preview re-renders on every keystroke — skip persisting marks there
  if (root === state.previewEl) return;

  state.highlights.forEach(item => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;

    while ((node = walker.nextNode())) {
      // Never highlight inside code blocks or existing highlights
      if (node.parentElement.closest('.hl, script, style, .codebox')) continue;

      const idx = node.textContent.indexOf(item.q);
      if (idx > -1) {
        try {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + item.q.length);
          const span = document.createElement('span');
          span.className = 'hl';
          range.surroundContents(span);
        } catch (e) {
          // Range error — skip this highlight
        }
        break;   // only wrap the first occurrence
      }
    }
  });
}

/** Persist highlights into the current library file (multi-file aware). */
function saveHighlights() {
  if (state.fileId) {
    upsertFile({ id: state.fileId, highlights: state.highlights });
  }
}