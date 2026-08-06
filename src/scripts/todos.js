// Daily Todo system
// - Floating draggable widget: toggle with Ctrl+Alt+D
// - Day-based todos with pinned rollover
// - Home section: today + previous days
// - Dedicated Todo settings modal (rollover, hide done, auto-clean, export, danger zone)
import { $, esc } from './state.js';

const TODO_KEY = 'inkdown:todos';
const POS_KEY = 'inkdown:todoPos';

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>';
const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

let lastRenderedKey = null;

/* ================= STORAGE ================= */
function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(TODO_KEY));
    if (d && d.days) {
      d.settings = Object.assign(
        { rolloverPins: true, hideDone: false, autoClean: false },
        d.settings || {}
      );
      return d;
    }
  } catch (e) {}
  return { days: {}, settings: { rolloverPins: true, hideDone: false, autoClean: false } };
}

function saveData(data) {
  try { localStorage.setItem(TODO_KEY, JSON.stringify(data)); } catch (e) {}
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function fmtDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const t = new Date();
  const yest = new Date(t); yest.setDate(t.getDate() - 1);
  const yKey = yest.getFullYear() + '-' + String(yest.getMonth() + 1).padStart(2, '0') + '-' + String(yest.getDate()).padStart(2, '0');
  const nice = dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  if (key === todayKey()) return 'Today · ' + nice;
  if (key === yKey) return 'Yesterday · ' + nice;
  return nice;
}

/** Ensure today exists; roll over pinned todos; optionally auto-clean old completed. */
export function ensureToday() {
  const data = loadData();
  const key = todayKey();

  // Auto-clean completed todos older than 7 days
  if (data.settings.autoClean) {
    const cutoff = Date.now() - 7 * 86400000;
    let changed = false;
    Object.keys(data.days).forEach(k => {
      const before = data.days[k].items.length;
      data.days[k].items = data.days[k].items.filter(
        i => !(i.done && i.completedAt && i.completedAt < cutoff)
      );
      if (data.days[k].items.length !== before) changed = true;
    });
    if (changed) saveData(data);
  }

  // Create today + roll over pins from the latest previous day
  if (!data.days[key]) {
    const prevKeys = Object.keys(data.days).filter(k => k < key).sort();
    const prev = prevKeys.length ? data.days[prevKeys[prevKeys.length - 1]] : null;
    const items = [];
    if (prev && data.settings.rolloverPins !== false) {
      prev.items.filter(i => i.pinned).forEach(i => {
        items.push({
          id: uid(), text: i.text, done: false, pinned: true,
          createdAt: Date.now(), completedAt: null
        });
      });
    }
    data.days[key] = { items };
    saveData(data);
  }
  return data;
}

/* ================= MUTATIONS ================= */
export function addTodo(text) {
  const t = text.trim();
  if (!t) return;
  ensureToday();
  const data = loadData();
  const key = todayKey();
  data.days[key].items.push({
    id: uid(), text: t, done: false, pinned: false,
    createdAt: Date.now(), completedAt: null
  });
  saveData(data);
  renderAllTodos();
}

export function toggleTodo(dayKey, id) {
  const data = loadData();
  const item = data.days[dayKey]?.items.find(i => i.id === id);
  if (!item) return;
  item.done = !item.done;
  item.completedAt = item.done ? Date.now() : null;
  saveData(data);
  renderAllTodos();
}

export function togglePin(dayKey, id) {
  const data = loadData();
  const item = data.days[dayKey]?.items.find(i => i.id === id);
  if (!item) return;
  item.pinned = !item.pinned;
  saveData(data);
  renderAllTodos();
}

export function deleteTodo(dayKey, id) {
  const data = loadData();
  const day = data.days[dayKey];
  if (!day) return;
  day.items = day.items.filter(i => i.id !== id);
  saveData(data);
  renderAllTodos();
}

/* ================= ROW BUILDER (shared) ================= */
function itemRow(item, dayKey) {
  const row = document.createElement('div');
  row.className = 'todoRow' + (item.done ? ' done' : '');

  const check = document.createElement('button');
  check.className = 'trCheck';
  check.title = item.done ? 'Mark as not done' : 'Mark as done';
  check.innerHTML = CHECK;
  check.onclick = () => toggleTodo(dayKey, item.id);

  const text = document.createElement('span');
  text.className = 'trText';
  text.textContent = item.text;

  const pin = document.createElement('button');
  pin.className = 'trPin' + (item.pinned ? ' pinned' : '');
  pin.title = item.pinned ? 'Unpin' : 'Pin — carries over to the next day';
  pin.innerHTML = PIN;
  pin.onclick = () => togglePin(dayKey, item.id);

  const del = document.createElement('button');
  del.className = 'trDel';
  del.title = 'Delete';
  del.innerHTML = TRASH;
  del.onclick = () => deleteTodo(dayKey, item.id);

  row.append(check, text, pin, del);
  return row;
}

function sortItems(items) {
  return [...items].sort((a, b) =>
    (b.pinned - a.pinned) || (a.done - b.done) || (a.createdAt - b.createdAt)
  );
}

function secLabel(txt) {
  const d = document.createElement('div');
  d.className = 'twSec';
  d.textContent = txt;
  return d;
}

/* ================= RENDER ================= */
export function renderAllTodos() {
  lastRenderedKey = todayKey();
  renderWidget();
  renderHome();
}

function renderWidget() {
  const widget = $('#todoWidget');
  if (!widget || widget.hidden) return;

  ensureToday();
  const data = loadData();
  const key = todayKey();
  const day = data.days[key] || { items: [] };
  const hideDone = data.settings.hideDone === true;

  const total = day.items.length;
  const done = day.items.filter(i => i.done).length;
  const remaining = total - done;

  $('#twDate').textContent = fmtDate(key);
  $('#twCount').textContent = done + '/' + total;
  $('#twSub').textContent = total === 0
    ? 'Add your first task'
    : remaining === 0
      ? 'All clear — nice work ✨'
      : remaining + ' task' + (remaining > 1 ? 's' : '') + ' remaining';

  $('#twProgFill').style.width = (total ? Math.round(done / total * 100) : 0) + '%';
  $('#twBanner').hidden = !(total > 0 && done === total);

  const list = $('#twList');
  list.innerHTML = '';
  let items = sortItems(day.items);
  if (hideDone) items = items.filter(i => !i.done);

  if (!items.length) {
    list.innerHTML = total === 0
      ? '<div class="tdEmpty big">Nothing here yet.<br>Add your first todo below ✨</div>'
      : '<div class="tdEmpty big">Everything is checked off 🎈</div>';
    return;
  }

  const pinned = items.filter(i => i.pinned);
  const rest = items.filter(i => !i.pinned);
  if (pinned.length) {
    list.appendChild(secLabel('📌 Pinned'));
    pinned.forEach(i => list.appendChild(itemRow(i, key)));
  }
  if (rest.length) {
    if (pinned.length) list.appendChild(secLabel('▤ Tasks'));
    rest.forEach(i => list.appendChild(itemRow(i, key)));
  }
}

function renderHome() {
  const section = $('#todoHome');
  if (!section) return;

  ensureToday();
  const data = loadData();
  const key = todayKey();
  const day = data.days[key] || { items: [] };
  const hideDone = data.settings.hideDone === true;

  const done = day.items.filter(i => i.done).length;
  const total = day.items.length;
  $('#thStats').textContent = done + '/' + total + ' today';
  $('#thBarFill').style.width = (total ? Math.round(done / total * 100) : 0) + '%';

  const list = $('#thTodayList');
  list.innerHTML = '';
  let items = sortItems(day.items);
  if (hideDone) items = items.filter(i => !i.done);
  if (!items.length) {
    list.innerHTML = total === 0
      ? '<div class="tdEmpty">All clear! Add a todo for today.</div>'
      : '<div class="tdEmpty">Everything is checked off 🎈</div>';
  } else {
    items.forEach(i => list.appendChild(itemRow(i, key)));
  }

  // Previous days
  const past = $('#thPastList');
  const openBefore = new Set([...past.querySelectorAll('.pastDay.open')].map(el => el.dataset.key));
  past.innerHTML = '';

  const prevKeys = Object.keys(data.days).filter(k => k !== key).sort().reverse();
  if (!prevKeys.length) {
    past.innerHTML = '<div class="tdEmpty">No previous days yet.</div>';
    return;
  }

  prevKeys.forEach(k => {
    const d = data.days[k];
    const dDone = d.items.filter(i => i.done).length;
    const hasPins = d.items.some(i => i.pinned);

    const wrap = document.createElement('div');
    wrap.className = 'pastDay' + (openBefore.has(k) ? ' open' : '');
    wrap.dataset.key = k;

    const head = document.createElement('button');
    head.className = 'pdHead';
    head.innerHTML =
      '<span class="pdDate">' + esc(fmtDate(k)) + '</span>' +
      '<span class="pdMeta">' + dDone + '/' + d.items.length + ' done' + (hasPins ? ' · 📌' : '') + '</span>' +
      '<span class="pdChev">▶</span>';
    head.onclick = () => wrap.classList.toggle('open');

    const itemsBox = document.createElement('div');
    itemsBox.className = 'pdItems';
    if (!d.items.length) {
      itemsBox.innerHTML = '<div class="tdEmpty">No todos this day.</div>';
    } else {
      d.items.forEach(i => itemsBox.appendChild(itemRow(i, k)));
    }

    wrap.append(head, itemsBox);
    past.appendChild(wrap);
  });
}

/* ================= WIDGET: TOGGLE + DRAG ================= */
export function toggleWidget() {
  const w = $('#todoWidget');
  if (!w) return;
  if (w.hidden) {
    ensureToday();
    w.hidden = false;
    renderWidget();
    setTimeout(() => $('#twInput').focus(), 60);
  } else {
    w.hidden = true;
  }
}

function initDrag() {
  const w = $('#todoWidget');
  const head = $('#twHead');
  let drag = null;

  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    drag = { dx: e.clientX - w.offsetLeft, dy: e.clientY - w.offsetTop };
    try { head.setPointerCapture(e.pointerId); } catch (err) {}
  });
  head.addEventListener('pointermove', e => {
    if (!drag) return;
    const x = Math.min(Math.max(8, e.clientX - drag.dx), Math.max(8, innerWidth - w.offsetWidth - 8));
    const y = Math.min(Math.max(8, e.clientY - drag.dy), Math.max(8, innerHeight - 52));
    w.style.left = x + 'px';
    w.style.top = y + 'px';
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ left: w.style.left, top: w.style.top }));
    } catch (e) {}
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
}

function restorePos() {
  const w = $('#todoWidget');
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY));
    if (p && p.left && p.top) {
      w.style.left = p.left;
      w.style.top = p.top;
      return;
    }
  } catch (e) {}
  w.style.left = Math.max(8, innerWidth - 374) + 'px';
  w.style.top = '76px';
}

/* ================= TODO SETTINGS MODAL ================= */
function openTodoSettings() {
  const data = loadData();
  $('#tsRollover').checked = data.settings.rolloverPins !== false;
  $('#tsHideDone').checked = data.settings.hideDone === true;
  $('#tsAutoClean').checked = data.settings.autoClean === true;

  let total = 0, done = 0, pins = 0;
  Object.values(data.days).forEach(d =>
    d.items.forEach(i => { total++; if (i.done) done++; if (i.pinned) pins++; })
  );
  $('#tsStats').innerHTML =
    '<span class="tsChip"><b>' + total + '</b> total</span>' +
    '<span class="tsChip"><b>' + done + '</b> done</span>' +
    '<span class="tsChip"><b>' + pins + '</b> 📌 pinned</span>';

  $('#todoSettings').hidden = false;
}

function closeTodoSettings() {
  $('#todoSettings').hidden = true;
}

function saveSetting(key, value) {
  const data = loadData();
  data.settings[key] = value;
  saveData(data);
  renderAllTodos();
}

/** Two-step confirm for destructive buttons */
function arm(btn, fn, label = 'Sure?') {
  btn.addEventListener('click', () => {
    if (btn.dataset.armed) {
      delete btn.dataset.armed;
      btn.classList.remove('armed');
      fn();
    } else {
      btn.dataset.armed = '1';
      btn.classList.add('armed');
      const old = btn.textContent;
      btn.textContent = label;
      setTimeout(() => {
        if (!btn.dataset.armed) return;
        delete btn.dataset.armed;
        btn.classList.remove('armed');
        btn.textContent = old;
      }, 2600);
    }
  });
}

function initSettings() {
  $('#thSettings').onclick = openTodoSettings;
  $('#twSettings').onclick = openTodoSettings;
  $('#tsClose').onclick = closeTodoSettings;
  $('#todoSettings').addEventListener('click', e => {
    if (e.target === $('#todoSettings')) closeTodoSettings();
  });

  $('#tsRollover').onchange = e => saveSetting('rolloverPins', e.target.checked);
  $('#tsHideDone').onchange = e => saveSetting('hideDone', e.target.checked);
  $('#tsAutoClean').onchange = e => saveSetting('autoClean', e.target.checked);

  $('#tsExport').onclick = () => {
    const blob = new Blob([JSON.stringify(loadData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'inkdown-todos.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  $('#tsResetPos').onclick = () => {
    try { localStorage.removeItem(POS_KEY); } catch (e) {}
    const w = $('#todoWidget');
    w.style.left = '';
    w.style.top = '';
    restorePos();
    closeTodoSettings();
  };

  arm($('#tsClearToday'), () => {
    const data = loadData();
    const key = todayKey();
    if (data.days[key]) data.days[key].items = [];
    saveData(data);
    renderAllTodos();
    closeTodoSettings();
  }, 'Click again to confirm');

  arm($('#tsClearAll'), () => {
    try {
      localStorage.removeItem(TODO_KEY);
      localStorage.removeItem(POS_KEY);
    } catch (e) {}
    ensureToday();
    restorePos();
    renderAllTodos();
    closeTodoSettings();
  }, 'Click again to confirm');
}

/* ================= INIT ================= */
export function initTodos() {
  ensureToday();
  restorePos();

  // Widget controls
  $('#twClose').onclick = toggleWidget;
  $('#twAddForm').addEventListener('submit', e => {
    e.preventDefault();
    addTodo($('#twInput').value);
    $('#twInput').value = '';
    $('#twInput').focus();
  });

  // Home controls
  $('#thAddForm').addEventListener('submit', e => {
    e.preventDefault();
    addTodo($('#thInput').value);
    $('#thInput').value = '';
  });
  $('#thOpenWidget').onclick = toggleWidget;

  initDrag();
  initSettings();

  // Global keys: Ctrl+Alt+D toggles widget, Esc closes settings
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.altKey && e.code === 'KeyD') {
      e.preventDefault();
      toggleWidget();
    } else if (e.key === 'Escape' && !$('#todoSettings').hidden) {
      closeTodoSettings();
    }
  });

  // Refresh when returning home (catches date changes)
  document.addEventListener('library:shown', () => {
    ensureToday();
    renderAllTodos();
  });

  // Midnight rollover guard
  setInterval(() => {
    if (todayKey() !== lastRenderedKey) {
      ensureToday();
      renderAllTodos();
    }
  }, 60000);

  renderAllTodos();
}