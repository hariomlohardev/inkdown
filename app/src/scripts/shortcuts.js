import { $ } from './state.js';

export function initShortcuts() {
  const modal = $('#shortcutsModal');
  const closeBtn = $('#shortcutsClose');
  const searchInput = $('#shortcutsSearchInput');
  const body = $('#shortcutsBody');
  const noResults = $('#scNoResults');

  if (!modal) return;

  function open() {
    modal.hidden = false;
    if (searchInput) {
      searchInput.value = '';
      filterShortcuts('');
      setTimeout(() => searchInput.focus(), 50);
    }
  }

  function close() {
    modal.hidden = true;
  }

  function toggle() {
    if (modal.hidden) open();
    else close();
  }

  // Close button
  if (closeBtn) closeBtn.onclick = close;

  // Click outside to close
  modal.addEventListener('click', e => {
    if (e.target === modal) close();
  });

  // Search filter
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      filterShortcuts(e.target.value);
    });
    // Enter to close, Esc to close
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });
  }

  function filterShortcuts(query) {
    const q = query.toLowerCase().trim();
    const categories = body.querySelectorAll('.scCategory');
    let totalVisible = 0;

    categories.forEach(cat => {
      const rows = cat.querySelectorAll('.scRow');
      let visibleInCat = 0;

      rows.forEach(row => {
        const desc = row.querySelector('.scDesc').textContent.toLowerCase();
        const searchData = row.dataset.search || '';
        const matches = !q || desc.includes(q) || searchData.includes(q);
        row.style.display = matches ? '' : 'none';
        if (matches) visibleInCat++;
      });

      cat.style.display = visibleInCat > 0 ? '' : 'none';
      totalVisible += visibleInCat;
    });

    if (noResults) noResults.hidden = totalVisible > 0;
  }

  // Global keyboard shortcut: Ctrl+/ to open
  document.addEventListener('keydown', e => {
    // Ctrl+/ or Ctrl+Shift+/ (for some keyboards)
    if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.key === '?')) {
      e.preventDefault();
      toggle();
      return;
    }

    // Escape to close if open
    if (e.key === 'Escape' && !modal.hidden) {
      e.preventDefault();
      close();
      return;
    }

    // Don't trigger other shortcuts while modal is open
    if (!modal.hidden) {
      e.stopPropagation();
    }
  });

  console.log('[Inkdown] Shortcuts modal initialized');
}

export function openShortcuts() {
  const modal = $('#shortcutsModal');
  if (modal) modal.hidden = false;
}

export function closeShortcuts() {
  const modal = $('#shortcutsModal');
  if (modal) modal.hidden = true;
}