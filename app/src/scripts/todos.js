import { $, $$ } from './state.js';
import { toast } from './ui.js';
import { showLibrary } from './home.js';

const TODO_KEY = 'inkdown:todos';
let todoData = { days: {}, settings: { rolloverPins: true, hideDone: false, autoClean: false } };

/* ---------- helpers ---------- */
function todayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function uid() { return 'todo-' + Date.now() + '-' + Math.random().toString(36).slice(2,8); }
function escHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function loadData() {
  try {
    const raw = localStorage.getItem(TODO_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.days) todoData = { days: p.days, settings: Object.assign({rolloverPins:true,hideDone:false,autoClean:false}, p.settings||{}) };
    }
  } catch(e){}
}
function saveData() { try { localStorage.setItem(TODO_KEY, JSON.stringify(todoData)); } catch(e){} }

function ensureToday() {
  const tk = todayKey();
  if (!todoData.days[tk]) {
    const items = [];
    if (todoData.settings.rolloverPins) {
      const yday = todoData.days[todayKey(-1)];
      if (yday && yday.items) {
        yday.items.filter(i => i.pinned && !i.done).forEach(i => {
          items.push({ id: uid(), text: i.text, done:false, pinned:true, createdAt: Date.now(), completedAt:null });
        });
      }
    }
    todoData.days[tk] = { items };
    saveData();
  }
  return todoData.days[tk];
}

function fmtDayLabel(key) {
  if (key === todayKey()) return 'Today';
  if (key === todayKey(-1)) return 'Yesterday';
  const [y,m,d] = key.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'});
}

/* ---------- rendering ---------- */
export function renderTodos() {
  loadData();
  ensureToday();
  renderGreeting();
  renderStats();
  renderTodayList();
  renderPastList();
}

function renderGreeting() {
  const t = $('#todoGreetTitle');
  const s = $('#todoGreetSub');
  if (!t) return;
  const day = ensureToday();
  const total = day.items.length;
  const done = day.items.filter(i=>i.done).length;
  const h = new Date().getHours();
  const g = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  t.textContent = g + ' 👋';
  if (s) {
    if (total === 0) s.textContent = 'No todos for today — add one below.';
    else s.textContent = done + ' of ' + total + ' done — ' + new Date().toLocaleDateString(undefined,{weekday:'long', month:'long', day:'numeric'});
  }
}

function renderStats() {
  const day = ensureToday();
  const total = day.items.length;
  const done = day.items.filter(i=>i.done).length;
  const pinned = day.items.filter(i=>i.pinned).length;
  let weekTotal=0, weekDone=0;
  for (let i=0;i<7;i++){
    const d = todoData.days[todayKey(-i)];
    if (d && d.items){ weekTotal += d.items.length; weekDone += d.items.filter(x=>x.done).length; }
  }
  const pct = total ? Math.round(done/total*100) : 0;
  const set=(id,v)=>{ const el=$(id); if(el) el.textContent=v; };
  set('#tdStatTotal', total);
  set('#tdStatDone', done);
  set('#tdStatPinned', pinned);
  set('#tdStatWeek', weekTotal ? Math.round(weekDone/weekTotal*100)+'%' : '—');
  const fill = $('#tdBarFill');
  if (fill) fill.style.width = pct + '%';
}

function todoItemEl(item, dayKey) {
  const el = document.createElement('div');
  el.className = 'todoItem' + (item.done?' done':'') + (item.pinned?' pinned':'');

  const check = document.createElement('button');
  check.className = 'todoCheck';
  check.title = item.done ? 'Mark as not done' : 'Mark as done';
  check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  check.onclick = () => toggleTodo(dayKey, item.id);

  const text = document.createElement('div');
  text.className = 'todoText';
  text.textContent = item.text;

  const acts = document.createElement('div');
  acts.className = 'todoActs';
  const pin = document.createElement('button');
  pin.className = 'todoPin' + (item.pinned?' on':'');
  pin.title = item.pinned ? 'Unpin' : 'Pin (rolls to next day)';
  pin.innerHTML = '📌';
  pin.onclick = () => togglePin(dayKey, item.id);
  const del = document.createElement('button');
  del.className = 'todoDel';
  del.title = 'Delete';
  del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  del.onclick = () => deleteTodo(dayKey, item.id);
  acts.append(pin, del);

  el.append(check, text, acts);
  return el;
}

function renderTodayList() {
  const list = $('#thTodayList');
  if (!list) return;
  list.innerHTML = '';
  const day = ensureToday();
  let items = day.items.slice();
  items.sort((a,b)=>{
    if (a.pinned !== b.pinned) return (b.pinned?1:0)-(a.pinned?1:0);
    if (a.done !== b.done) return (a.done?1:0)-(b.done?1:0);
    return (a.createdAt||0)-(b.createdAt||0);
  });
  if (todoData.settings.hideDone) items = items.filter(i=>!i.done);
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'todoEmpty';
    empty.innerHTML = '<div class="emptyIco">✅</div><h3>All clear!</h3><p>Nothing to do today. Enjoy your day or add a todo above.</p>';
    list.appendChild(empty);
    return;
  }
  items.forEach(i => list.appendChild(todoItemEl(i, todayKey())));
}

function renderPastList() {
  const wrap = $('#thPastList');
  if (!wrap) return;
  wrap.innerHTML = '';
  const tk = todayKey();
  const keys = Object.keys(todoData.days).filter(k => k !== tk).sort().reverse();
  if (!keys.length) {
    const empty = document.createElement('div');
    empty.className = 'pastEmpty';
    empty.textContent = 'No previous days yet.';
    wrap.appendChild(empty);
    return;
  }
  keys.forEach(key => {
    const day = todoData.days[key];
    if (!day || !day.items) return;
    const total = day.items.length;
    const done = day.items.filter(i=>i.done).length;
    const pd = document.createElement('div');
    pd.className = 'pastDay';
    const head = document.createElement('button');
    head.className = 'pastDayHead';
    head.innerHTML = '<span class="pdLabel">'+escHtml(fmtDayLabel(key))+'</span><span class="pdCount">'+done+'/'+total+'</span><span class="pdChev">▸</span>';
    const body = document.createElement('div');
    body.className = 'pastDayBody';
    day.items.forEach(i => body.appendChild(todoItemEl(i, key)));
    head.onclick = () => pd.classList.toggle('open');
    pd.append(head, body);
    wrap.appendChild(pd);
  });
}

/* ---------- actions ---------- */
function addTodo(text) {
  const t = (text||'').trim();
  if (!t) return;
  const day = ensureToday();
  day.items.push({ id: uid(), text: t, done:false, pinned:false, createdAt: Date.now(), completedAt:null });
  saveData();
  renderTodos();
}
function toggleTodo(dayKey, id) {
  const day = todoData.days[dayKey];
  if (!day) return;
  const it = day.items.find(i=>i.id===id);
  if (!it) return;
  it.done = !it.done;
  it.completedAt = it.done ? Date.now() : null;
  saveData();
  renderTodos();
}
function togglePin(dayKey, id) {
  const day = todoData.days[dayKey];
  if (!day) return;
  const it = day.items.find(i=>i.id===id);
  if (!it) return;
  it.pinned = !it.pinned;
  saveData();
  renderTodos();
}
function deleteTodo(dayKey, id) {
  const day = todoData.days[dayKey];
  if (!day) return;
  day.items = day.items.filter(i=>i.id!==id);
  saveData();
  renderTodos();
}

/* ---------- init ---------- */
export function initTodos() {
  loadData();
  ensureToday();

  const navAll = $('#todoNavAll');
  if (navAll) navAll.onclick = () => showLibrary();

  const settings = $('#todoSettingsBtn');
  if (settings) settings.onclick = () => {
    document.dispatchEvent(new CustomEvent('settings:open'));
    const ls = $('#libSettings');
    if (ls) ls.click();
  };

  const widget = $('#thOpenWidget');
  if (widget) widget.onclick = () => {
    document.dispatchEvent(new CustomEvent('todowidget:toggle'));
    if (typeof window.toggleTodoWidget === 'function') window.toggleTodoWidget();
  };

  const addForm = $('#thAddForm');
  const addInput = $('#thInput');
  if (addForm && addInput) {
    addForm.addEventListener('submit', e => {
      e.preventDefault();
      addTodo(addInput.value);
      addInput.value = '';
      addInput.focus();
    });
  }

  document.addEventListener('todos:shown', () => renderTodos());
  renderTodos();
}

export function showTodos() {
  document.body.dataset.view = 'todos';
  document.title = 'Inkdown — Todos';
  renderTodos();
}