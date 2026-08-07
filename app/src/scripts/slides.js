import { $ } from './state.js';
import { state } from './state.js';
import { toast } from './ui.js';

let slides = [];
let currentIndex = 0;

/* ---------- Parse markdown into slides ---------- */
function parseSlides(md) {
  if (!md || !md.trim()) return [];

  // Strategy 1: Split by ## headings
  let result = splitByHeading(md, /^##\s+/);
  if (result.length > 1) return result;

  // Strategy 2: Split by # headings
  result = splitByHeading(md, /^#\s+/);
  if (result.length > 1) return result;

  // Strategy 3: Split by --- horizontal rules
  result = splitByRule(md);
  if (result.length > 1) return result;

  // Strategy 4: Split by paragraphs (every ~5 paragraphs = 1 slide)
  result = splitByParagraphs(md);
  if (result.length > 1) return result;

  // Fallback: single slide
  const titleMatch = md.match(/^#\s+(.+)/m);
  return [{ title: titleMatch ? titleMatch[1].trim() : 'Presentation', content: md, isTitle: false }];
}

function splitByHeading(md, headingRegex) {
  const lines = md.split('\n');
  const slidesArr = [];
  let current = { title: '', lines: [], isTitle: false };
  let foundFirstHeading = false;

  for (const line of lines) {
    const headingMatch = line.match(headingRegex);

    if (headingMatch) {
      if (foundFirstHeading) {
        if (current.title || current.lines.some(l => l.trim())) {
          slidesArr.push({ title: current.title, content: current.lines.join('\n').trim(), isTitle: current.isTitle });
        }
        current = { title: line.replace(headingRegex, '').trim(), lines: [], isTitle: false };
      } else {
        // First heading becomes the title
        current.title = line.replace(headingRegex, '').trim();
        current.isTitle = true;
        foundFirstHeading = true;
      }
    } else {
      current.lines.push(line);
    }
  }

  if (current.title || current.lines.some(l => l.trim())) {
    slidesArr.push({ title: current.title, content: current.lines.join('\n').trim(), isTitle: current.isTitle });
  }

  return slidesArr;
}

function splitByRule(md) {
  const sections = md.split(/^---+$/m);
  if (sections.length <= 1) return [];
  return sections.map((s, i) => {
    const trimmed = s.trim();
    const titleMatch = trimmed.match(/^#+\s+(.+)/m);
    return {
      title: titleMatch ? titleMatch[1].trim() : (i === 0 ? 'Introduction' : ''),
      content: trimmed,
      isTitle: i === 0
    };
  }).filter(s => s.content.trim());
}

function splitByParagraphs(md) {
  const paragraphs = md.split(/\n\s*\n/).filter(p => p.trim());
  if (paragraphs.length <= 3) return [];

  const slidesArr = [];
  const perSlide = Math.max(2, Math.ceil(paragraphs.length / Math.min(8, paragraphs.length)));

  for (let i = 0; i < paragraphs.length; i += perSlide) {
    const chunk = paragraphs.slice(i, i + perSlide).join('\n\n');
    const titleMatch = chunk.match(/^#+\s+(.+)/m);
    slidesArr.push({
      title: titleMatch ? titleMatch[1].trim() : '',
      content: chunk,
      isTitle: i === 0 && !!titleMatch
    });
  }
  return slidesArr;
}

/* ---------- Render a single slide ---------- */
function renderSlide(index) {
  const frame = $('#slideContent');
  if (!frame || !slides[index]) return;

  const slide = slides[index];
  let html = '';

  if (slide.isTitle) {
    html += '<h1>' + escHtml(slide.title) + '</h1>';
    html += '<div class="accentBar"></div>';
    if (slide.content.trim()) {
      const contentWithoutTitle = slide.content.replace(/^#+\s+.+/m, '').trim();
      if (contentWithoutTitle) {
        html += '<div class="subtitle">' + renderMarkdown(contentWithoutTitle) + '</div>';
      }
    }
    frame.classList.add('titleSlide');
  } else {
    frame.classList.remove('titleSlide');
    if (slide.title) {
      html += '<h2>' + escHtml(slide.title) + '</h2>';
    }
    if (slide.content.trim()) {
      const contentWithoutTitle = slide.title
        ? slide.content.replace(new RegExp('^#+\\s+' + escapeRegex(slide.title) + '.*$', 'm'), '').trim()
        : slide.content;
      if (contentWithoutTitle) {
        html += renderMarkdown(contentWithoutTitle);
      }
    }
  }

  frame.innerHTML = html;
  frame.style.animation = 'none';
  void frame.offsetWidth;
  frame.style.animation = '';

  updateProgress();
  checkOverflow();
  setTimeout(checkOverflow, 350);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderMarkdown(md) {
  if (!window.marked) return escHtml(md);
  try {
    let html = marked.parse(md, { gfm: true, breaks: false });
    if (window.DOMPurify) html = DOMPurify.sanitize(html);
    return html;
  } catch (e) {
    return escHtml(md);
  }
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------- Overflow detection ---------- */
function checkOverflow() {
  const frame = $('#slideFrame');
  const content = $('#slideContent');
  const btn = $('#openFullSlide');
  if (!frame || !content || !btn) return;
  const overflows = content.scrollHeight > frame.clientHeight;
  frame.classList.toggle('overflow', overflows);
  btn.hidden = !overflows;
}

/* ---------- Full slide overlay ---------- */
function openFullSlide() {
  const overlay = $('#fullSlideOverlay');
  const content = $('#fullSlideContent');
  const slideContent = $('#slideContent');
  if (!overlay || !content || !slideContent) return;
  content.className = 'fullSlideContent slideContent';
  content.innerHTML = slideContent.innerHTML;
  overlay.hidden = false;
  overlay.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

function closeFullSlide() {
  const overlay = $('#fullSlideOverlay');
  if (overlay) overlay.hidden = true;
  document.body.style.overflow = '';
}

/* ---------- Navigation ---------- */
function nextSlide() { if (currentIndex < slides.length - 1) { currentIndex++; renderSlide(currentIndex); } }
function prevSlide() { if (currentIndex > 0) { currentIndex--; renderSlide(currentIndex); } }
function goToSlide(index) { if (index >= 0 && index < slides.length) { currentIndex = index; renderSlide(currentIndex); } }

function updateProgress() {
  const cur = $('#slidesCurrent');
  const tot = $('#slidesTotal');
  const fill = $('#slidesProgressFill');
  const dots = $('#slidesDots');
  const prev = $('#slidesPrev');
  const next = $('#slidesNext');

  if (cur) cur.textContent = currentIndex + 1;
  if (tot) tot.textContent = slides.length;
  if (fill) fill.style.width = ((currentIndex + 1) / slides.length * 100) + '%';
  if (prev) prev.disabled = currentIndex === 0;
  if (next) next.disabled = currentIndex === slides.length - 1;

  if (dots) {
    dots.innerHTML = '';
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      if (i === currentIndex) dot.classList.add('active');
      dot.title = 'Slide ' + (i + 1);
      dot.onclick = () => goToSlide(i);
      dots.appendChild(dot);
    });
  }
}

/* ---------- Show / hide slides ---------- */
export function showSlides() {
  const md = state.md;
  if (!md || !md.trim()) {
    toast('Nothing to present — open a document first', 'warn');
    return;
  }

  slides = parseSlides(md);
  currentIndex = 0;

  if (slides.length === 0) {
    toast('Could not create slides from this document', 'warn');
    return;
  }

  const titleEl = $('#slidesDocTitle');
  if (titleEl) titleEl.textContent = state.name || 'Presentation';

  document.body.dataset.view = 'slides';
  document.title = (state.name || 'Presentation') + ' — Slides';
  renderSlide(0);
}

export function exitSlides() {
  closeFullSlide();
  document.body.dataset.view = 'reader';
  document.title = state.name || 'Inkdown';
  hideContextMenu();
}

/* ---------- Context menu ---------- */
function showContextMenu(x, y) {
  const menu = $('#ctxMenu');
  if (!menu) return;
  menu.hidden = false;
  const mw = 220, mh = 80;
  menu.style.left = Math.min(x, innerWidth - mw - 10) + 'px';
  menu.style.top = Math.min(y, innerHeight - mh - 10) + 'px';
}

function hideContextMenu() {
  const menu = $('#ctxMenu');
  if (menu) menu.hidden = true;
}

/* ---------- Keyboard ---------- */
function onKeydown(e) {
  const fullOverlay = $('#fullSlideOverlay');
  if (fullOverlay && !fullOverlay.hidden) {
    if (e.key === 'Escape') { e.preventDefault(); closeFullSlide(); }
    return;
  }

  if (document.body.dataset.view !== 'slides') return;

  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); nextSlide(); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prevSlide(); }
  else if (e.key === 'Home') { e.preventDefault(); goToSlide(0); }
  else if (e.key === 'End') { e.preventDefault(); goToSlide(slides.length - 1); }
  else if (e.key === 'Escape') { e.preventDefault(); exitSlides(); }
  else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

/* ---------- Init ---------- */
export function initSlides() {
  // Right-click context menu — works in BOTH reader and slides views
  document.addEventListener('contextmenu', e => {
    const view = document.body.dataset.view;

    if (view === 'reader') {
      const doc = $('#doc');
      if (doc && doc.contains(e.target)) {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY);
        return;
      }
    }

    if (view === 'slides') {
      e.preventDefault();
      showSlidesContextMenu(e.clientX, e.clientY);
      return;
    }
  });

  // Hide context menu on click elsewhere
  document.addEventListener('click', e => {
    if (!e.target.closest('#ctxMenu') && !e.target.closest('#ctxMenuSlides')) {
      hideContextMenu();
      hideSlidesContextMenu();
    }
  });

  // Reader context menu action
  const ctxPresent = $('#ctxPresent');
  if (ctxPresent) ctxPresent.onclick = () => { hideContextMenu(); showSlides(); };

  // Slides controls
  const exit = $('#slidesExit'); if (exit) exit.onclick = exitSlides;
  const prev = $('#slidesPrev'); if (prev) prev.onclick = prevSlide;
  const next = $('#slidesNext'); if (next) next.onclick = nextSlide;
  const fs = $('#slidesFullscreen'); if (fs) fs.onclick = toggleFullscreen;

  const openFullBtn = $('#openFullSlide');
  if (openFullBtn) openFullBtn.onclick = openFullSlide;
  const fullClose = $('#fullSlideClose');
  if (fullClose) fullClose.onclick = closeFullSlide;

  // Click slide frame edges to navigate
  const stage = $('#slidesStage');
  if (stage) {
    stage.addEventListener('click', e => {
      if (e.target.closest('.slidesNav') || e.target.closest('.slideFrame') || e.target.closest('.openFullSlide')) return;
      const rect = stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 3) prevSlide();
      else if (x > rect.width * 2 / 3) nextSlide();
    });
  }

  document.addEventListener('keydown', onKeydown);

  window.addEventListener('resize', () => {
    if (document.body.dataset.view === 'slides') checkOverflow();
  });

  console.log('[Inkdown] Slides initialized');
}

/* ---------- Slides-page context menu ---------- */
function showSlidesContextMenu(x, y) {
  let menu = $('#ctxMenuSlides');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'ctxMenuSlides';
    menu.className = 'ctxMenu';
    menu.innerHTML = `
      <button class="ctxItem" id="ctxSlidesExit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Exit Slides
      </button>
      <button class="ctxItem" id="ctxSlidesFull">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        Toggle Fullscreen
      </button>
      <button class="ctxItem" id="ctxSlidesOpenFull">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        Open Full Slide
      </button>
    `;
    document.body.appendChild(menu);

    $('#ctxSlidesExit').onclick = () => { hideSlidesContextMenu(); exitSlides(); };
    $('#ctxSlidesFull').onclick = () => { hideSlidesContextMenu(); toggleFullscreen(); };
    $('#ctxSlidesOpenFull').onclick = () => { hideSlidesContextMenu(); openFullSlide(); };
  }

  menu.hidden = false;
  const mw = 220, mh = 140;
  menu.style.left = Math.min(x, innerWidth - mw - 10) + 'px';
  menu.style.top = Math.min(y, innerHeight - mh - 10) + 'px';
}

function hideSlidesContextMenu() {
  const menu = $('#ctxMenuSlides');
  if (menu) menu.hidden = true;
}