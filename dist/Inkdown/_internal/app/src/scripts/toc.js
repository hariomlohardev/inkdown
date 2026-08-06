// Contents table
import { state, $, $$, rememberJump } from './state.js';

const tocState = { level: 'all', q: '' };
let tocIO = null;

export function initTOC() {
  $('#tocSearch').addEventListener('input', e => {
    tocState.q = e.target.value.trim().toLowerCase();
    applyTocFilter();
  });

  $$('#tocFilters .chip').forEach(c => {
    c.onclick = () => {
      tocState.level = c.dataset.lv;
      $$('#tocFilters .chip').forEach(x => {
        const isOn = x === c;
        x.classList.toggle('on', isOn);
        x.setAttribute('aria-pressed', isOn);
      });
      applyTocFilter();
    };
  });

  const syncTocBtn = () => {
    const isOpen = document.body.classList.contains('toc-open');
    $('#btnToc').classList.toggle('active', isOpen);
    $('#btnToc').setAttribute('aria-expanded', isOpen);
  };

  $('#btnToc').onclick = () => {
    document.body.classList.toggle('toc-open');
    syncTocBtn();
  };

  if (innerWidth > 1000) {
    document.body.classList.add('toc-open');
    syncTocBtn();
  }

  // Remember syncTocBtn on state for external access
  state._syncTocBtn = syncTocBtn;
}

export function buildTOC(el) {
  const list = $('#tocList');
  list.innerHTML = '';
  if (tocIO) tocIO.disconnect();

  const hs = [...el.querySelectorAll('h1, h2, h3, h4')].slice(0, 80);
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  hs.forEach(h => counts[+h.tagName[1]]++);

  $$('#tocFilters .chip').forEach(c => {
    const lv = c.dataset.lv;
    c.textContent = lv === 'all' ? 'ALL ' + hs.length : 'H' + lv + ' ' + counts[+lv];
  });

  hs.forEach((h, idx) => {
    const lv = +h.tagName[1];
    const next = hs[idx + 1];
    const isParent = next && +next.tagName[1] > lv;
    const title = h.textContent.replace(/#$/, '').trim();

    const li = document.createElement('li');
    li.dataset.lv = lv;
    li.dataset.target = h.id;
    li.dataset.txt = title.toLowerCase();
    li.dataset.hid = h.id;

    const car = document.createElement('span');
    car.className = 'tcaret ' + (isParent ? (state.collapsed.has(h.id) ? 'fold' : 'open') : 'blank');
    car.textContent = '▶';
    if (isParent) {
      car.onclick = e => {
        e.stopPropagation();
        if (state.collapsed.has(h.id)) state.collapsed.delete(h.id);
        else state.collapsed.add(h.id);
        buildTOC(el);
      };
    }

    const lvl = document.createElement('span');
    lvl.className = 'lvl';
    lvl.textContent = 'H' + lv;

    const ttl = document.createElement('span');
    ttl.className = 'ttl';
    ttl.textContent = title;
    ttl.title = title;

    const handleClick = () => {
      rememberJump();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (innerWidth <= 880) {
        document.body.classList.remove('toc-open');
        state._syncTocBtn?.();
      }
    };
    ttl.onclick = handleClick;

    li.append(car, lvl, ttl);
    list.appendChild(li);
  });

  applyTocFilter();

  tocIO = new IntersectionObserver(es => {
    es.forEach(en => { if (en.isIntersecting) setActiveToc(en.target.id); });
  }, { root: state.scrollArea, rootMargin: '-8% 0px -78% 0px' });
  hs.forEach(h => tocIO.observe(h));
}

function applyTocFilter() {
  const rows = $$('#tocList li');
  let visible = 0;
  const collapsedStack = [];

  rows.forEach(li => {
    const lv = +li.dataset.lv;
    while (collapsedStack.length && collapsedStack[collapsedStack.length - 1].lv >= lv) {
      collapsedStack.pop();
    }
    const hiddenByCollapse = collapsedStack.some(c => c.closed);
    if (!hiddenByCollapse) {
      const isCollapsedParent = state.collapsed.has(li.dataset.hid);
      collapsedStack.push({ lv, closed: isCollapsedParent });
    }
    const okLv = tocState.level === 'all' || li.dataset.lv === tocState.level;
    const okQ = !tocState.q || li.dataset.txt.includes(tocState.q);
    const show = okLv && okQ && !hiddenByCollapse;
    li.style.display = show ? '' : 'none';
    if (show) visible++;
  });

  $('#tocEmpty').style.display = (rows.length && !visible) ? 'block' : 'none';
  $('#tocMeta').textContent = visible + ' / ' + rows.length;
}

function setActiveToc(id) {
  $$('#tocList li').forEach(li => li.classList.remove('active'));
  const li = $('#tocList li[data-target="' + CSS.escape(id) + '"]');
  if (li && li.style.display !== 'none') {
    li.classList.add('active');
    li.scrollIntoView({ block: 'nearest' });
  }
}
