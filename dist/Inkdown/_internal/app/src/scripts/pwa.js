import { $ } from './state.js';

export function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = $('#installBtn');
    if (btn) btn.hidden = false;
  });
  const btn = $('#installBtn');
  if (btn) {
    btn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        btn.hidden = true;
      } else {
        btn.textContent = 'Use browser menu → Install';
        setTimeout(() => { btn.textContent = '⬇ Install app'; }, 2500);
      }
    });
  }
}