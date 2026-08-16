// Lint, versions, word goal
import { state, $, esc, debounce } from './state.js';
import { pushVersion, getVersions } from './storage.js';
import { setEditing } from './ui.js';

export function initQuality() {
  $('#btnLint').onclick = e => {
    e.stopPropagation();
    const isOpen = $('#lintPanel').classList.contains('open');
    document.querySelectorAll('.menu, .pop').forEach(m => m.classList.remove('open'));
    $('#lintPanel').classList.toggle('open', !isOpen);
    if (!isOpen) renderLint(lint(state.md));
  };

  $('#btnVer').onclick = e => {
    e.stopPropagation();
    const isOpen = $('#verPanel').classList.contains('open');
    document.querySelectorAll('.menu, .pop').forEach(m => m.classList.remove('open'));
    $('#verPanel').classList.toggle('open', !isOpen);
    if (!isOpen) renderVersions();
  };

  $('#btnGoal').onclick = () => {
    const cur = state.goal || '';
    const val = prompt('Word goal for this document (leave blank to clear):', cur);
    if (val === null) return;
    state.goal = Math.max(0, parseInt(val) || 0);
    markDirtyLocal();
    updateStats();
  };

  // Hook into editor input
  state.editorEl.addEventListener('input', () => lintDebounced());
}

function markDirtyLocal() {
  state.dirty = true;
  $('#saveDot').classList.add('dirty');
  $('#saveTxt').textContent = 'Unsaved changes';
}

export function lint(md) {
  const issues = [];
  const lines = md.split('\n');
  let fence = false;
  const h1s = [];
  let prevLv = 0;
  lines.forEach((l, i) => {
    const n = i + 1;
    if (/^```/.test(l.trim())) { fence = !fence; return; }
    if (fence) return;
    const h = l.match(/^(#{1,6})\s*(.*)$/);
    if (h) {
      const lv = h[1].length;
      if (!h[2].trim()) issues.push({ line: n, msg: 'Empty heading' });
      if (lv === 1) h1s.push(n);
      if (prevLv && lv > prevLv + 1) issues.push({ line: n, msg: 'Heading jumps from H' + prevLv + ' to H' + lv });
      prevLv = lv;
    }
    if (/\[\]\(/.test(l)) issues.push({ line: n, msg: 'Link with empty text' });
    if (/\[[^\]]+\]\(\s*\)/.test(l)) issues.push({ line: n, msg: 'Link with empty URL' });
    if (/!\[\]\(/.test(l)) issues.push({ line: n, msg: 'Image missing alt text' });
    if (/\t/.test(l)) issues.push({ line: n, msg: 'Tab character — use spaces' });
  });
  if (fence) issues.push({ line: lines.length, msg: 'Unclosed code fence' });
  if (h1s.length > 1) issues.push({ line: h1s[1], msg: 'Multiple H1 titles (' + h1s.length + ')' });
  return issues.sort((a, b) => a.line - b.line);
}

export const lintDebounced = debounce(() => {
  const issues = lint(state.md);
  const bdg = $('#lintBdg');
  bdg.style.display = issues.length ? 'grid' : 'none';
  bdg.textContent = issues.length;
  if ($('#lintPanel').classList.contains('open')) renderLint(issues);
}, 500);

function renderLint(issues) {
  const p = $('#lintPanel');
  p.innerHTML = '<div class="popTitle">Document health <b>' +
    (issues.length ? issues.length + ' issue' + (issues.length > 1 ? 's' : '') : 'all clear') +
    '</b></div>' +
    (issues.length
      ? issues.map(x => '<button class="lintRow" data-line="' + x.line + '"><span class="ln">L' + x.line + '</span><span>' + esc(x.msg) + '</span></button>').join('')
      : '<div class="popEmpty">✓ Nothing wrong. Ship it. 🚀</div>');
  p.querySelectorAll('.lintRow').forEach(r => {
    r.onclick = () => goToLine(+r.dataset.line);
  });
}

function goToLine(line) {
  const lines = state.md.split('\n');
  let idx = 0;
  for (let i = 0; i < line - 1; i++) idx += lines[i].length + 1;
  if (!state.editing) setEditing(true);
  state.editorEl.focus();
  state.editorEl.selectionStart = idx;
  state.editorEl.selectionEnd = idx + (lines[line - 1] || '').length;
}

function renderVersions() {
  const p = $('#verPanel');
  const arr = getVersions();
  p.innerHTML = '<div class="popTitle">Version history <b>' + arr.length + ' snapshots</b></div>' +
    (arr.length
      ? arr.map((v, i) => {
          const words = (v.md.trim().match(/\S+/g) || []).length;
          const t = new Date(v.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          return '<div class="verRow"><span class="vn">' + t + ' · ' + words + 'w</span><span class="vt">' + esc(v.md.trim().split('\n')[0].slice(0, 40)) + '</span><button class="vr" data-i="' + i + '">RESTORE</button><button class="vd" data-i="' + i + '">DIFF</button></div>';
        }).join('') + '<div id="verDiff" class="verDiff" hidden></div>'
      : '<div class="popEmpty">Snapshots appear here each time you save.</div>');
  p.querySelectorAll('.vr').forEach(b => {
    b.onclick = () => {
      const arr2 = getVersions();
      const v = arr2[+b.dataset.i];
      if (!v) return;
      state.md = v.md;
      state.editorEl.value = v.md;
      state.editorEl.dispatchEvent(new Event('input'));
      $('#verPanel').classList.remove('open');
    };
  });
  p.querySelectorAll('.vd').forEach(b => {
    b.onclick = () => {
      const arr2 = getVersions();
      const v = arr2[+b.dataset.i];
      if (!v) return;
      showVerDiff(v.md, state.md);
    };
  });
}

function showVerDiff(oldMd, curMd) {
  const diffEl = $('#verDiff');
  if (!diffEl) return;
  diffEl.hidden = false;
  diffEl.innerHTML = '<div class="verDiffHead"><b>Diff vs current</b><button class="verDiffClose">✕</button></div><pre class="verDiffBody">' + esc(computeDiff(oldMd, curMd)) + '</pre>';
  diffEl.querySelector('.verDiffClose').onclick = () => { diffEl.hidden = true; diffEl.innerHTML = ''; };
  // Simple line diff: + added, - removed,   unchanged (first 100 lines)
  function computeDiff(a, b) {
    const aLines = a.split('\n');
    const bLines = b.split('\n');
    const aSet = new Set(aLines);
    const bSet = new Set(bLines);
    const out = [];
    const max = Math.max(aLines.length, bLines.length);
    let shown = 0;
    for (let i = 0; i < max && shown < 200; i++) {
      const al = aLines[i];
      const bl = bLines[i];
      if (al === bl) {
        if (shown < 100) out.push('  ' + (al || ''));
      } else {
        if (al !== undefined && !bSet.has(al)) { out.push('- ' + al); shown++; }
        if (bl !== undefined && !aSet.has(bl)) { out.push('+ ' + bl); shown++; }
      }
    }
    if (shown >= 200) out.push('… diff truncated at 200 lines');
    return out.join('\n') || '(no difference)';
  }
}

export function updateStats() {
  const words = (state.md.trim().match(/\S+/g) || []).length;
  const mins = Math.max(1, Math.ceil(words / 220));
  $('#stStats').innerHTML = '<b>' + words.toLocaleString() + '</b> words · ' +
    state.md.length.toLocaleString() + ' chars · ~' + mins + ' min';
  const g = $('#stGoal');
  if (state.goal > 0) {
    g.classList.add('show');
    const pct = Math.min(100, Math.round(words / state.goal * 100));
    $('#goalTxt').textContent = words + '/' + state.goal;
    $('#goalBar i').style.width = pct + '%';
  } else {
    g.classList.remove('show');
  }
}

export { pushVersion };
