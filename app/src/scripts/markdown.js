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

// Add this constant at the top with other placeholders
const MERMAID_PH_PREFIX = '@@INKDOWN_MERMAID_';
const MERMAID_PH_SUFFIX = '_END@@';

/**
 * Extract mermaid blocks before markdown parsing to protect them
 */
function extractMermaid(md) {
  const store = [];
  let id = 0;

  // Match ```mermaid ... ``` blocks
  let out = md.replace(/```mermaid\s*\n([\s\S]*?)```/g, (match, code) => {
    const ph = MERMAID_PH_PREFIX + id + MERMAID_PH_SUFFIX;
    store.push({ id: id++, code: code.trim() });
    return '\n\n' + ph + '\n\n';
  });

  return { text: out, store };
}


/**
 * Restore mermaid placeholders with proper containers
 */
function restoreMermaid(html, store) {
  const regex = new RegExp(MERMAID_PH_PREFIX + '(\\d+)' + MERMAID_PH_SUFFIX, 'g');

  return html.replace(regex, (match, idStr) => {
    const entry = store[parseInt(idStr)];
    if (!entry) return match;

    // Escape the code for safe embedding in HTML attribute
    const escapedCode = entry.code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    return `<div class="mermaid-container" data-mermaid-code="${escapedCode}"><pre class="mermaid-source" style="display:none;">${escapedCode}</pre><div class="mermaid-loading">Rendering diagram...</div></div>`;
  });
}

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

  // 1. Extract math AND mermaid before markdown parsing
  const mathResult = extractMath(md);
  const mermaidResult = extractMermaid(mathResult.text);

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

  // 3. Parse markdown
  let html = window.marked.parse(mermaidResult.text);

  // 4. Sanitize (BEFORE restoring math and mermaid)
  if (window.DOMPurify) {
    html = window.DOMPurify.sanitize(html, {
      ADD_TAGS: ['div', 'span', 'pre'],
      ADD_ATTR: ['class', 'data-mermaid-code', 'style']
    });
  }

  // 5. Restore mermaid blocks
  html = restoreMermaid(html, mermaidResult.store);

  // 6. Restore math blocks
  html = restoreMath(html, mathResult.store);

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

/* ---------- MERMAID — Robust Rendering ---------- */

let mermaidInitialized = false;
let mermaidIdCounter = 0;

/**
 * Initialize mermaid with theme awareness
 */
function initMermaid() {
  if (mermaidInitialized || !window.mermaid) return;

  const isDark = document.documentElement.dataset.theme === 'dark';

  try {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      themeVariables: isDark ? {
        primaryColor: '#2d2d3f',
        primaryTextColor: '#e0e0e0',
        primaryBorderColor: '#555',
        lineColor: '#888',
        secondaryColor: '#1a1a2e',
        tertiaryColor: '#252535',
        background: '#0a0a0a',
        mainBkg: '#1e1e2e',
        nodeBorder: '#555',
        clusterBkg: '#1a1a2e',
        titleColor: '#e0e0e0',
        edgeLabelBackground: '#1e1e2e'
      } : {
        primaryColor: '#ffffff',
        primaryTextColor: '#333',
        primaryBorderColor: '#ccc',
        lineColor: '#666',
        secondaryColor: '#f5f5f5',
        tertiaryColor: '#fafafa'
      },
      securityLevel: 'loose',
      fontFamily: 'inherit',
      logLevel: 'error',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      },
      sequence: {
        useMaxWidth: true,
        mirrorActors: false
      }
    });
    mermaidInitialized = true;
  } catch (e) {
    console.warn('[Mermaid] Init failed:', e);
  }
}

/**
 * Sanitize mermaid code - fix common issues for Mermaid 11.x
 * Handles ALL node shapes: [] {} () (()) >] [[]]
 */
/**
 * Sanitize mermaid code - fix common issues for Mermaid 11.x
 * 
 * CRITICAL: Never add nested quotes. If label is already quoted, only fix pipes.
 */
function sanitizeMermaidCode(code) {
  if (!code) return '';

  let cleaned = code
    // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Fix <br> variants
    .replace(/<br\s*\/?>/gi, '<br/>')
    // Remove script tags
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .trim();

  // STEP 1: Convert HTML numeric entities back to Unicode
  cleaned = cleaned.replace(/&#(\d+);/g, (match, num) => {
    try { return String.fromCharCode(parseInt(num)); }
    catch (e) { return match; }
  });

  // STEP 2: Protect edge labels (A -->|text| B) from pipe replacement
  const edgeLabelPlaceholder = '@@EDGELBL@@';
  const edgeLabels = [];
  cleaned = cleaned.replace(/(-{2,3}>|={2,3}>|\.+>|-{2,3})\|([^|]*)\|/g, (match, arrow, label) => {
    edgeLabels.push({ arrow, label });
    return `${arrow}${edgeLabelPlaceholder}${edgeLabels.length - 1}${edgeLabelPlaceholder}`;
  });

  // STEP 3: Replace ALL remaining pipes with fullwidth vertical bar (｜)
  // This is safe inside quoted strings and doesn't conflict with Mermaid syntax
  cleaned = cleaned.replace(/\|/g, '\uFF5C');

  // Restore edge labels
  cleaned = cleaned.replace(new RegExp(edgeLabelPlaceholder + '(\\d+)' + edgeLabelPlaceholder, 'g'), (match, idx) => {
    const { arrow, label } = edgeLabels[parseInt(idx)];
    return `${arrow}|${label}|`;
  });

  // STEP 4: Auto-quote ONLY unquoted labels that need it
  // DO NOT touch already-quoted labels like ["text"] or {"text"}
  
  // Rectangle: A[text] → A["text"] (only if NOT already quoted)
  cleaned = cleaned.replace(/(\w+)\[(?!")([^\]]+)\](?!")/g, (match, nodeId, content) => {
    if (needsQuoting(content)) {
      return `${nodeId}["${content}"]`;
    }
    return match;
  });

  // Diamond: A{text} → A{"text"} (only if NOT already quoted)
  cleaned = cleaned.replace(/(\w+)\{(?!"})([^}]+)\}(?!")/g, (match, nodeId, content) => {
    if (needsQuoting(content)) {
      return `${nodeId}{"${content}"}`;
    }
    return match;
  });

  // Rounded: A(text) → A("text") (only if NOT already quoted, skip circles)
  cleaned = cleaned.replace(/(\w+)\((?!"|\()([^)]+)\)(?!\))/g, (match, nodeId, content) => {
    if (needsQuoting(content)) {
      return `${nodeId}("${content}")`;
    }
    return match;
  });

  // STEP 5: Fix style directives
  cleaned = cleaned.replace(/style\s+(\w+)\s+fill:/g, '\nstyle $1 fill:');

  // STEP 6: Clean up
  cleaned = cleaned.split('\n')
    .map(line => line.trimEnd())
    .join('\n');

  return cleaned;
}

/**
 * Check if a node label needs to be wrapped in quotes
 */
function needsQuoting(content) {
  // If already has quotes, don't add more
  if (content.startsWith('"') && content.endsWith('"')) return false;
  
  // Characters that require quoting in Mermaid 11.x
  const specialChars = /[|(){}∩∪∝×÷≤≥≠≈∞∑∏∫√θαβλμσπ'&<>\/\uFF5C]/;
  return specialChars.test(content);
}
/**
 * Render all mermaid diagrams in a container
 */
export async function runMermaid(root) {
  if (!root || !window.mermaid) return;

  initMermaid();

  const containers = root.querySelectorAll('.mermaid-container');
  if (!containers.length) return;

  for (const container of containers) {
    const codeEl = container.querySelector('.mermaid-source');
    const loadingEl = container.querySelector('.mermaid-loading');
    
    let code = '';
    if (codeEl) {
      code = codeEl.textContent;
    } else if (container.dataset.mermaidCode) {
      code = container.dataset.mermaidCode;
    }

    if (!code || !code.trim()) {
      if (loadingEl) loadingEl.textContent = 'Empty diagram';
      continue;
    }

    code = sanitizeMermaidCode(code);
    const id = 'mermaid-' + (++mermaidIdCounter) + '-' + Math.random().toString(36).slice(2, 7);

    try {
      // Clear loading state
      if (loadingEl) loadingEl.remove();

      // Render the diagram
      const { svg } = await window.mermaid.render(id, code);
      
      // Create wrapper for the SVG
      const svgWrapper = document.createElement('div');
      svgWrapper.className = 'mermaid-rendered';
      svgWrapper.innerHTML = svg;
      
      container.appendChild(svgWrapper);

      // Make SVG responsive
      const svgEl = svgWrapper.querySelector('svg');
      if (svgEl) {
        svgEl.style.maxWidth = '100%';
        svgEl.style.height = 'auto';
        svgEl.removeAttribute('height');
      }

    } catch (e) {
      console.warn('[Mermaid] Render error:', e);
      
      if (loadingEl) loadingEl.remove();
      
      // Extract line number from error if available
      let lineInfo = '';
      const lineMatch = e.message?.match(/line (\d+)/i) || e.str?.match(/line (\d+)/i);
      if (lineMatch) {
        lineInfo = ` (line ${lineMatch[1]})`;
      }
      
      const errorDiv = document.createElement('div');
      errorDiv.className = 'mermaid-error';
      errorDiv.innerHTML = `
        <div class="mermaid-error-header">
          <span class="mermaid-error-icon">⚠️</span>
          <span>Diagram rendering failed${lineInfo}</span>
        </div>
        <div class="mermaid-error-message">${escapeHtml(e.message || e.str || 'Unknown error')}</div>
        <div class="mermaid-error-tip">
          💡 Tip: Wrap labels with special characters in quotes: <code>["P(A|B)"]</code>
        </div>
        <details class="mermaid-error-details">
          <summary>View source code</summary>
          <pre>${escapeHtml(code)}</pre>
        </details>
      `;
      container.appendChild(errorDiv);
    }
  }
}

/**
 * Re-render mermaid when theme changes
 */
export function rerenderMermaidOnThemeChange() {
  mermaidInitialized = false;
  const containers = document.querySelectorAll('.mermaid-container');
  containers.forEach(container => {
    const rendered = container.querySelector('.mermaid-rendered');
    const error = container.querySelector('.mermaid-error');
    if (rendered) rendered.remove();
    if (error) error.remove();
    
    const loading = document.createElement('div');
    loading.className = 'mermaid-loading';
    loading.textContent = 'Rendering diagram...';
    container.appendChild(loading);
  });
  
  // Re-run after a short delay
  setTimeout(() => runMermaid(document.body), 100);
}

// function escapeHtml(s) {
//   return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
//     '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
//   }[c]));
// }