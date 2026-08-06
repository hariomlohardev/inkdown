// Markdown parsing pipeline
import { state } from './state.js';
import { isDark } from './theme.js';

const EMOJI = {
  rocket: '🚀', fire: '🔥', star: '⭐', star2: '🌟', sparkles: '✨', tada: '🎉',
  zap: '⚡', bulb: '💡', bug: '🐛', lock: '🔒', key: '🔑', book: '📖', books: '📚',
  memo: '📝', pencil2: '✏️', link: '🔗', hammer: '🔨', wrench: '🔧', gear: '⚙️',
  package: '📦', pushpin: '📌', warning: '⚠️', white_check_mark: '✅',
  heavy_check_mark: '✔️', x: '❌', question: '❓', exclamation: '❗', heart: '❤️',
  eyes: '👀', '100': '💯', thinking: '🤔', point_right: '👉', point_down: '👇',
  wave: '👋', clap: '👏', muscle: '💪', coffee: '☕', pizza: '🍕',
  globe_with_meridians: '🌐', computer: '💻', gem: '💎', crown: '👑', target: '🎯',
  chart_with_upwards_trend: '📈', test_tube: '🧪', shield: '🛡️', construction: '🚧',
  recycle: '♻️', robot: '🤖', boom: '💥'
};

function applyEmoji(md) {
  return md.split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g).map((seg, i) =>
    i % 2 ? seg : seg.replace(/:([a-z0-9_+-]+):/g, (m, w) => EMOJI[w] ?? m)
  ).join('');
}

function extractMermaid(md) {
  state.mmd = [];
  return md.replace(/```mermaid\r?\n([\s\S]*?)```/g, (m, c) => {
    state.mmd.push(c.trim());
    return '\n\n⟦MDI' + (state.mmd.length - 1) + '⟧\n\n';
  });
}

export function buildHTML(md) {
  if (!window.marked) return '<pre>' + md.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) + '</pre>';
  let src = applyEmoji(extractMermaid(md));
  let html = marked.parse(src, { gfm: true, breaks: false });
  if (window.DOMPurify) html = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
  state.mmd.forEach((_, i) => {
    html = html.replaceAll('<p>⟦MDI' + i + '⟧</p>', '<div class="mmd" data-mi="' + i + '"></div>')
               .replaceAll('⟦MDI' + i + '⟧', '<div class="mmd" data-mi="' + i + '"></div>');
  });
  return html;
}

export async function runMermaid(el) {
  el.querySelectorAll('.mmd').forEach(b => {
    const d = document.createElement('div');
    d.className = 'mermaid';
    d.textContent = state.mmd[+b.dataset.mi] || '';
    b.replaceWith(d);
  });
  const nodes = [...el.querySelectorAll('div.mermaid')];
  if (!nodes.length) return;
  if (window.mermaid) {
    try {
      mermaid.initialize({
        startOnLoad: false, securityLevel: 'loose',
        theme: isDark() ? 'dark' : 'neutral',
        themeVariables: {
          fontFamily: '"Bricolage Grotesque", sans-serif', accentColor: '#ff2e88',
          primaryColor: isDark() ? '#1a1a1a' : '#f4f4f4',
          primaryBorderColor: isDark() ? '#3a3a3a' : '#cfcfcf',
          primaryTextColor: isDark() ? '#f5f5f5' : '#0a0a0a',
          lineColor: isDark() ? '#8a8a8a' : '#8c8c8c'
        }
      });
      await mermaid.run({ nodes, suppressErrors: true });
    } catch (e) {}
    nodes.forEach(n => {
      if (!n.querySelector('svg')) {
        const p = document.createElement('pre');
        p.className = 'mmd-err';
        p.textContent = '⚠ mermaid: ' + n.textContent;
        n.replaceWith(p);
      }
    });
  } else {
    nodes.forEach(n => {
      const p = document.createElement('pre');
      p.className = 'mmd-err';
      p.textContent = n.textContent;
      n.replaceWith(p);
    });
  }
}

export function runMath(el) {
  if (!window.renderMathInElement) return;
  try {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false,
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option']
    });
  } catch (e) {}
}
