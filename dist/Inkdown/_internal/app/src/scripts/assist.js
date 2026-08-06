// Writing assistant: readability, links, spelling, tone, summarize, translate, reorder
import { state, $, esc } from './state.js';
import { renderView, markDirty } from './ui.js';

/* ================= helpers ================= */
function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\|/g, ' ');
}

function setOut(id, html) { const el = $(id); if (el) el.innerHTML = html; }
function note(msg) { return '<div class="aNote">' + esc(msg) + '</div>'; }

/* ================= 53 · readability ================= */
function syllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = word.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}
function analyzeReadability() {
  const text = stripMarkdown(state.md);
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const words = text.split(/\s+/).filter(w => w.length);
  if (!words.length) { setOut('#aReadOut', note('Nothing to analyze yet.')); return; }
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  const wps = words.length / (sentences.length || 1);
  const spw = syl / words.length;
  let score = 206.835 - 1.015 * wps - 84.6 * spw;
  score = Math.max(0, Math.min(100, score));
  const level = score >= 70 ? 'Easy' : score >= 50 ? 'Medium' : 'Hard';
  const cls = score >= 70 ? 'good' : score >= 50 ? 'mid' : 'bad';
  const tips = [];
  if (wps > 22) tips.push('Sentences average ' + wps.toFixed(0) + ' words — try splitting long ones.');
  if (spw > 1.7) tips.push('Many multi-syllable words — prefer simpler synonyms.');
  if (sentences.length < 3) tips.push('Add a few short sentences to break up the text.');
  if (!tips.length) tips.push('Nice and readable. Keep it up.');
  setOut('#aReadOut',
    '<div class="scoreCard">' +
      '<div class="scoreNum ' + cls + '">' + score.toFixed(0) + '</div>' +
      '<div class="scoreMeta"><b>' + level + '</b> · ' + words.length + ' words · ' +
      sentences.length + ' sentences<br>~' + wps.toFixed(1) + ' words/sentence</div>' +
    '</div>' +
    '<ul class="tipList">' + tips.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>');
}

/* ================= 54 · broken link checker ================= */
function extractLinks(md) {
  const links = [];
  let m;
  const re = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  while ((m = re.exec(md))) if (/^https?:\/\//i.test(m[1])) links.push(m[1]);
  const re2 = /<(https?:\/\/[^>\s]+)>/g;
  while ((m = re2.exec(md))) links.push(m[1]);
  return [...new Set(links)];
}
async function probe(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal });
    clearTimeout(t); return 'ok';
  } catch (e) { clearTimeout(t); return 'dead'; }
}
async function checkLinks() {
  const links = extractLinks(state.md);
  if (!links.length) { setOut('#aLinksOut', note('No external links found.')); return; }
  setOut('#aLinksOut', note('Checking ' + links.length + ' links…'));
  const dead = []; let done = 0;
  const pool = 4; let i = 0;
  async function worker() {
    while (i < links.length) {
      const idx = i++; const url = links[idx];
      const res = await probe(url);
      if (res === 'dead') dead.push(url);
      done++;
      setOut('#aLinksOut', note('Checked ' + done + '/' + links.length + '…'));
    }
  }
  await Promise.all(Array.from({ length: pool }, worker));
  if (!dead.length) {
    setOut('#aLinksOut', '<div class="aOk">✅ All ' + links.length + ' links responded.</div>' +
      note('Note: browsers can\u2019t read cross-origin status, so \u201calive\u201d means reachable.'));
  } else {
    setOut('#aLinksOut',
      '<div class="aBad">' + dead.length + ' link(s) unreachable:</div>' +
      '<ul class="linkList">' + dead.map(u => '<li><code>' + esc(u) + '</code></li>').join('') + '</ul>' +
      note('Some may be false positives (sites that block HEAD requests).'));
  }
}

/* ================= 55 · spelling ================= */
const MISSPELLINGS = {
  teh:'the', recieve:'receive', seperate:'separate', definately:'definitely', occured:'occurred',
  untill:'until', wich:'which', accross:'across', alot:'a lot', begining:'beginning',
  beleive:'believe', calender:'calendar', collegue:'colleague', comming:'coming',
  consistant:'consistent', dependant:'dependent', enviroment:'environment', existance:'existence',
  goverment:'government', grammer:'grammar', happend:'happened', independant:'independent',
  liason:'liaison', libary:'library', neccessary:'necessary', noticable:'noticeable',
  occassion:'occasion', persistant:'persistent', posession:'possession', prefered:'preferred',
  privelege:'privilege', publically:'publicly', reccomend:'recommend', refered:'referred',
  relevent:'relevant', responsability:'responsibility', succesful:'successful', suprise:'surprise',
  tommorow:'tomorrow', truely:'truly', unforseen:'unforeseen', wierd:'weird', adress:'address',
  arguement:'argument', basicly:'basically', bussiness:'business', concious:'conscious'
};
function checkSpelling() {
  const text = stripMarkdown(state.md);
  const found = {};
  text.split(/\s+/).forEach(raw => {
    const w = raw.toLowerCase().replace(/[^a-z']/g, '');
    if (w && MISSPELLINGS[w]) found[w] = (found[w] || 0) + 1;
  });
  const keys = Object.keys(found);
  if (!keys.length) { setOut('#aSpellOut', '<div class="aOk">✅ No common misspellings found.</div>'); return; }
  setOut('#aSpellOut',
    '<ul class="fixList">' + keys.map(k =>
      '<li><s>' + esc(k) + '</s> → <b>' + esc(MISSPELLINGS[k]) + '</b> <span class="cnt">×' + found[k] + '</span></li>'
    ).join('') + '</ul>' +
    note('Turn on “Browser spellcheck” below to also catch names/typos inline.'));
}

/* ================= 56 · tone & inclusivity ================= */
const TONE = {
  'obviously':'consider removing — can feel dismissive',
  'clearly':'consider removing — assumes shared knowledge',
  'simply':'consider removing — can sound patronizing',
  'just':'consider removing — can minimize effort',
  'easy':'consider “straightforward” — “easy” assumes the reader\u2019s experience',
  'of course':'consider removing — assumes shared knowledge',
  'trivial':'avoid — dismissive',
  'everyone knows':'avoid — assumes shared knowledge',
  'guys':'folks / everyone / team',
  'sanity check':'quick check / confidence check',
  'whitelist':'allowlist',
  'blacklist':'blocklist / denylist',
  'master':'primary / main',
  'slave':'replica / secondary',
  'dummy':'placeholder / sample',
  'crazy':'surprising / unexpected',
  'insane':'surprising / unexpected',
  'lame':'limited / weak',
  'stupid':'avoid — consider removing'
};
function checkTone() {
  const text = stripMarkdown(state.md).toLowerCase();
  const hits = [];
  Object.keys(TONE).forEach(word => {
    const re = new RegExp('\\b' + word.replace(/\s+/g, '\\s+') + '\\b', 'g');
    const m = text.match(re);
    if (m) hits.push({ word, count: m.length, tip: TONE[word] });
  });
  if (!hits.length) { setOut('#aToneOut', '<div class="aOk">✅ No exclusionary phrasing detected.</div>'); return; }
  setOut('#aToneOut',
    '<ul class="fixList">' + hits.map(h =>
      '<li><b>“' + esc(h.word) + '”</b> <span class="cnt">×' + h.count + '</span><br><span class="tip">' + esc(h.tip) + '</span></li>'
    ).join('') + '</ul>');
}

/* ================= 58 · summarizer ================= */
let lastSummary = '';
function generateSummary() {
  const text = stripMarkdown(state.md).trim();
  const lines = state.md.split('\n');
  const headings = lines.filter(l => /^#{1,3}\s+/.test(l)).map(l => l.replace(/^#{1,3}\s+/, '').trim()).slice(0, 8);
  const firstSent = (text.split(/[.!?]/)[0] || '').trim();
  const bullets = [];
  if (firstSent) bullets.push(firstSent + '.');
  const featureWords = headings.filter(h => /feature|what|why|about/i.test(h));
  const listItems = state.md.match(/^\s*[-*]\s+(?!\[)(.+)$/gm);
  if (listItems && listItems.length) {
    bullets.push('Highlights: ' + listItems.slice(0, 3).map(l => l.replace(/^\s*[-*]\s+/, '').trim()).join('; ') + '.');
  } else if (featureWords.length) {
    bullets.push('Covers: ' + featureWords.join(', ') + '.');
  }
  const startHeading = headings.find(h => /install|quick|start|usage|getting|setup/i.test(h));
  if (startHeading) bullets.push('Get started in the “' + startHeading + '” section.');
  else if (headings.length) bullets.push('Sections: ' + headings.slice(0, 4).join(', ') + '.');
  if (!bullets.length) { setOut('#aSumOut', note('Add some content to summarize.')); return; }
  lastSummary = bullets.slice(0, 3);
  setOut('#aSumOut',
    '<ul class="tipList">' + lastSummary.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>' +
    '<button class="aBtn" id="aSumInsert">Insert TL;DR at top</button>');
  $('#aSumInsert').onclick = () => {
    const block = '> **TL;DR**\n' + lastSummary.map(b => '> - ' + b).join('\n') + '\n\n';
    state.md = block + state.md;
    state.editorEl.value = state.md;
    markDirty(); renderView(false);
    setOut('#aSumOut', '<div class="aOk">✅ TL;DR inserted at the top.</div>');
  };
}

/* ================= 57 · translation ================= */
async function translateSummary() {
  const lang = $('#aLang').value;
  const src = lastSummary && lastSummary.length ? lastSummary.join(' ') : (stripMarkdown(state.md).slice(0, 450));
  if (!src.trim()) { setOut('#aTransOut', note('Nothing to translate.')); return; }
  setOut('#aTransOut', note('Translating…'));
  try {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(src) + '&langpair=en|' + lang;
    const r = await fetch(url);
    const j = await r.json();
    const out = j?.responseData?.translatedText;
    if (out) setOut('#aTransOut', '<div class="transBox">' + esc(out) + '</div>' +
      '<button class="aBtn ghost" id="aTransCopy">Copy translation</button>');
    else setOut('#aTransOut', note('Translation service returned nothing.'));
    const cb = $('#aTransCopy');
    if (cb) cb.onclick = () => navigator.clipboard.writeText(out).then(() => setOut('#aTransOut', '<div class="aOk">✅ Copied.</div>'));
  } catch (e) {
    setOut('#aTransOut', note('Translation failed (offline or rate-limited). Use “Copy clean text” instead.'));
  }
}
function copyCleanText() {
  navigator.clipboard.writeText(stripMarkdown(state.md).trim())
    .then(() => setOut('#aTransOut', '<div class="aOk">✅ Clean text copied — paste into any translator.</div>'))
    .catch(() => setOut('#aTransOut', note('Could not copy.')));
}

/* ================= 59 · section reordering ================= */
let orderSections = [];
let dragIndex = null;
function splitSections(md) {
  const lines = md.split('\n');
  const sections = [];
  let current = { title: '(intro)', lines: [] };
  let started = false;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (started || current.lines.length) sections.push(current);
      current = { title: line.replace(/^##\s+/, '').trim(), lines: [line] };
      started = true;
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections;
}
function joinSections(secs) {
  return secs.map(s => s.lines.join('\n')).join('\n\n');
}
function loadStructure() {
  orderSections = splitSections(state.md);
  renderOrderList();
}
function renderOrderList() {
  const out = $('#aOrderOut'); out.innerHTML = '';
  if (orderSections.length < 2) { out.innerHTML = note('Add at least two "## " sections to reorder.'); return; }
  const list = document.createElement('div'); list.className = 'orderList';
  orderSections.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'orderItem'; item.draggable = true;
    item.innerHTML = '<span class="ogrip">⠿</span><span class="otitle">' + esc(s.title) + '</span><span class="olines">' + s.lines.length + ' lines</span>';
    item.addEventListener('dragstart', () => { dragIndex = i; item.classList.add('dragging'); });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => e.preventDefault());
    item.addEventListener('drop', e => { e.preventDefault(); moveSection(dragIndex, i); });
    list.appendChild(item);
  });
  out.appendChild(list);
  const hint = document.createElement('div'); hint.className = 'aNote'; hint.textContent = 'Drag to reorder, then apply.';
  out.appendChild(hint);
  const apply = document.createElement('button'); apply.className = 'aBtn'; apply.textContent = 'Apply new order';
  apply.onclick = () => {
    state.md = joinSections(orderSections);
    state.editorEl.value = state.md;
    markDirty(); renderView(false);
    setOut('#aOrderOut', '<div class="aOk">✅ Sections reordered.</div>');
  };
  out.appendChild(apply);
}
function moveSection(from, to) {
  if (from == null || from === to) return;
  const [m] = orderSections.splice(from, 1);
  orderSections.splice(to, 0, m);
  dragIndex = null;
  renderOrderList();
}

/* ================= lazy rendering (perf) ================= */
function applyPerf() {
  const el = state.docEl; if (!el) return;
  const lines = (state.md || '').split('\n').length;
  el.classList.toggle('perf', lines > 600);
}

/* ================= init ================= */
export function initAssist() {
  const btn = $('#btnAssist');
  const panel = $('#assistPanel');
  if (!btn || !panel) return;

  const open = () => { panel.hidden = false; };
  const close = () => { panel.hidden = true; };
  btn.onclick = open;
  $('#assistClose').onclick = close;
  panel.addEventListener('click', e => { if (e.target === panel) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });

  $('#aReadGo').onclick = analyzeReadability;
  $('#aLinksGo').onclick = checkLinks;
  $('#aSpellGo').onclick = checkSpelling;
  $('#aToneGo').onclick = checkTone;
  $('#aSumGo').onclick = generateSummary;
  $('#aTransGo').onclick = translateSummary;
  $('#aCopyClean').onclick = copyCleanText;
  $('#aOrderGo').onclick = loadStructure;

  const sc = $('#aSpellcheck');
  sc.checked = state.editorEl.getAttribute('spellcheck') === 'true';
  sc.onchange = e => { state.editorEl.setAttribute('spellcheck', e.target.checked ? 'true' : 'false'); };

  // lazy rendering hook
  document.addEventListener('doc:rendered', applyPerf);
  applyPerf();
}