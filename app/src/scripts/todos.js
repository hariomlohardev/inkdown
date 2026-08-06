import { $, $$ } from './state.js';
import { toast, openFile } from './ui.js';
import { getLibrary } from './storage.js';
import { showLibrary } from './home.js';

const TODO_KEY = 'inkdown:todos';
const DEFAULT_SETTINGS = { rolloverPins:true, hideDone:false, autoClean:false, defaultView:'page' };
let todoData = { days:{}, settings:{...DEFAULT_SETTINGS} };

const CHECK_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const TRASH_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
const FILE_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

/* ---------- helpers ---------- */
function todayKey(offset=0){ const d=new Date(); d.setDate(d.getDate()+offset); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function uid(){ return 'todo-'+Date.now()+'-'+Math.random().toString(36).slice(2,8); }
function escHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function endOfWeekKey(){ const d=new Date(); d.setDate(d.getDate()+(0-d.getDay())); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function isLaterThisWeek(k){ return k>todayKey() && k<=endOfWeekKey() && k!==todayKey(1); }
function isFutureBeyondWeek(k){ return k>endOfWeekKey(); }
function isPast(k){ return k<todayKey(); }

function loadData(){ try{ const raw=localStorage.getItem(TODO_KEY); if(raw){ const p=JSON.parse(raw); if(p&&p.days) todoData={days:p.days,settings:Object.assign({},DEFAULT_SETTINGS,p.settings||{})}; } }catch(e){} }
function saveData(){ try{ localStorage.setItem(TODO_KEY, JSON.stringify(todoData)); }catch(e){} }

function ensureToday(){
  const tk=todayKey();
  if(!todoData.days[tk]){
    const items=[];
    if(todoData.settings.rolloverPins){
      const yday=todoData.days[todayKey(-1)];
      if(yday&&yday.items) yday.items.filter(i=>i.pinned&&!i.done).forEach(i=>{
        items.push({id:uid(),text:i.text,done:false,pinned:true,priority:i.priority||0,order:items.length,createdAt:Date.now(),completedAt:null});
      });
    }
    todoData.days[tk]={items}; saveData();
  }
  return todoData.days[tk];
}
function autoCleanup(){
  if(!todoData.settings.autoClean) return;
  const cutoff=Date.now()-7*86400000; let changed=false;
  for(const k of Object.keys(todoData.days)){
    const day=todoData.days[k];
    if(day&&day.items){ const b=day.items.length; day.items=day.items.filter(i=>!(i.done&&i.completedAt&&i.completedAt<cutoff)); if(day.items.length!==b) changed=true; }
  }
  if(changed) saveData();
}
function fmtDayLabel(key){
  if(key===todayKey()) return 'Today';
  if(key===todayKey(-1)) return 'Yesterday';
  const [y,m,d]=key.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
}
function fmtDayShort(key){
  const [y,m,d]=key.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString(undefined,{month:'short',day:'numeric'});
}
function sortItems(arr){ return arr.slice().sort((a,b)=>{ if(a.pinned!==b.pinned) return (b.pinned?1:0)-(a.pinned?1:0); if(a.done!==b.done) return (a.done?1:0)-(b.done?1:0); return (a.order||0)-(b.order||0); }); }
function computeStreak(){
  let streak=0, offset=0;
  const todayDone=(todoData.days[todayKey()]&&todoData.days[todayKey()].items||[]).some(i=>i.done);
  if(!todayDone) offset=-1;
  while(true){ const day=todoData.days[todayKey(offset)]; if(day&&day.items&&day.items.some(i=>i.done)){streak++;offset--;} else break; }
  return streak;
}
function weekStats(){ let total=0,done=0; for(let i=0;i<7;i++){ const d=todoData.days[todayKey(-i)]; if(d&&d.items){ total+=d.items.length; done+=d.items.filter(x=>x.done).length; } } return {total,done}; }

/* ---------- views ---------- */
const VIEWS=[
  {key:'today',    label:'Today',     test:k=>k===todayKey()},
  {key:'tomorrow', label:'Tomorrow',  test:k=>k===todayKey(1)},
  {key:'week',     label:'This Week', test:k=>isLaterThisWeek(k)},
  {key:'later',    label:'Later',     test:k=>isFutureBeyondWeek(k)},
];
function collectView(view){
  const out=[];
  for(const [dk,day] of Object.entries(todoData.days)){
    if(!day||!day.items) continue;
    if(view.test(dk)) day.items.forEach(it=>out.push({item:it,dayKey:dk}));
  }
  let entries=out;
  if(todoData.settings.hideDone) entries=entries.filter(e=>!e.item.done);
  entries.sort((a,b)=>{ const A=a.item,B=b.item;
    if(A.pinned!==B.pinned) return (B.pinned?1:0)-(A.pinned?1:0);
    if(A.done!==B.done) return (A.done?1:0)-(B.done?1:0);
    return (A.order||0)-(B.order||0); });
  return entries;
}

/* ---------- rendering ---------- */
export function renderTodos(){ ensureToday(); renderGreeting(); renderStats(); renderAddForm(); renderViews(); renderWidget(); }

function renderGreeting(){
  const t=$('#todoGreetTitle'), s=$('#todoGreetSub'); if(!t) return;
  const day=ensureToday(); const total=day.items.length; const done=day.items.filter(i=>i.done).length;
  const h=new Date().getHours();
  const g=h<5?'Up late':h<12?'Good morning':h<18?'Good afternoon':'Good evening';
  t.textContent=g+' 👋';
  if(s) s.textContent= total===0? 'No todos for today — add one below.' : done+' of '+total+' done — '+new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
}
function renderStats(){
  const day=ensureToday();
  const total=day.items.length, done=day.items.filter(i=>i.done).length;
  const streak=computeStreak(); const wk=weekStats();
  const set=(id,v)=>{const el=$(id); if(el) el.textContent=v;};
  set('#tdStatTotal', total);
  set('#tdStatDone', done);
  set('#tdStatStreak', streak+(streak===1?' day':' days'));
  set('#tdStatWeek', wk.total?(wk.done+'/'+wk.total):'—');
  const fill=$('#tdBarFill'); if(fill) fill.style.width=(total?Math.round(done/total*100):0)+'%';
}
function renderAddForm(){
  const sel=$('#thDue'); if(!sel) return;
  sel.innerHTML='';
  for(let i=0;i<7;i++){
    const k=todayKey(i);
    const opt=document.createElement('option'); opt.value=k;
    opt.textContent= i===0?'Today': i===1?'Tomorrow': fmtDayLabel(k);
    sel.appendChild(opt);
  }
}
function renderViews(){
  const wrap=$('#todoViews'); if(!wrap) return; wrap.innerHTML='';
  VIEWS.forEach(view=>{
    const entries=collectView(view);
    if(!entries.length) return;
    const sec=document.createElement('div'); sec.className='viewSection';
    sec.innerHTML='<div class="viewSecHead"><span>'+escHtml(view.label)+'</span><em>'+entries.length+'</em></div>';
    const list=document.createElement('div'); list.className='viewList';
    entries.forEach(({item,dayKey})=> list.appendChild(todoItemEl(item,dayKey,view.key==='today')));
    sec.appendChild(list); wrap.appendChild(sec);
  });
  renderPast(wrap);
}
function renderPast(wrap){
  const pastKeys=Object.keys(todoData.days).filter(k=>isPast(k)).sort().reverse();
  if(!pastKeys.length) return;
  const sec=document.createElement('div'); sec.className='viewSection';
  sec.innerHTML='<div class="viewSecHead"><span>Previous days</span></div>';
  pastKeys.forEach(k=>{
    const day=todoData.days[k]; if(!day||!day.items) return;
    let items=day.items; if(todoData.settings.hideDone) items=items.filter(i=>!i.done);
    if(!items.length) return;
    const total=day.items.length, done=day.items.filter(i=>i.done).length;
    const pd=document.createElement('div'); pd.className='pastDay';
    const head=document.createElement('button'); head.className='pastDayHead';
    head.innerHTML='<span class="pdLabel">'+escHtml(fmtDayLabel(k))+'</span><span class="pdCount">'+done+'/'+total+'</span><span class="pdChev">▸</span>';
    const body=document.createElement('div'); body.className='pastDayBody';
    sortItems(items).forEach(it=>body.appendChild(todoItemEl(it,k,false)));
    head.onclick=()=>pd.classList.toggle('open');
    pd.append(head,body); sec.appendChild(pd);
  });
  wrap.appendChild(sec);
}

function todoItemEl(item, dayKey, draggable){
  const el=document.createElement('div');
  el.className='todoItem'+(item.done?' done':'')+(item.pinned?' pinned':'')+' prio-'+(item.priority||0);
  el.dataset.id=item.id; el.dataset.day=dayKey;
  if(draggable) el.draggable=true;

  const check=document.createElement('button'); check.className='todoCheck';
  check.title=item.done?'Mark as not done':'Mark as done'; check.innerHTML=CHECK_SVG;
  check.onclick=()=>toggleTodo(dayKey,item.id);

  const prio=document.createElement('button'); prio.className='prio p'+(item.priority||0);
  prio.title='Priority: '+['none','low','medium','urgent'][item.priority||0];
  prio.onclick=(e)=>{e.stopPropagation(); cyclePriority(dayKey,item.id);};

  const text=document.createElement('div'); text.className='todoText'; text.textContent=item.text;

  const meta=document.createElement('div'); meta.className='todoMeta';
  if(dayKey!==todayKey()){
    const due=document.createElement('button'); due.className='dueChip'; due.textContent=fmtDayShort(dayKey);
    due.title='Change due date'; due.onclick=(e)=>{e.stopPropagation(); dueMenu(item,dayKey,due);};
    meta.appendChild(due);
  }
  if(item.fileId){
    const chip=document.createElement('button'); chip.className='fileChip'; chip.innerHTML=FILE_SVG+'<span>'+escHtml(item.fileName||'file')+'</span>';
    chip.title='Open linked file'; chip.onclick=(e)=>{e.stopPropagation(); openLinkedFile(item);};
    meta.appendChild(chip);
  }

  const acts=document.createElement('div'); acts.className='todoActs';
  const link=document.createElement('button'); link.className='todoLink'; link.title='Link to a file'; link.innerHTML=FILE_SVG;
  link.onclick=(e)=>{e.stopPropagation(); linkFileMenu(item,dayKey,link);};
  const pin=document.createElement('button'); pin.className='todoPin'+(item.pinned?' on':''); pin.title=item.pinned?'Unpin':'Pin'; pin.textContent='📌';
  pin.onclick=(e)=>{e.stopPropagation(); togglePin(dayKey,item.id);};
  const del=document.createElement('button'); del.className='todoDel'; del.title='Delete'; del.innerHTML=TRASH_SVG;
  del.onclick=(e)=>{e.stopPropagation(); deleteTodo(dayKey,item.id);};
  acts.append(link,pin,del);

  el.append(check,prio,text,meta,acts);

  if(draggable){
    el.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/todo-id',item.id); e.dataTransfer.effectAllowed='move'; el.classList.add('dragging'); });
    el.addEventListener('dragend',()=>el.classList.remove('dragging'));
    el.addEventListener('dragover',e=>{ e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave',()=>el.classList.remove('dragover'));
    el.addEventListener('drop',e=>{ e.preventDefault(); el.classList.remove('dragover');
      const dragId=e.dataTransfer.getData('text/todo-id');
      if(dragId&&dragId!==item.id) reorderItem(dayKey,dragId,item.id); });
  }
  return el;
}

/* ---------- actions ---------- */
function addTodo(text, dueKey, priority){
  const t=(text||'').trim(); if(!t) return;
  dueKey=dueKey||todayKey();
  if(!todoData.days[dueKey]) todoData.days[dueKey]={items:[]};
  const day=todoData.days[dueKey];
  day.items.push({id:uid(),text:t,done:false,pinned:false,priority:priority||0,order:day.items.length,createdAt:Date.now(),completedAt:null});
  saveData(); renderTodos();
}
function findItem(dayKey,id){ const day=todoData.days[dayKey]; return day? (day.items.find(i=>i.id===id)||null):null; }
function toggleTodo(dayKey,id){ const it=findItem(dayKey,id); if(!it) return; it.done=!it.done; it.completedAt=it.done?Date.now():null; saveData(); renderTodos(); }
function togglePin(dayKey,id){ const it=findItem(dayKey,id); if(!it) return; it.pinned=!it.pinned; saveData(); renderTodos(); }
function deleteTodo(dayKey,id){ const day=todoData.days[dayKey]; if(!day) return; day.items=day.items.filter(i=>i.id!==id); saveData(); renderTodos(); }
function cyclePriority(dayKey,id){ const it=findItem(dayKey,id); if(!it) return; it.priority=((it.priority||0)+1)%4; saveData(); renderTodos(); }
function moveToDay(dayKey,id,newKey){
  const day=todoData.days[dayKey]; if(!day) return;
  const idx=day.items.findIndex(i=>i.id===id); if(idx<0) return;
  const [it]=day.items.splice(idx,1);
  if(!todoData.days[newKey]) todoData.days[newKey]={items:[]};
  it.order=todoData.days[newKey].items.length;
  todoData.days[newKey].items.push(it);
  saveData(); renderTodos();
}
function reorderItem(dayKey,dragId,targetId){
  const day=todoData.days[dayKey]; if(!day) return;
  const items=day.items; const fromIdx=items.findIndex(i=>i.id===dragId); if(fromIdx<0) return;
  const [moved]=items.splice(fromIdx,1);
  let toIdx=items.findIndex(i=>i.id===targetId);
  items.splice(toIdx,0,moved);
  items.forEach((it,i)=>it.order=i);
  saveData(); renderTodos();
}
function openLinkedFile(item){
  const f=getLibrary().find(x=>x.id===item.fileId);
  if(f) openFile(f); else toast('Linked file not found','warn');
}

/* ---------- popup menus ---------- */
function closePopups(){ $$('.todoMenu').forEach(m=>m.remove()); }
function positionMenu(menu,anchor){ const r=anchor.getBoundingClientRect(); menu.style.left=Math.min(r.left,innerWidth-240)+'px'; menu.style.top=Math.min(r.bottom+6,innerHeight-220)+'px'; }
function dueMenu(item,dayKey,anchor){
  closePopups();
  const menu=document.createElement('div'); menu.className='todoMenu';
  [{label:'Today',key:todayKey()},{label:'Tomorrow',key:todayKey(1)},{label:'Next week',key:todayKey(7)}].forEach(o=>{
    const b=document.createElement('button'); b.className='menuItem'; b.textContent=o.label;
    b.onclick=(e)=>{e.stopPropagation(); moveToDay(dayKey,item.id,o.key); closePopups(); toast('Moved to '+o.label);};
    menu.appendChild(b);
  });
  positionMenu(menu,anchor); document.body.appendChild(menu);
  setTimeout(()=>document.addEventListener('click',closePopups,{once:true}),0);
}
function linkFileMenu(item,dayKey,anchor){
  closePopups();
  const lib=getLibrary();
  const menu=document.createElement('div'); menu.className='todoMenu';
  if(!lib.length) menu.innerHTML='<div class="menuEmpty">No files in library yet</div>';
  else lib.forEach(f=>{
    const b=document.createElement('button'); b.className='menuItem'; b.textContent='📄 '+f.name;
    b.onclick=(e)=>{e.stopPropagation(); item.fileId=f.id; item.fileName=f.name; saveData(); renderTodos(); closePopups(); toast('Linked to '+f.name);};
    menu.appendChild(b);
  });
  if(item.fileId){
    const u=document.createElement('button'); u.className='menuItem'; u.textContent='✕ Unlink';
    u.onclick=(e)=>{e.stopPropagation(); delete item.fileId; delete item.fileName; saveData(); renderTodos(); closePopups();};
    menu.appendChild(u);
  }
  positionMenu(menu,anchor); document.body.appendChild(menu);
  setTimeout(()=>document.addEventListener('click',closePopups,{once:true}),0);
}

/* ---------- quick add ---------- */
function showQuickAdd(){ const qa=$('#quickAdd'); if(!qa) return; qa.classList.add('open'); const inp=$('#qaInput'); if(inp){ inp.value=''; setTimeout(()=>inp.focus(),30);} }
function hideQuickAdd(){ const qa=$('#quickAdd'); if(qa) qa.classList.remove('open'); }
function submitQuickAdd(){ const inp=$('#qaInput'); if(!inp) return; const t=inp.value.trim(); if(!t){hideQuickAdd();return;} addTodo(t,todayKey(),0); toast('Added to Today'); hideQuickAdd(); }

/* =========================================================
   FLOATING TODO WIDGET  (Ctrl+Alt+D)
   ========================================================= */
function toggleTodoWidget(){
  const w = $('#todoWidget');
  if(!w){ toast('Widget not found — check index.html', 'warn'); return; }
  w.hidden = !w.hidden;                 // toggle the hidden attribute
  if(!w.hidden) renderWidget();         // render when opening
}
window.toggleTodoWidget = toggleTodoWidget;   // lets widget button / default-view open it

function renderWidget(){
  const list = $('#twList'); if(!list) return;
  const day = ensureToday();
  const total = day.items.length, done = day.items.filter(i=>i.done).length;

  const fill = $('#twProgFill'); if(fill) fill.style.width = (total?Math.round(done/total*100):0)+'%';
  const dt = $('#twDate'); if(dt) dt.textContent = 'Today';
  const sub = $('#twSub'); if(sub) sub.textContent = total===0 ? 'No to-dos yet' : done+' of '+total+' done';

  list.innerHTML = '';
  let items = sortItems(day.items);
  if(todoData.settings.hideDone) items = items.filter(i=>!i.done);
  if(!items.length){ list.innerHTML = '<div class="twEmpty">Nothing for today 🎉</div>'; return; }
  items.forEach(it => list.appendChild(widgetItemEl(it)));
}

function widgetItemEl(item){
  const el = document.createElement('div');
  el.className = 'twItem' + (item.done?' done':'') + ' prio-' + (item.priority||0);
  const check = document.createElement('button'); check.className='todoCheck'; check.innerHTML=CHECK_SVG;
  check.title = item.done?'Mark as not done':'Mark as done';
  check.onclick = ()=>toggleTodo(todayKey(), item.id);
  const prio = document.createElement('button'); prio.className='prio p'+(item.priority||0);
  prio.title='Priority'; prio.onclick=(e)=>{e.stopPropagation(); cyclePriority(todayKey(), item.id);};
  const text = document.createElement('span'); text.className='twText'; text.textContent=item.text;
  const del = document.createElement('button'); del.className='twDel'; del.innerHTML=TRASH_SVG;
  del.title='Delete'; del.onclick=(e)=>{e.stopPropagation(); deleteTodo(todayKey(), item.id);};
  el.append(check, prio, text, del);
  return el;
}

/* ---------- settings ---------- */
function exportJSON(){
  const blob=new Blob([JSON.stringify(todoData,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='inkdown-todos-backup.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000); toast('Todos exported');
}
function importJSON(file){
  const r=new FileReader();
  r.onload=()=>{ try{ const p=JSON.parse(r.result);
    if(p&&p.days){ if(confirm('Replace current todos with this backup?')){ todoData={days:p.days,settings:Object.assign({},DEFAULT_SETTINGS,p.settings||{})}; saveData(); renderTodos(); toast('Todos restored'); } }
    else toast('Invalid backup file','warn');
  }catch(e){ toast('Could not read that file','warn'); } };
  r.readAsText(file);
}
function bindToggle(sel,key){ const el=$(sel); if(!el) return; el.addEventListener('change',()=>{ todoData.settings[key]=el.checked; saveData(); renderTodos(); }); }
function syncSettingsUI(){
  const s=todoData.settings;
  const set=(sel,val)=>{const el=$(sel); if(el) el.checked=!!val;};
  set('#tsRollover',s.rolloverPins); set('#tsHideDone',s.hideDone); set('#tsAutoClean',s.autoClean);
  $$('input[name="tsDefaultView"]').forEach(r=>{ r.checked=(r.value===(s.defaultView||'page')); });
}
function openTodoSettings(){ syncSettingsUI(); const m=$('#todoSettings'); if(m) m.hidden=false; }
function closeTodoSettings(){ const m=$('#todoSettings'); if(m) m.hidden=true; }
function initSettings(){
  const modal=$('#todoSettings');
  const cs=$('#tsClose'); if(cs) cs.onclick=closeTodoSettings;
  if(modal) modal.addEventListener('click',e=>{ if(e.target===modal) closeTodoSettings(); });
  document.addEventListener('todosettings:open',openTodoSettings);
  bindToggle('#tsRollover','rolloverPins');
  bindToggle('#tsHideDone','hideDone');
  bindToggle('#tsAutoClean','autoClean');
  $$('input[name="tsDefaultView"]').forEach(r=>r.addEventListener('change',()=>{ todoData.settings.defaultView=r.value; saveData(); }));
  const ex=$('#tsExport'); if(ex) ex.onclick=exportJSON;
  const im=$('#tsImport'), imf=$('#tsImportFile');
  if(im&&imf){ im.onclick=()=>imf.click(); imf.addEventListener('change',e=>{ if(e.target.files[0]) importJSON(e.target.files[0]); e.target.value=''; }); }
  const cl=$('#tsClear'); if(cl) cl.onclick=()=>{ if(confirm('Delete ALL todos? This cannot be undone.')){ todoData={days:{},settings:{...DEFAULT_SETTINGS}}; ensureToday(); saveData(); renderTodos(); closeTodoSettings(); toast('All todos cleared'); } };
}

/* ---------- open / widget ---------- */
function toggleWidget(){ document.dispatchEvent(new CustomEvent('todowidget:toggle')); if(typeof window.toggleTodoWidget==='function') window.toggleTodoWidget(); }
function showTodosPage(){ document.body.dataset.view='todos'; document.title='Inkdown — Todos'; document.dispatchEvent(new CustomEvent('todos:shown')); }
export function openTodosDefault(){ (todoData.settings.defaultView==='widget')? toggleWidget() : showTodosPage(); }
export function showTodos(){ openTodosDefault(); }

/* ---------- init ---------- */
export function initTodos(){
  loadData(); autoCleanup(); ensureToday();

  const navAll=$('#todoNavAll'); if(navAll) navAll.onclick=()=>showLibrary();
  const settingsBtn=$('#todoSettingsBtn'); if(settingsBtn) settingsBtn.onclick=openTodoSettings;
  const widget=$('#thOpenWidget'); if(widget) widget.onclick=toggleWidget;

  const addForm=$('#thAddForm'), addInput=$('#thInput'), addDue=$('#thDue');
  if(addForm) addForm.addEventListener('submit',e=>{ e.preventDefault();
    addTodo(addInput?addInput.value:'', addDue?addDue.value:todayKey(), 0);
    if(addInput) addInput.value=''; if(addInput) addInput.focus(); });

  const qaForm=$('#qaForm'), qaInput=$('#qaInput'), qaClose=$('#qaClose');
  if(qaForm) qaForm.addEventListener('submit',e=>{e.preventDefault(); submitQuickAdd();});
  if(qaInput) qaInput.addEventListener('keydown',e=>{ if(e.key==='Escape') hideQuickAdd(); });
  if(qaClose) qaClose.onclick=hideQuickAdd;

  // Ctrl+Alt+T = quick add, Ctrl+Alt+D = widget
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.altKey&&(e.key==='t'||e.key==='T')){ e.preventDefault(); showQuickAdd(); }
    if((e.ctrlKey||e.metaKey)&&e.altKey&&(e.key==='d'||e.key==='D')){ e.preventDefault(); toggleTodoWidget(); }
  });

  const twClose=$('#twClose'); if(twClose) twClose.onclick=()=>toggleTodoWidget();
  const twSettings=$('#twSettings'); if(twSettings) twSettings.onclick=openTodoSettings;

  const twAddForm=$('#twAddForm'), twInput=$('#twInput');
  if(twAddForm) twAddForm.addEventListener('submit',e=>{
    e.preventDefault();
    addTodo(twInput?twInput.value:'', todayKey(), 0);
    if(twInput) twInput.value='';
  });
  
  document.addEventListener('todos:open',()=>openTodosDefault());
  document.addEventListener('todos:shown',()=>renderTodos());

  initSettings();
  renderTodos();
}