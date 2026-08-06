// Breadcrumbs, minimap, progress bar
import { state, $, debounce } from './state.js';

let crumbData = [];

export function initNavigation() {
  // Minimap drag
  const mm = $('#minimap');
  let drag = false;
  const go = e => {
    const r = mm.getBoundingClientRect();
    const ratio = (e.clientY - r.top) / r.height;
    state.scrollArea.scrollTop = ratio * (state.scrollArea.scrollHeight - state.scrollArea.clientHeight);
  };
  mm.addEventListener('mousedown', e => { drag = true; go(e); });
  window.addEventListener('mousemove', e => { if (drag) go(e); });
  window.addEventListener('mouseup', () => drag = false);

  window.addEventListener('resize', debounce(measureNav, 200));

  state.scrollArea.addEventListener('scroll', () => {
    requestAnimationFrame(updateReadProgress);
    if (!state.editing) {
      state.scroll = state.scrollArea.scrollTop;
      persistScroll();
    }
  }, { passive: true });

  $('#toTop').onclick = () => state.scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
}

export function measureNav() {
  crumbData = [];
  const sTop = state.scrollArea.scrollTop;
  const sRect = state.scrollArea.getBoundingClientRect();

  state.docEl.querySelectorAll('h1, h2, h3').forEach(h => {
    const top = h.getBoundingClientRect().top - sRect.top + sTop;
    crumbData.push({
      id: h.id, lv: +h.tagName[1],
      text: h.textContent.replace(/#$/, '').trim(), top
    });
  });
  buildMinimap(sRect, sTop);
}

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
  const path = [crumbData[cur]];
  let need = crumbData[cur].lv;
  for (let i = cur - 1; i >= 0 && need > 1; i--) {
    if (crumbData[i].lv < need) {
      path.unshift(crumbData[i]);
      need = crumbData[i].lv;
    }
  }

  const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  c.innerHTML = path.map(p => '<span data-id="' + p.id + '">' + esc(p.text) + '</span>').join('<i>▸</i>');
  c.classList.add('show');
  c.querySelectorAll('span').forEach(sp => {
    sp.onclick = () => {
      state.lastJump = state.scrollArea.scrollTop;
      document.getElementById(sp.dataset.id)?.scrollIntoView({ behavior: 'smooth' });
    };
  });
}

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
    t.className = 'tick' + (/^H[12]$/.test(tag) ? ' th' : (/^(PRE|DIV)$/.test(tag) ? ' tc' : ''));
    t.style.top = (top / total * 100) + '%';
    t.style.height = Math.max(2, Math.min(14, el.offsetHeight / total * 100)) + '%';
    mm.appendChild(t);
    n++;
  });
  updateMMThumb();
}

export function updateMMThumb() {
  const th = $('#mmThumb');
  const total = state.scrollArea.scrollHeight;
  if (!total) return;
  th.style.top = (state.scrollArea.scrollTop / total * 100) + '%';
  th.style.height = Math.max(6, state.scrollArea.clientHeight / total * 100) + '%';
}

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

const persistScroll = debounce(() => {
  try {
    const rec = JSON.parse(localStorage.getItem('inkdown:doc') || '{}');
    if (rec.name === state.name) {
      rec.scroll = state.scroll;
      localStorage.setItem('inkdown:doc', JSON.stringify(rec));
    }
  } catch (e) {}
}, 800);
