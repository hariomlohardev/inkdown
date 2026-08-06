import { $ } from './state.js';
import { isDark } from './theme.js';

let modal, canvas, ctx;
let current = { labels: [], series: [] };
let mode = 'bar';
const ACCENT = '#ff2e88';
const NEUTRALS = ['#6b7280', '#a3a3a3', '#c4c7c5', '#52525b'];

export function initChart() {
  modal = $('#chartModal');
  canvas = $('#chartCanvas');
  ctx = canvas.getContext('2d');
  $('#chartClose').onclick = closeChart;
  modal.addEventListener('click', e => { if (e.target === modal) closeChart(); });
  $('#chartBar').onclick = () => { mode = 'bar'; setMode(); draw(); };
  $('#chartLine').onclick = () => { mode = 'line'; setMode(); draw(); };
}

function setMode() {
  $('#chartBar').classList.toggle('on', mode === 'bar');
  $('#chartLine').classList.toggle('on', mode === 'line');
}

export function openChart(table) {
  if (!modal) initChart();
  const data = parseTable(table);
  if (!data) return;
  current = data;
  $('#chartTitle').textContent = data.title || 'Chart';
  renderLegend();
  modal.hidden = false;
  setMode();
  requestAnimationFrame(draw);
}

export function closeChart() { if (modal) modal.hidden = true; }

function parseTable(table) {
  const rows = [...table.querySelectorAll('tr')];
  if (rows.length < 2) return null;
  const header = [...rows[0].querySelectorAll('th,td')].map(c => c.textContent.trim());
  const bodyRows = rows.slice(1).map(r => [...r.querySelectorAll('td')].map(c => c.textContent.trim()));
  if (!bodyRows.length) return null;
  const labels = bodyRows.map(r => r[0] || '');
  const series = [];
  for (let c = 1; c < header.length; c++) {
    const vals = bodyRows.map(r => parseFloat((r[c] || '').replace(/[^\d.\-]/g, '')));
    if (vals.some(v => !isNaN(v))) {
      series.push({ name: header[c] || ('Series ' + c), values: vals.map(v => isNaN(v) ? 0 : v) });
    }
  }
  if (!series.length) return null;
  return { labels, series, title: header[0] ? 'By ' + header[0] : 'Chart' };
}

function renderLegend() {
  const box = $('#chartLegend');
  box.innerHTML = '';
  current.series.forEach((s, i) => {
    const span = document.createElement('span');
    const dot = document.createElement('i');
    dot.style.background = i === 0 ? ACCENT : NEUTRALS[(i - 1) % NEUTRALS.length];
    span.append(dot, document.createTextNode(s.name));
    box.appendChild(span);
  });
}

function fmt(v) {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function draw() {
  const wrap = $('#chartWrap');
  const w = Math.max(320, wrap.clientWidth || 600);
  const h = 300;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const dark = isDark();
  const textColor = dark ? '#d4d4d4' : '#333333';
  const gridColor = dark ? '#333333' : '#e5e5e5';
  const { labels, series } = current;
  const pad = { l: 44, r: 16, t: 16, b: 36 };
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const allVals = series.flatMap(s => s.values);
  const max = Math.max(...allVals, 0), min = Math.min(...allVals, 0);
  const range = (max - min) || 1;
  const y = v => pad.t + ch - ((v - min) / range) * ch;

  // grid + y labels
  ctx.font = '10px monospace';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const val = min + range * i / steps;
    const yy = y(val);
    ctx.strokeStyle = gridColor; ctx.globalAlpha = .6;
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = textColor;
    ctx.fillText(fmt(val), pad.l - 6, yy);
  }

  const n = labels.length;
  const colorFor = i => i === 0 ? ACCENT : NEUTRALS[(i - 1) % NEUTRALS.length];

  if (mode === 'bar') {
    const groupW = cw / n;
    const barW = Math.max(4, (groupW * 0.7) / series.length);
    labels.forEach((lb, i) => {
      const gx = pad.l + groupW * i + groupW * 0.15;
      series.forEach((s, si) => {
        const v = s.values[i];
        const xx = gx + barW * si;
        const yy = y(v), base = y(min);
        ctx.fillStyle = colorFor(si);
        ctx.globalAlpha = si === 0 ? 1 : .55;
        ctx.fillRect(xx, Math.min(yy, base), barW - 2, Math.abs(base - yy) || 1);
      });
      ctx.globalAlpha = 1; ctx.fillStyle = textColor;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(trunc(lb, 12), pad.l + groupW * i + groupW / 2, h - pad.b + 8);
    });
  } else {
    series.forEach((s, si) => {
      const col = colorFor(si);
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = si === 0 ? 1 : .7;
      ctx.beginPath();
      s.values.forEach((v, i) => {
        const xx = pad.l + cw * (n === 1 ? 0.5 : i / (n - 1));
        const yy = y(v);
        i === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
      });
      ctx.stroke();
      ctx.fillStyle = col;
      s.values.forEach((v, i) => {
        const xx = pad.l + cw * (n === 1 ? 0.5 : i / (n - 1));
        const yy = y(v);
        ctx.beginPath(); ctx.arc(xx, yy, 3, 0, Math.PI * 2); ctx.fill();
      });
    });
    ctx.globalAlpha = 1; ctx.fillStyle = textColor;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    labels.forEach((lb, i) => {
      const xx = pad.l + cw * (n === 1 ? 0.5 : i / (n - 1));
      ctx.fillText(trunc(lb, 12), xx, h - pad.b + 8);
    });
  }
  ctx.globalAlpha = 1;
}