// Breadcrumbs, minimap, reading progress bar, scroll persistence
import { state, $, esc, debounce } from './state.js';
import { upsertFile } from './storage.js';

let crumbData = [];

export function initNavigation() {
  // Minimap: click or drag to teleport through the document
  const mm = $('#minimap');
  let drag = false;

  const go = e => {
    const r = mm.getBoundingClientRect();
    const ratio = (e.clientY - r.top) / r.height;
    state.scrollArea.scrollTop = ratio * (state.scrollArea.scrollHeight - state.scrollArea.clientHeight);
  };

  mm.addEventListener('mousedown', e => {
    drag = true;
    go(e);
  });
  window.addEventListener('mousemove', e => {
    if (drag) go(e);
  });
  window.addEventListener('mouseup', () => drag = false);

  // Re-measure on window resize
  window.addEventListener('resize', debounce(measureNav, 200));

  // Scroll tracking: progress bar + crumbs + persist position to library
  state.scrollArea.addEventListener('scroll', () => {
    requestAnimationFrame(updateReadProgress);
    if (!state.editing) {
      state.scroll = state.scrollArea.scrollTop;
      persistScroll();
    }
  }, { passive: true });

  // Back-to-top button
  $('#toTop').onclick = () => state.scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Cache heading positions + rebuild minimap ticks. Call after every render. */
export function measureNav() {
  crumbData = [];
  const sTop = state.scrollArea.scrollTop;
  const sRect = state.scrollArea.getBoundingClientRect();

  state.docEl.querySelectorAll('h1, h2, h3').forEach(h => {
    const top = h.getBoundingClientRect().top - sRect.top + sTop;
    crumbData.push({
      id: h.id,
      lv: +h.tagName[1],
      text: h.textContent.replace(/#$/, '').trim(),
      top
    });
  });

  buildMinimap(sRect, sTop);
}

/** Sticky breadcrumb trail showing the current section path. */
export function updateCrumbs() {
  const c = $('#crumbs');

  if (state.editing || document.body.classList.contains('focus')) {
    c.classList.remove('show');
    return;
  }

  const pos = state.scrollArea.scrollTop + 120;
  let cur = -1;
  for (let i = 0; i < crumbData.length; i++) {
    if (crumbData[i].top <= pos) cur = i;
    else break;
  }

  if (cur < 0 || state.scrollArea.scrollTop < 180) {
    c.classList.remove('show');
    return;
  }

  // Build path: current heading + nearest ancestors of each higher level
  const path = [crumbData[cur]];
  let need = crumbData[cur].lv;
  for (let i = cur - 1; i >= 0 && need > 1; i--) {
    if (crumbData[i].lv < need) {
      path.unshift(crumbData[i]);
      need = crumbData[i].lv;
    }
  }

  c.innerHTML = path
    .map(p => '<span data-id="' + p.id + '">' + esc(p.text) + '</span>')
    .join('<i>▸</i>');
  c.classList.add('show');

  c.querySelectorAll('span').forEach(sp => {
    sp.onclick = () => {
      state.lastJump = state.scrollArea.scrollTop;   // allow Ctrl+[ to jump back
      document.getElementById(sp.dataset.id)?.scrollIntoView({ behavior: 'smooth' });
    };
  });
}

/** Draw one tick per top-level block on the minimap strip. */
function buildMinimap(sRect, sTop) {
  const mm = $('#minimap');
  mm.querySelectorAll('.tick').forEach(t => t.remove());

  const total = state.scrollArea.scrollHeight;
  if (total < 400) return;

  let n = 0;
  [...state.docEl.children].forEach(el => {
    if (n > 220) return;

    const top = el.getBoundingClientRect().top - sRect.top + sTop;
    const t = document.createElement('div');
    const tag = el.tagName;

    // Headings pink, code blocks dark, everything else gray
    t.className = 'tick' + (/^H[12]$/.test(tag) ? ' th' : (/^(PRE|DIV)$/.test(tag) ? ' tc' : ''));
    t.style.top = (top / total * 100) + '%';
    t.style.height = Math.max(2, Math.min(14, el.offsetHeight / total * 100)) + '%';

    mm.appendChild(t);
    n++;
  });

  updateMMThumb();
}

/** Move the viewport thumb on the minimap. */
export function updateMMThumb() {
  const th = $('#mmThumb');
  const total = state.scrollArea.scrollHeight;
  if (!total) return;

  th.style.top = (state.scrollArea.scrollTop / total * 100) + '%';
  th.style.height = Math.max(6, state.scrollArea.clientHeight / total * 100) + '%';
}

/** Progress bar + "% read / minutes left" + toTop visibility + crumbs. */
export function updateReadProgress() {
  const max = state.scrollArea.scrollHeight - state.scrollArea.clientHeight;
  const pct = max > 0 ? Math.round(state.scrollArea.scrollTop / max * 100) : 0;

  $('#progress').style.transform = 'scaleX(' + (max > 0 ? state.scrollArea.scrollTop / max : 0) + ')';

  const words = (state.md.trim().match(/\S+/g) || []).length;
  const left = Math.max(0, Math.ceil(words / 220 * (1 - state.scrollArea.scrollTop / Math.max(1, max))));

  if (!state.editing) {
    $('#stProg').textContent = pct + '% read' + (pct > 0 && pct < 100 ? ' · ~' + left + 'm left' : '');
  }

  $('#toTop').classList.toggle('show', state.scrollArea.scrollTop > 600);
  updateCrumbs();
  updateMMThumb();
}

/** Debounced write of the scroll position into the current library file. */
const persistScroll = debounce(() => {
  if (state.fileId) {
    upsertFile({ id: state.fileId, scroll: state.scroll });
  }
}, 800);