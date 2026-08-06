// Tab manager: keeps several docs open; swaps them through the shared `state`.
import { state, $ } from './state.js';

let deps = null;      // { onActivate, onEmpty, onPlus }
let seq = 0;
const uid = () => 'tab-' + (++seq) + '-' + Date.now().toString(36);

export function init(d) { deps = d; }

function loadTabIntoState(tab) {
  state.md = tab.md;
  state.name = tab.name;
  state.fileId = tab.fileId;
  state.highlights = tab.highlights;
  state.goal = tab.goal;
  state.scroll = tab.scroll;
  state.collapsed = new Set(tab.collapsed || []);
  state.editing = !!tab.editing;
  state.dirty = !!tab.dirty;
}

export function snapshotCurrent() {
  if (!state.activeTabId) return;
  const tab = state.tabs.find(t => t.tabId === state.activeTabId);
  if (!tab) return;
  tab.md = state.md;
  tab.name = state.name;
  tab.fileId = state.fileId;
  tab.highlights = state.highlights;
  tab.goal = state.goal;
  tab.scroll = state.scroll;
  tab.collapsed = [...state.collapsed];
  tab.editing = state.editing;
  tab.dirty = state.dirty;
}

export function openTab(rec, opts = {}) {
  // rec = { id, name, md, highlights, goal, scroll }
  const existing = state.tabs.find(t => t.fileId === rec.id);
  if (existing) { activateTab(existing.tabId); return existing; }
  snapshotCurrent();
  const tab = {
    tabId: uid(), fileId: rec.id, name: rec.name, md: rec.md,
    highlights: rec.highlights || [], goal: rec.goal || 0, scroll: rec.scroll || 0,
    collapsed: [], editing: false, dirty: false,
  };
  state.tabs.push(tab);
  activateTab(tab.tabId, opts);
  return tab;
}

export function activateTab(tabId, opts = {}) {
  const tab = state.tabs.find(t => t.tabId === tabId);
  if (!tab) return;
  if (state.activeTabId && state.activeTabId !== tabId) snapshotCurrent();
  state.activeTabId = tabId;
  if (opts && opts.edit) tab.editing = true;
  loadTabIntoState(tab);
  renderTabBar();
  if (deps && deps.onActivate) deps.onActivate(tab);
}

export function closeTab(tabId) {
  const idx = state.tabs.findIndex(t => t.tabId === tabId);
  if (idx === -1) return;
  const wasActive = state.activeTabId === tabId;
  state.tabs.splice(idx, 1);
  if (state.tabs.length === 0) {
    state.activeTabId = null;
    renderTabBar();
    if (deps && deps.onEmpty) deps.onEmpty();
    return;
  }
  if (wasActive) {
    const ni = Math.min(idx, state.tabs.length - 1);
    activateTab(state.tabs[ni].tabId);
  } else {
    renderTabBar();
  }
}

export function renderTabBar() {
  const bar = $('#tabBar');
  if (!bar) return;
  bar.innerHTML = '';
  state.tabs.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tab' + (t.tabId === state.activeTabId ? ' active' : '');
    el.title = t.name;
    const nm = document.createElement('span');
    nm.className = 'tabName';
    nm.textContent = t.name + (t.dirty ? ' •' : '');
    const x = document.createElement('button');
    x.className = 'tabClose'; x.innerHTML = '&times;'; x.title = 'Close';
    x.onclick = e => { e.stopPropagation(); closeTab(t.tabId); };
    el.onclick = () => activateTab(t.tabId);
    el.append(nm, x);
    bar.appendChild(el);
  });
  const plus = document.createElement('button');
  plus.className = 'tabPlus'; plus.innerHTML = '+'; plus.title = 'Open library';
  plus.onclick = () => { if (deps && deps.onPlus) deps.onPlus(); };
  bar.appendChild(plus);
  bar.style.display = state.tabs.length ? '' : 'none';
}