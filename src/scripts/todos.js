// Daily Todo system
// - Floating draggable widget: toggle with Ctrl+Alt+D
// - Todos are stored per day (YYYY-MM-DD keys)
// - On a new day, PINNED todos automatically roll over (configurable in widget settings)
// - Home screen shows today's todos + expandable previous days
//
// Storage shape (localStorage 'inkdown:todos'):
// {
//   days: { "2025-01-15": { items: [{ id, text, done, pinned, createdAt, completedAt }] } },
//   settings: { rolloverPins: true }
// }
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
      d.settings = Object.assign({ rolloverPins: true }, d.settings || {});
      return d;
    }
  } catch (e) {}
  return { days: {}, settings: { rolloverPins: true } };
}

function saveData(data) {
  try {
    localStorage.setItem(TODO_KEY, JSON.stringify(data));
  } catch (e) {}
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
  const today = todayKey();
  const yesterday = (() => {
    const t = new Date();
    t.setDate(t.getDate() - 1);
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  })();
  const nice = dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  if (key === today) return 'Today · ' + nice;
  if (key === yesterday) return 'Yesterday · ' + nice;
  return nice;
}

/** Create today's list if missing; roll over pinned todos from the latest previous day. */
export function ensureToday() {
  const data = loadData();
  const key = todayKey();
  if (!data.days[key]) {
    const prevKeys = Object.keys(data.days).filter(k => k < key).sort();
    const prev = prevKeys.length ? data.days[prevKeys[prevKeys.length - 1]] : null;
    const items = [];
    if (prev && data.settings.rolloverPins !== false) {
      prev.items.filter(i => i.pinned).forEach(i => {
        items.push({
          id: uid(),
          text: i.text,
          done: false,
          pinned: true,
          createdAt: Date.now(),
          completedAt: null
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

  $('#twDate').textContent = fmtDate(key);
  const done = day.items.filter(i => i.done).length;
  $('#twCount').textContent = done + '/' + day.items.length;

  const list = $('#twList');
  list.innerHTML = '';
  const items = sortItems(day.items);
  if (!items.length) {
    list.innerHTML = '<div class="tdEmpty">Nothing yet — add your first todo ✨</div>';
  } else {
    items.forEach(i => list.appendChild(itemRow(i, key)));
  }

  $('#twRollover').checked = data.settings.rolloverPins !== false;
}

function renderHome() {
  const section = $('#todoHome');
  if (!section) return;

  ensureToday();
  const data = loadData();
  const key = todayKey();
  const day = data.days[key] || { items: [] };

  // Today: progress bar + list
  const done = day.items.filter(i => i.done).length;
  const total = day.items.length;
  $('#thStats').textContent = done + '/' + total + ' today';
  $('#thBarFill').style.width = (total ? Math.round(done / total * 100) : 0) + '%';

  const list = $('#thTodayList');
  list.innerHTML = '';
  const items = sortItems(day.items);
  if (!items.length) {
    list.innerHTML = '<div class="tdEmpty">All clear! Add a todo for today.</div>';
  } else {
    items.forEach(i => list.appendChild(itemRow(i, key)));
  }

  // Previous days (expandable, newest first) — remember open state
  const past = $('#thPastList');
  const openBefore = new Set(
    [...past.querySelectorAll('.pastDay.open')].map(el => el.dataset.key)
  );
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
    if (e.target.closest('button')) return;   // ignore clicks on the ✕ / ⚙ buttons
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
  // default: top-right corner
  w.style.left = Math.max(8, innerWidth - 364) + 'px';
  w.style.top = '76px';
}

/* ================= INIT ================= */
export function initTodos() {
  ensureToday();
  restorePos();

  // Widget controls
  $('#twClose').onclick = toggleWidget;
  $('#twSettings').onclick = () => {
    const p = $('#twSettingsPanel');
    p.hidden = !p.hidden;
  };
  $('#twRollover').onchange = e => {
    const data = loadData();
    data.settings.rolloverPins = e.target.checked;
    saveData(data);
  };
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

  // Ctrl+Alt+D toggles the widget anywhere
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.altKey && e.code === 'KeyD') {
      e.preventDefault();
      toggleWidget();
    }
  });

  // Refresh home todos whenever the library is shown (catches date changes too)
  document.addEventListener('library:shown', () => {
    ensureToday();
    renderAllTodos();
  });

  // Midnight rollover guard: if the app stays open past midnight, refresh
  setInterval(() => {
    if (todayKey() !== lastRenderedKey) {
      ensureToday();
      renderAllTodos();
      const w = $('#todoWidget');
      if (w && !w.hidden) renderWidget();
    }
  }, 60000);

  renderAllTodos();
}