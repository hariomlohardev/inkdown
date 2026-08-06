// Text highlights
import { state, $ } from './state.js';
import { save } from './storage.js';
import { STORAGE_KEYS } from './state.js';

export function initHighlight() {
  document.addEventListener('mouseup', () => {
    const btn = $('#hlBtn');
    setTimeout(() => {
      const sel = getSelection();
      if (state.editing || sel.isCollapsed || !sel.toString().trim() || !state.docEl.contains(sel.anchorNode)) {
        btn.style.display = 'none';
        return;
      }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      btn.style.display = 'block';
      btn.style.left = Math.min(innerWidth - 130, Math.max(8, r.left + r.width / 2 - 55)) + 'px';
      btn.style.top = (r.top - 42) + 'px';
    }, 10);
  });

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
    } catch (err) {}
    sel.removeAllRanges();
    $('#hlBtn').style.display = 'none';
  };

  state.docEl.addEventListener('click', e => {
    const hl = e.target.closest('.hl');
    if (hl) {
      const q = hl.textContent;
      state.highlights = state.highlights.filter((h, i) => !(h.q === q && state.highlights.findIndex(x => x.q === q) === i));
      saveHighlights();
      hl.replaceWith(...hl.childNodes);
      state.docEl.normalize();
      return;
    }
  });
}

export function applyHighlights(root) {
  root.querySelectorAll('.hl').forEach(h => h.replaceWith(...h.childNodes));
  if (root !== state.previewEl) {
    state.highlights.forEach(item => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
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
          } catch (e) {}
          break;
        }
      }
    });
  }
}

function saveHighlights() {
  try {
    const rec = JSON.parse(localStorage.getItem(STORAGE_KEYS.DOC) || '{}');
    if (rec.name === state.name) {
      rec.highlights = state.highlights;
      localStorage.setItem(STORAGE_KEYS.DOC, JSON.stringify(rec));
    }
  } catch (e) {}
}
