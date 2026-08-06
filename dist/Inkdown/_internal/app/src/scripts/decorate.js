import { state, ICON_COPY } from './state.js';
import { openChart } from './chart.js';

export function decorate(el) {
  el.querySelectorAll('a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });

  const used = {};
  el.querySelectorAll('h1, h2, h3, h4').forEach(h => {
    let base = h.textContent.trim().toLowerCase()
      .replace(/[^\w\u00C0-\uFFFF -]/g, '').replace(/\s+/g, '-') || 'section';
    used[base] = (used[base] || 0) + 1;
    const id = used[base] > 1 ? base + '-' + used[base] : base;
    h.id = id;
    const a = document.createElement('a');
    a.className = 'hlink'; a.href = '#' + id; a.textContent = '#';
    h.appendChild(a);
  });

  el.querySelectorAll('li').forEach(li => {
    if (li.querySelector(':scope > input[type="checkbox"]')) li.classList.add('task');
  });

  // Tables → wrap for scroll, then add chart button
  el.querySelectorAll('table').forEach(t => {
    if (!t.parentElement.classList.contains('tableWrap')) {
      const w = document.createElement('div');
      w.className = 'tableWrap';
      t.replaceWith(w);
      w.appendChild(t);
    }
  });
  addChartButtons(el);

  // Code blocks (with line numbers + {3,5-7} highlight)
  const pres = [...el.querySelectorAll('pre')];
  pres.forEach((pre, idx) => {
    const code = pre.querySelector('code');
    if (!code) return;
    if (window.hljs) { try { hljs.highlightElement(code); } catch (e) {} }
    const lang = (code.className.match(/language-([\w+#-]+)/) || [])[1] || 'text';
    enhanceCode(code, state.codeHl[idx] || '', state.showLineNumbers);

    const box = document.createElement('div'); box.className = 'codebox';
    const head = document.createElement('div'); head.className = 'codehead';
    const lbl = document.createElement('span'); lbl.className = 'clang'; lbl.textContent = lang;
    const btn = document.createElement('button');
    btn.className = 'ccopy';
    btn.innerHTML = ICON_COPY + '<span>Copy</span>';
    btn.onclick = async () => {
      try { await navigator.clipboard.writeText(code.innerText); } catch (e) {}
      btn.classList.add('ok');
      btn.querySelector('span').textContent = 'Copied!';
      setTimeout(() => { btn.classList.remove('ok'); btn.querySelector('span').textContent = 'Copy'; }, 1400);
    };
    head.append(lbl, btn);
    pre.replaceWith(box);
    box.append(head, pre);
  });

  applyCallouts(el);
  applyFigures(el);

  el.querySelectorAll('img').forEach(im => im.loading = 'lazy');
}

/* ---- line numbers + highlight ranges ---- */
function parseRanges(str) {
  const set = new Set();
  if (!str) return set;
  str.split(',').forEach(part => {
    part = part.trim();
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { for (let n = +m[1]; n <= +m[2]; n++) set.add(n); }
    else if (/^\d+$/.test(part)) set.add(+part);
  });
  return set;
}
function enhanceCode(code, rangesStr, withNumbers) {
  const set = parseRanges(rangesStr);
  if (!set.size && !withNumbers) return;
  const lines = code.innerHTML.split('\n');
  code.classList.add('lined');
  if (withNumbers) code.classList.add('numbered');
  code.innerHTML = lines.map((ln, i) => {
    const mark = set.has(i + 1) ? ' mark' : '';
    return '<span class="cl' + mark + '"><span class="ln">' + (i + 1) + '</span><span class="lc">' + (ln || ' ') + '</span></span>';
  }).join('');
  if (rangesStr) code.setAttribute('data-hl', rangesStr);
}

/* ---- GitHub-style callouts ---- */
function applyCallouts(el) {
  const ICONS = { NOTE:'ℹ️', TIP:'💡', IMPORTANT:'❗', WARNING:'⚠️', CAUTION:'🛑' };
  el.querySelectorAll('blockquote').forEach(bq => {
    const p = bq.querySelector('p');
    if (!p) return;
    const m = p.textContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
    if (!m) return;
    const type = m[1].toUpperCase();
    p.innerHTML = p.innerHTML.replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(<br\s*\/?>)?/i, '');
    if (!p.textContent.trim() && !p.querySelector('img')) p.remove();
    bq.classList.add('callout', 'callout-' + type.toLowerCase());
    const lbl = document.createElement('div');
    lbl.className = 'callout-label';
    lbl.innerHTML = '<span class="callout-ico">' + ICONS[type] + '</span><span>' +
      type.charAt(0) + type.slice(1).toLowerCase() + '</span>';
    bq.prepend(lbl);
  });
}

/* ---- image captions + =NN% sizing ---- */
function applyFigures(el) {
  el.querySelectorAll('img').forEach(img => {
    let src = img.getAttribute('src') || '';
    const sm = src.match(/\s+=\s*(\d{1,3})%\s*$/);
    if (sm) {
      img.style.width = sm[1] + '%';
      img.setAttribute('src', src.replace(/\s+=\s*\d{1,3}%\s*$/, ''));
    }
    const alt = (img.getAttribute('alt') || '').trim();
    if (alt) {
      const fig = document.createElement('figure');
      const cap = document.createElement('figcaption');
      cap.textContent = alt;
      img.replaceWith(fig);
      fig.append(img, cap);
    }
  });
}

/* ---- chart button on tables ---- */
function hasNumericCol(table) {
  const rows = [...table.querySelectorAll('tr')].slice(1);
  for (const r of rows) {
    const cells = [...r.querySelectorAll('td')].slice(1);
    if (cells.some(c => parseFloat(c.textContent.replace(/[^\d.\-]/g, '')) !== undefined &&
                        !isNaN(parseFloat(c.textContent.replace(/[^\d.\-]/g, ''))))) return true;
  }
  return false;
}
function addChartButtons(el) {
  el.querySelectorAll('.tableWrap').forEach(wrap => {
    if (wrap.querySelector('.chartBtn')) return;
    const table = wrap.querySelector('table');
    if (!table || !hasNumericCol(table)) return;
    const btn = document.createElement('button');
    btn.className = 'chartBtn';
    btn.textContent = '📊 Chart';
    btn.onclick = () => openChart(table);
    wrap.appendChild(btn);
  });
}