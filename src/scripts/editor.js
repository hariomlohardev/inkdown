// Editor, toolbar, find/replace, table picker
import { state, $, $$ } from './state.js';

const PAIRS = { '`': '`', '*': '*', '(': ' )', '[': ']', '{': '}', '"': '"' };
let typewriter = false;
let syncOn = false;
let syncLock = false;

function editorLineH() {
  return parseFloat(getComputedStyle(state.editorEl).lineHeight) || 23.6;
}

function afterEdit() {
  state.editorEl.dispatchEvent(new Event('input'));
}

function surround(before, after) {
  after = after === undefined ? before : after;
  const s = state.editorEl.selectionStart;
  const e = state.editorEl.selectionEnd;
  const v = state.editorEl.value;
  const sel = v.slice(s, e);

  if (v.slice(s - before.length, s) === before && v.slice(e, e + after.length) === after) {
    state.editorEl.value = v.slice(0, s - before.length) + sel + v.slice(e + after.length);
    state.editorEl.selectionStart = s - before.length;
    state.editorEl.selectionEnd = e - before.length;
  } else if (sel.startsWith(before) && sel.endsWith(after) && sel.length >= before.length + after.length) {
    const inner = sel.slice(before.length, sel.length - after.length);
    state.editorEl.value = v.slice(0, s) + inner + v.slice(e);
    state.editorEl.selectionStart = s;
    state.editorEl.selectionEnd = s + inner.length;
  } else {
    state.editorEl.value = v.slice(0, s) + before + sel + after + v.slice(e);
    state.editorEl.selectionStart = s + before.length;
    state.editorEl.selectionEnd = s + before.length + sel.length;
  }
  state.editorEl.focus();
  afterEdit();
}

function lineOp(fn) {
  const s = state.editorEl.selectionStart;
  const e = state.editorEl.selectionEnd;
  const v = state.editorEl.value;
  const ls = v.lastIndexOf('\n', s - 1) + 1;
  let le = v.indexOf('\n', e);
  if (le === -1) le = v.length;
  const block = v.slice(ls, le);
  const out = block.split('\n').map(fn).join('\n');
  state.editorEl.value = v.slice(0, ls) + out + v.slice(le);
  state.editorEl.selectionStart = ls;
  state.editorEl.selectionEnd = ls + out.length;
  state.editorEl.focus();
  afterEdit();
}

export function insertAtCursor(text) {
  const s = state.editorEl.selectionStart;
  const v = state.editorEl.value;
  state.editorEl.value = v.slice(0, s) + text + v.slice(state.editorEl.selectionEnd);
  state.editorEl.selectionStart = state.editorEl.selectionEnd = s + text.length;
  state.editorEl.focus();
  afterEdit();
}

export const ED_ACTS = {
  bold: () => surround('**'),
  italic: () => surround('*'),
  strike: () => surround('~~'),
  code: () => surround('`'),
  h: () => lineOp(l => {
    const m = l.match(/^(#{1,6})\s+(.*)/);
    if (m) {
      const n = m[1].length;
      return n >= 4 ? m[2] : '#'.repeat(n + 1) + ' ' + m[2];
    }
    return '# ' + l;
  }),
  quote: () => lineOp(l => l.startsWith('> ') ? l.slice(2) : '> ' + l),
  ul: () => lineOp(l => l.startsWith('- ') ? l.slice(2) : '- ' + l),
  ol: () => {
    let n = 0;
    lineOp(l => {
      n++;
      const m = l.match(/^\d+\.\s/);
      return m ? l.replace(/^\d+\.\s/, m => m) : n + '. ' + l;
    });
  },
  task: () => lineOp(l => l.startsWith('- [ ] ') ? l.slice(6) : (l.startsWith('- [x] ') ? l.slice(6) : '- [ ] ' + l)),
  link: () => {
    const s = state.editorEl.selectionStart;
    const sel = state.editorEl.value.slice(s, state.editorEl.selectionEnd) || 'link text';
    insertAtCursor('[' + sel + '](url)');
    const p = state.editorEl.selectionEnd - 4;
    state.editorEl.selectionStart = p - 3;
    state.editorEl.selectionEnd = p;
  },
  img: () => insertAtCursor('![alt text](image-url)'),
  codeblock: () => {
    const sel = state.editorEl.value.slice(state.editorEl.selectionStart, state.editorEl.selectionEnd) || 'code here';
    insertAtCursor('\n```\n' + sel + '\n```\n');
  },
  hr: () => insertAtCursor('\n\n---\n\n')
};

export function initEditor() {
  // Toolbar clicks
  $('#editTools').addEventListener('click', e => {
    const b = e.target.closest('.tbtn');
    if (!b || !b.dataset.act) return;
    if (b.dataset.act === 'table') {
      e.stopPropagation();
      $('#tblPicker').classList.toggle('open');
      return;
    }
    ED_ACTS[b.dataset.act]?.();
  });

  // Smart editor keys
  state.editorEl.addEventListener('keydown', e => {
    const s = state.editorEl.selectionStart;
    const en = state.editorEl.selectionEnd;
    const v = state.editorEl.value;

    if (e.key === 'Tab') {
      e.preventDefault();
      insertAtCursor('  ');
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const line = v.slice(ls, s);
      const m = line.match(/^(\s*)([-*+]|\d+\.)(\s+\[[ xX]\])?\s+(.*)$/);
      if (m) {
        e.preventDefault();
        if (!m[4]) {
          state.editorEl.value = v.slice(0, ls) + v.slice(s);
          state.editorEl.selectionStart = state.editorEl.selectionEnd = ls;
        } else {
          let marker = m[2];
          if (/\d+\./.test(marker)) marker = (parseInt(marker) + 1) + '.';
          const box = m[3] ? ' [ ]' : '';
          insertAtCursor('\n' + m[1] + marker + box + ' ');
        }
        return;
      }
    }

    if (e.key === 'Backspace' && s === en && s > 0) {
      const before = v[s - 1];
      const after = v[s];
      for (const k in PAIRS) {
        if (before === k && after === PAIRS[k].trim() || ((before === k) && (after === PAIRS[k]))) {
          e.preventDefault();
          state.editorEl.value = v.slice(0, s - 1) + v.slice(s + 1);
          state.editorEl.selectionStart = state.editorEl.selectionEnd = s - 1;
          afterEdit();
          return;
        }
      }
    }

    if (PAIRS[e.key] !== undefined) {
      e.preventDefault();
      const sel = v.slice(s, en);
      const close = PAIRS[e.key].trim();
      state.editorEl.value = v.slice(0, s) + e.key + sel + close + v.slice(en);
      state.editorEl.selectionStart = state.editorEl.selectionEnd = s + 1 + sel.length;
      if (sel) state.editorEl.selectionStart = s + 1;
      afterEdit();
    }
  });

  // Typewriter
  state.editorEl.addEventListener('keyup', typewrite);
  state.editorEl.addEventListener('click', typewrite);

  $('#btnType').onclick = function() {
    typewriter = !typewriter;
    this.classList.toggle('on', typewriter);
    if (typewriter) typewrite();
  };

  $('#btnSync').onclick = function() {
    syncOn = !syncOn;
    this.classList.toggle('on', syncOn);
  };

  state.editorEl.addEventListener('scroll', () => syncFrom(state.editorEl, state.prevScroll));
  state.prevScroll.addEventListener('scroll', () => syncFrom(state.prevScroll, state.editorEl));

  initFindReplace();
  initTablePicker();
  initPaneSeg();
}

function typewrite() {
  if (!typewriter) return;
  const line = state.editorEl.value.slice(0, state.editorEl.selectionStart).split('\n').length;
  state.editorEl.scrollTo({
    top: Math.max(0, line * editorLineH() - state.editorEl.clientHeight / 2),
    behavior: 'smooth'
  });
}

function syncFrom(src, dst) {
  if (!syncOn || syncLock) return;
  syncLock = true;
  const r = src.scrollTop / Math.max(1, src.scrollHeight - src.clientHeight);
  dst.scrollTop = r * (dst.scrollHeight - dst.clientHeight);
  setTimeout(() => syncLock = false, 40);
}

function initFindReplace() {
  $('#btnFR').onclick = () => {
    const isOpen = $('#frBar').classList.toggle('open');
    if (isOpen) $('#frFind').focus();
  };
  $('#frClose').onclick = () => $('#frBar').classList.remove('open');

  const frCountAll = () => {
    const q = $('#frFind').value;
    if (!q) return 0;
    return state.editorEl.value.split(q).length - 1;
  };
  const frShow = () => {
    const n = frCountAll();
    $('#frCount').textContent = n ? n + ' found' : 'no matches';
  };

  $('#frFind').addEventListener('input', frShow);

  function frNext() {
    const q = $('#frFind').value;
    if (!q) return;
    const v = state.editorEl.value;
    let idx = v.indexOf(q, state.editorEl.selectionEnd);
    if (idx === -1) idx = v.indexOf(q);
    if (idx === -1) return;
    state.editorEl.focus();
    state.editorEl.selectionStart = idx;
    state.editorEl.selectionEnd = idx + q.length;
    const line = v.slice(0, idx).split('\n').length;
    state.editorEl.scrollTop = Math.max(0, (line - 1) * editorLineH() - state.editorEl.clientHeight / 3);
  }

  $('#frFind').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); frNext(); }
  });
  $('#frNext').onclick = frNext;

  $('#frOne').onclick = () => {
    const q = $('#frFind').value;
    const r = $('#frRepl').value;
    if (!q) return;
    const sel = state.editorEl.value.slice(state.editorEl.selectionStart, state.editorEl.selectionEnd);
    if (sel === q) insertAtCursor(r);
    frNext();
    frShow();
  };

  $('#frAll').onclick = () => {
    const q = $('#frFind').value;
    const r = $('#frRepl').value;
    if (!q) return;
    state.editorEl.value = state.editorEl.value.split(q).join(r);
    afterEdit();
    frShow();
  };
}

function initTablePicker() {
  const grid = $('#tblGrid');
  let rows = 2, cols = 3;

  for (let r = 1; r <= 5; r++) {
    for (let c = 1; c <= 6; c++) {
      const i = document.createElement('i');
      i.dataset.r = r;
      i.dataset.c = c;
      i.addEventListener('mouseenter', () => { rows = r; cols = c; paint(); });
      i.addEventListener('click', () => {
        let md = '\n| ' + Array.from({ length: cols }, (_, k) => 'Col ' + (k + 1)).join(' | ') + ' |\n';
        md += '| ' + Array(cols).fill('---').join(' | ') + ' |\n';
        for (let k = 0; k < rows; k++) {
          md += '| ' + Array(cols).fill('   ').join(' | ') + ' |\n';
        }
        insertAtCursor(md);
        $('#tblPicker').classList.remove('open');
      });
      grid.appendChild(i);
    }
  }

  function paint() {
    $('#tblSize').textContent = rows + ' × ' + cols;
    $$('#tblGrid i').forEach(i => {
      i.classList.toggle('sel', +i.dataset.r <= rows && +i.dataset.c <= cols);
    });
  }
  paint();
}

function initPaneSeg() {
  $$('#paneSeg button').forEach(b => {
    b.onclick = () => {
      document.body.dataset.pane = b.dataset.pane;
      $$('#paneSeg button').forEach(x => {
        const isOn = x === b;
        x.classList.toggle('on', isOn);
        x.setAttribute('aria-selected', isOn);
      });
    };
  });
}
