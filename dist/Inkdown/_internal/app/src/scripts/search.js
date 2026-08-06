// Document search
import { state, $, debounce } from './state.js';

let srMarks = [];
let srCur = -1;

export function initSearch() {
  $('#btnSearch').onclick = openSearch;
  $('#srInput').addEventListener('input', debounce(srRun, 140));
  $('#srInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); srStep(e.shiftKey ? -1 : 1); }
  });
  $('#srNext').onclick = () => srStep(1);
  $('#srPrev').onclick = () => srStep(-1);
  $('#srClose').onclick = closeSearch;
}

export function openSearch() {
  $('#searchBar').classList.add('open');
  $('#srInput').focus();
  $('#srInput').select();
}

export function closeSearch() {
  $('#searchBar').classList.remove('open');
  srClear();
}

function srClear() {
  srMarks.forEach(m => {
    const p = m.parentNode;
    if (p) {
      p.replaceChild(document.createTextNode(m.textContent), m);
      p.normalize();
    }
  });
  srMarks = [];
  srCur = -1;
  $('#srCount').textContent = '';
}

function srRun() {
  srClear();
  const q = $('#srInput').value.trim();
  if (q.length < 2) return;
  const walker = document.createTreeWalker(state.docEl, NodeFilter.SHOW_TEXT);
  const ql = q.toLowerCase();
  let node;
  const hits = [];
  while (node = walker.nextNode()) {
    if (node.parentElement.closest('script, style')) continue;
    let txt = node.textContent.toLowerCase();
    let i = 0;
    while ((i = txt.indexOf(ql, i)) > -1) {
      hits.push({ node, start: i });
      i += ql.length;
    }
  }
  hits.reverse().forEach(h => {
    try {
      const range = document.createRange();
      range.setStart(h.node, h.start);
      range.setEnd(h.node, h.start + q.length);
      const m = document.createElement('mark');
      m.className = 'sm';
      range.surroundContents(m);
      srMarks.unshift(m);
    } catch (e) {}
  });
  if (srMarks.length) { srCur = 0; srFocus(); }
  $('#srCount').textContent = srMarks.length ? (srCur + 1) + '/' + srMarks.length : '0';
  if (!srMarks.length && q) $('#srCount').textContent = '0';
}

function srFocus() {
  srMarks.forEach(m => m.classList.remove('cur'));
  const m = srMarks[srCur];
  m.classList.add('cur');
  m.scrollIntoView({ block: 'center', behavior: 'smooth' });
  $('#srCount').textContent = (srCur + 1) + '/' + srMarks.length;
}

function srStep(d) {
  if (!srMarks.length) return;
  srCur = (srCur + d + srMarks.length) % srMarks.length;
  srFocus();
}
