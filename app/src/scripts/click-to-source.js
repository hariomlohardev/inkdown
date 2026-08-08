/**
 * Click-to-Source: Click in rendered preview → editor scrolls to that code.
 * Only active in edit mode (split view).
 * 
 * How it works:
 *   1. After rendering, annotate each HTML element with data-source-line
 *   2. On click in preview, find nearest element with data-source-line
 *   3. Scroll editor textarea to that line and highlight it briefly
 */

import { state, $ } from './state.js';

let lineMap = []; // Maps rendered element index → source line number

/**
 * Annotate rendered HTML with source line numbers.
 * Call this after every renderView() in edit mode.
 */
export function annotateSourceLines(root) {
  if (!root || !state.md) return;

  const lines = state.md.split('\n');
  lineMap = [];

  // Get all top-level block elements
  const blocks = root.children;
  let currentLine = 0;

  for (let i = 0; i < blocks.length; i++) {
    const el = blocks[i];
    const text = el.textContent.trim();

    // Find which source line this element corresponds to
    const lineNum = findSourceLine(text, lines, currentLine);
    
    if (lineNum >= 0) {
      el.setAttribute('data-source-line', lineNum);
      currentLine = lineNum + 1; // Next search starts after this line
    }
  }

  // Also annotate nested elements (headings, list items, etc.)
  annotateNested(root, lines);
}

/**
 * Find the source line that matches the given text content.
 */
function findSourceLine(text, lines, startFrom) {
  if (!text) return -1;

  // Normalize for comparison
  const normalized = text.replace(/\s+/g, ' ').trim().slice(0, 80);

  for (let i = startFrom; i < lines.length; i++) {
    const line = lines[i].replace(/\s+/g, ' ').trim();

    // Skip empty lines
    if (!line) continue;

    // Check if this line starts the content we're looking for
    // Remove markdown syntax for comparison
    const cleaned = line
      .replace(/^#{1,6}\s+/, '')          // headings
      .replace(/^[-*+]\s+/, '')            // list items
      .replace(/^\d+\.\s+/, '')            // numbered lists
      .replace(/^>\s*/, '')                 // blockquotes
      .replace(/\*\*/g, '')                 // bold
      .replace(/\*/g, '')                   // italic
      .replace(/`/g, '')                    // code
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images
      .trim();

    if (cleaned && normalized.startsWith(cleaned.slice(0, 40))) {
      return i;
    }

    // Also check if the line contains the start of our text
    if (cleaned && cleaned.length > 5 && normalized.includes(cleaned.slice(0, 30))) {
      return i;
    }
  }

  return -1;
}

/**
 * Annotate nested elements (headings inside sections, list items, etc.)
 */
function annotateNested(root, lines) {
  const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headings.forEach(h => {
    const text = h.textContent.trim();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/^#{1,6}\s+/) && line.replace(/^#{1,6}\s+/, '').trim() === text) {
        h.setAttribute('data-source-line', i);
        break;
      }
    }
  });

  // Annotate list items
  const listItems = root.querySelectorAll('li');
  listItems.forEach(li => {
    const text = li.textContent.trim().slice(0, 60);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if ((line.match(/^[-*+]\s+/) || line.match(/^\d+\.\s+/)) &&
          line.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '').trim().startsWith(text.slice(0, 30))) {
        li.setAttribute('data-source-line', i);
        break;
      }
    }
  });

  // Annotate code blocks
  const codeBlocks = root.querySelectorAll('pre');
  codeBlocks.forEach(pre => {
    const text = pre.textContent.trim().slice(0, 50);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('```')) {
        pre.setAttribute('data-source-line', i);
        break;
      }
    }
  });

  // Annotate blockquotes
  const quotes = root.querySelectorAll('blockquote');
  quotes.forEach(q => {
    const text = q.textContent.trim().slice(0, 50);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('>')) {
        q.setAttribute('data-source-line', i);
        break;
      }
    }
  });
}

/**
 * Handle click in preview → scroll editor to source line.
 */
function handlePreviewClick(e) {
  // Only in edit mode
  if (!state.editing) return;

  // Find the nearest element with a source line
  let target = e.target;
  let lineNum = -1;

  // Walk up the DOM tree to find an element with data-source-line
  while (target && target !== state.previewEl) {
    if (target.hasAttribute && target.hasAttribute('data-source-line')) {
      lineNum = parseInt(target.getAttribute('data-source-line'));
      break;
    }
    target = target.parentElement;
  }

  if (lineNum < 0) return;

  // Scroll editor to that line
  scrollEditorToLine(lineNum);

  // Visual feedback: briefly highlight the clicked element
  highlightClickedElement(e.target);
}

/**
 * Scroll the editor textarea to a specific line.
 */
function scrollEditorToLine(lineNum) {
  const editor = state.editorEl;
  if (!editor) return;

  const lines = editor.value.split('\n');
  if (lineNum >= lines.length) return;

  // Calculate character position of the target line
  let charPos = 0;
  for (let i = 0; i < lineNum; i++) {
    charPos += lines[i].length + 1; // +1 for newline
  }

  // Set cursor position
  editor.focus();
  editor.setSelectionRange(charPos, charPos + lines[lineNum].length);

  // Scroll to make the line visible
  // Estimate line height (approximate)
  const lineHeight = parseInt(getComputedStyle(editor).lineHeight) || 20;
  const targetScroll = lineNum * lineHeight - editor.clientHeight / 3;
  editor.scrollTop = Math.max(0, targetScroll);

  // Flash the editor border to indicate jump
  editor.classList.add('source-jump');
  setTimeout(() => editor.classList.remove('source-jump'), 600);
}

/**
 * Briefly highlight the clicked element in preview.
 */
function highlightClickedElement(el) {
  if (!el) return;
  el.classList.add('click-source-highlight');
  setTimeout(() => el.classList.remove('click-source-highlight'), 800);
}

/**
 * Initialize click-to-source.
 */
export function initClickToSource() {
  // Listen for clicks on the preview element
  document.addEventListener('click', (e) => {
    // Only handle clicks within the preview pane
    if (!state.previewEl || !state.previewEl.contains(e.target)) return;
    handlePreviewClick(e);
  });

  // Re-annotate after every render
  document.addEventListener('doc:rendered', () => {
    if (state.editing && state.previewEl) {
      // Small delay to ensure DOM is settled
      setTimeout(() => annotateSourceLines(state.previewEl), 100);
    }
  });

  console.log('[Inkdown] Click-to-source initialized');
}