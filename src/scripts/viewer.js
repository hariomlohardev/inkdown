// Image viewer with zoom/pan
import { $ } from './state.js';

let ivScale = 1, ivX = 0, ivY = 0, ivDrag = null;

export function initViewer() {
  $('#imgView').addEventListener('wheel', e => {
    e.preventDefault();
    ivScale = Math.min(5, Math.max(0.4, ivScale * (e.deltaY < 0 ? 1.15 : 0.87)));
    ivApply();
  }, { passive: false });

  $('#imgView').addEventListener('dblclick', () => {
    ivScale = 1; ivX = ivY = 0; ivApply();
  });

  $('#imgView').addEventListener('pointerdown', e => {
    if (ivScale > 1) ivDrag = { x: e.clientX - ivX, y: e.clientY - ivY };
  });

  window.addEventListener('pointermove', e => {
    if (ivDrag) {
      ivX = e.clientX - ivDrag.x;
      ivY = e.clientY - ivDrag.y;
      ivApply();
    }
  });

  window.addEventListener('pointerup', () => ivDrag = null);

  $('#imgView').addEventListener('click', e => {
    if (!ivDrag || Math.abs(ivX) < 4) $('#imgView').classList.remove('open');
  });

  // Attach openImg to state.docEl click for images (handled in highlight.js)
  state_docEl_imgHandler();
}

function state_docEl_imgHandler() {
  import('./state.js').then(({ state }) => {
    state.docEl.addEventListener('click', e => {
      const img = e.target.closest('img');
      if (img) openImg(img.src);
    });
  });
}

export function openImg(src) {
  const v = $('#imgView');
  const im = $('#imgBig');
  im.src = src;
  ivScale = 1; ivX = ivY = 0;
  im.style.transform = '';
  v.classList.add('open');
}

function ivApply() {
  $('#imgBig').style.transform = 'translate(' + ivX + 'px, ' + ivY + 'px) scale(' + ivScale + ')';
}
