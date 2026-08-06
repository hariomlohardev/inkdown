// Post-render DOM decoration (code boxes, tables, headings)
import { ICON_COPY } from './state.js';

export function decorate(el) {
  // External links open in new tab
  el.querySelectorAll('a[href^="http"]').forEach(a => {
    a.target = '_blank';
    a.rel = 'noopener';
  });

  // Headings get IDs + anchor links
  const used = {};
  el.querySelectorAll('h1, h2, h3, h4').forEach(h => {
    let base = h.textContent.trim().toLowerCase()
      .replace(/[^\w\u00C0-\uFFFF -]/g, '').replace(/\s+/g, '-') || 'section';
    used[base] = (used[base] || 0) + 1;
    const id = used[base] > 1 ? base + '-' + used[base] : base;
    h.id = id;
    const a = document.createElement('a');
    a.className = 'hlink';
    a.href = '#' + id;
    a.textContent = '#';
    h.appendChild(a);
  });

  // Task lists
  el.querySelectorAll('li').forEach(li => {
    if (li.querySelector(':scope > input[type="checkbox"]')) li.classList.add('task');
  });

  // Tables wrap for horizontal scroll
  el.querySelectorAll('table').forEach(t => {
    if (!t.parentElement.classList.contains('tableWrap')) {
      const w = document.createElement('div');
      w.className = 'tableWrap';
      t.replaceWith(w);
      w.appendChild(t);
    }
  });

  // Code blocks: wrap in a pretty box
  el.querySelectorAll('pre').forEach(pre => {
    const code = pre.querySelector('code');
    if (!code) return;
    if (window.hljs) {
      try { hljs.highlightElement(code); } catch (e) {}
    }
    const lang = (code.className.match(/language-([\w+#-]+)/) || [])[1] || 'text';
    const box = document.createElement('div');
    box.className = 'codebox';
    const head = document.createElement('div');
    head.className = 'codehead';
    const lbl = document.createElement('span');
    lbl.className = 'clang';
    lbl.textContent = lang;
    const btn = document.createElement('button');
    btn.className = 'ccopy';
    btn.innerHTML = ICON_COPY + '<span>Copy</span>';
    btn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(code.innerText);
        btn.classList.add('ok');
        btn.querySelector('span').textContent = 'Copied!';
        setTimeout(() => {
          btn.classList.remove('ok');
          btn.querySelector('span').textContent = 'Copy';
        }, 1400);
      } catch (e) {}
    };
    head.append(lbl, btn);
    pre.replaceWith(box);
    box.append(head, pre);
  });

  el.querySelectorAll('img').forEach(im => im.loading = 'lazy');
}
