/**
 * Markdown rendering pipeline with ROBUST math support.
 * 
 * Pipeline:
 *   1. Pre-process: extract $$..$$ and $..$ blocks → safe placeholders
 *   2. Parse markdown with marked
 *   3. Restore math blocks WITH $$ and $ delimiters intact
 *   4. KaTeX renderMathInElement finds the delimiters and renders them
 */

import { esc } from './state.js';

// Safe placeholder markers (ASCII only, survives markdown parsing)
const MATH_PH_PREFIX = '@@INKDOWN_MATH_';
const MATH_PH_SUFFIX = '_END@@';


/* ---------- PRE-PROCESSING: Extract math before markdown ---------- */

function extractMath(md) {
  const store = [];
  let id = 0;

  // Step 1: Extract display math ($$...$$) — multi-line
  let out = md.replace(/\$\$([\s\S]+?)\$\$/g, (match, latex) => {
    const ph = MATH_PH_PREFIX + id + MATH_PH_SUFFIX;
    store.push({ id: id++, latex: latex.trim(), display: true });
    return '\n\n' + ph + '\n\n';  // Wrap in blank lines so marked treats it as a block
  });

  // Step 2: Extract inline math ($...$)
  out = out.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (match, latex) => {
    const ph = MATH_PH_PREFIX + id + MATH_PH_SUFFIX;
    store.push({ id: id++, latex: latex.trim(), display: false });
    return ph;
  });

  // Step 3: Handle \[...\] and \(...\) style
  out = out.replace(/\\\[([\s\S]+?)\\\]/g, (match, latex) => {
    const ph = MATH_PH_PREFIX + id + MATH_PH_SUFFIX;
    store.push({ id: id++, latex: latex.trim(), display: true });
    return '\n\n' + ph + '\n\n';
  });
  out = out.replace(/\\\(([\s\S]+?)\\\)/g, (match, latex) => {
    const ph = MATH_PH_PREFIX + id + MATH_PH_SUFFIX;
    store.push({ id: id++, latex: latex.trim(), display: false });
    return ph;
  });

  return { text: out, store };
}

/**
 * Restore math placeholders WITH $$ and $ delimiters.
 * This is the KEY fix — KaTeX needs the delimiters to find and render the math.
 */
function restoreMath(html, store) {
  const regex = new RegExp(MATH_PH_PREFIX.replace(/@/g, '@') + '(\\d+)' + MATH_PH_SUFFIX.replace(/@/g, '@'), 'g');

  return html.replace(regex, (match, idStr) => {
    const entry = store[parseInt(idStr)];
    if (!entry) return match;

    if (entry.display) {
      // Wrap in $$ so KaTeX auto-render finds it
      return '<div class="math-block">$$' + entry.latex + '$$</div>';
    } else {
      // Wrap in $ so KaTeX auto-render finds it
      return '<span class="math-inline">$' + entry.latex + '$</span>';
    }
  });
}


/* ---------- MAIN BUILD PIPELINE ---------- */

export function buildHTML(md) {
  if (!md) return '';
  if (!window.marked) return escapeHtml(md);

  // 1. Extract math before markdown parsing
  const { text, store } = extractMath(md);

  // 2. Configure marked
  if (!window._markedConfigured) {
    window.marked.setOptions({
      gfm: true,
      breaks: false,
      smartypants: false,
      headerIds: true,
      mangle: false
    });
    window._markedConfigured = true;
  }

  // 3. Parse markdown (placeholders are just text, marked won't touch them)
  let html = window.marked.parse(text);

  // 4. Sanitize (BEFORE restoring math, so DOMPurify doesn't eat our delimiters)
  if (window.DOMPurify) {
    html = window.DOMPurify.sanitize(html, {
      ADD_TAGS: ['div', 'span'],
      ADD_ATTR: ['class']
    });
  }

  // 5. Restore math blocks WITH delimiters
  html = restoreMath(html, store);

  return html;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}


/* ---------- KATEX RENDERING ---------- */

export function runMath(root) {
  if (!root) return;

  // Wait a tick for DOM to settle
  requestAnimationFrame(() => {
    if (!window.renderMathInElement) {
      console.warn('[Math] KaTeX auto-render not loaded');
      return;
    }

    try {
      window.renderMathInElement(root, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\begin{equation}', right: '\\end{equation}', display: true },
          { left: '\\begin{align}', right: '\\end{align}', display: true },
          { left: '\\begin{align*}', right: '\\end{align*}', display: true },
          { left: '\\begin{aligned}', right: '\\end{aligned}', display: true },
          { left: '\\begin{gather}', right: '\\end{gather}', display: true },
          { left: '\\begin{cases}', right: '\\end{cases}', display: true },
          { left: '\\begin{matrix}', right: '\\end{matrix}', display: true },
          { left: '\\begin{pmatrix}', right: '\\end{pmatrix}', display: true },
          { left: '\\begin{bmatrix}', right: '\\end{bmatrix}', display: true }
        ],

        throwOnError: false,
        errorColor: '#ff2e88',
        strict: false,

        trust: (context) => {
          return ['\\url', '\\href', '\\includegraphics'].includes(context.command);
        },

        macros: {
          '\\R': '\\mathbb{R}',
          '\\N': '\\mathbb{N}',
          '\\Z': '\\mathbb{Z}',
          '\\Q': '\\mathbb{Q}',
          '\\C': '\\mathbb{C}',
          '\\argmin': '\\operatorname{arg\\,min}',
          '\\argmax': '\\operatorname{arg\\,max}',
          '\\softmax': '\\operatorname{softmax}',
          '\\sigmoid': '\\operatorname{sigmoid}',
          '\\relu': '\\operatorname{ReLU}',
          '\\E': '\\mathbb{E}',
          '\\Var': '\\operatorname{Var}',
          '\\Cov': '\\operatorname{Cov}',
          '\\Prob': '\\operatorname{P}',
          '\\d': '\\mathrm{d}',
          '\\dx': '\\,\\mathrm{d}x',
          '\\blacksquare': '\\rule{0.6em}{0.6em}'
        },

        output: 'html'
      });

      // Post-process: wrap display math for horizontal scrolling
      fixRenderedMath(root);

    } catch (e) {
      console.error('[Math] KaTeX render failed:', e);
    }
  });
}

function fixRenderedMath(root) {
  root.querySelectorAll('.katex-display').forEach(el => {
    if (!el.parentElement.classList.contains('math-scroll')) {
      const wrap = document.createElement('div');
      wrap.className = 'math-scroll';
      el.parentElement.insertBefore(wrap, el);
      wrap.appendChild(el);
    }
  });
}


/* ---------- MERMAID ---------- */

export async function runMermaid(root) {
  if (!root || !window.mermaid) return;

  const blocks = root.querySelectorAll('code.language-mermaid');
  if (!blocks.length) return;

  if (!window._mermaidConfigured) {
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: 'inherit'
      });
      window._mermaidConfigured = true;
    } catch (e) {
      console.warn('[Mermaid] init failed:', e);
    }
  }

  for (const block of blocks) {
    try {
      const code = block.textContent;
      const id = 'mermaid-' + Math.random().toString(36).slice(2, 9);
      const container = document.createElement('div');
      container.className = 'mermaid-rendered';
      block.parentElement.replaceWith(container);

      const { svg } = await window.mermaid.render(id, code);
      container.innerHTML = svg;
    } catch (e) {
      block.parentElement.classList.add('mermaid-error');
      console.warn('[Mermaid] render error:', e);
    }
  }
}