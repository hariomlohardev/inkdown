import { state, esc } from './state.js';
import { isDark } from './theme.js';

const EMOJI = {
  rocket:'🚀',fire:'🔥',star:'⭐',star2:'🌟',sparkles:'✨',tada:'🎉',zap:'⚡',bulb:'💡',
  bug:'🐛',lock:'🔒',key:'🔑',book:'📖',books:'📚',memo:'📝',pencil2:'✏️',link:'🔗',
  hammer:'🔨',wrench:'🔧',gear:'⚙️',package:'📦',pushpin:'📌',warning:'⚠️',
  white_check_mark:'✅',heavy_check_mark:'✔️',x:'❌',question:'❓',exclamation:'❗',
  heart:'❤️',eyes:'👀',100:'💯',thinking:'🤔',point_right:'👉',point_down:'👇',
  wave:'👋',clap:'👏',muscle:'💪',coffee:'☕',pizza:'🍕',globe_with_meridians:'🌐',
  computer:'💻',gem:'💎',crown:'👑',target:'🎯',chart_with_upwards_trend:'📈',
  test_tube:'🧪',shield:'🛡️',construction:'🚧',recycle:'♻️',robot:'🤖',boom:'💥',
  smile:'😄',grin:'😁',joy:'😂',rofl:'🤣',wink:'😉',blush:'😊',sunglasses:'😎',
  heart_eyes:'😍',kiss:'😘',thinking_face:'🤔',neutral_face:'😐',expressionless:'😑',
  unamused:'😒',sweat:'😓',pensive:'😔',confused:'😕',cry:'😢',sob:'😭',angry:'😠',
  rage:'😡',scream:'😱',sleeping:'😴',mask:'😷',alien:'👽',poop:'💩',smiley_cat:'😺',
  dog:'🐶',cat:'🐱',mouse:'🐭',hamster:'🐹',rabbit:'🐰',fox_face:'🦊',bear:'🐻',
  panda_face:'🐼',chicken:'🐔',penguin:'🐧',bird:'🐦',frog:'🐸',monkey:'🐵',see_no_evil:'🙈',
  hear_no_evil:'🙉',speak_no_evil:'🙊',sweat_drops:'💦',dash:'💨',dizzy:'💫',speech_balloon:'💬',
  thought_balloon:'💭',bangbang:'‼️',interrobang:'⁉️',tm:'™️',information_source:'ℹ️',
  left_right_arrow:'↔️',arrow_up:'⬆️',arrow_down:'⬇️',arrow_right:'➡️',arrow_left:'⬅️',
  bangbang2:'❗',sunny:'☀️',cloud:'☁️',umbrella:'☔',snowflake:'❄️',comet:'☄️',
  gift:'🎁',balloon:'🎈',confetti_ball:'🎊',trophy:'🏆',medal:'🏅',soccer:'⚽',
  basketball:'🏀',football:'🏈',baseball:'⚾',tennis:'🎾',video_game:'🎮',dart:'🎯',
  dice:'🎲',slot_machine:'🎰',jigsaw:'🧩',chess_pawn:'♟️',performing_arts:'🎭',art:'🎨',
  movie_camera:'🎥',camera:'📷',video_camera:'📹',tv:'📺',radio:'📻',iphone:'📱',
  telephone:'☎️',battery:'🔋',electric_plug:'🔌',mag:'🔍',mag_right:'🔎',light_bulb:'💡',
  flashlight:'🔦',candle:'🕯️',moneybag:'💰',dollar:'💵',credit_card:'💳',chart:'💹',
  email:'✉️',envelope:'✉️',inbox_tray:'📥',outbox_tray:'📤',postal_horn:'📯',bell:'🔔',
  loudspeaker:'📢',mega:'📣',bookmark:'🔖',label:'🏷️',briefcase:'💼',folder:'📁',
  open_file_folder:'📂',file_folder:'📁',page_with_curl:'📃',newspaper:'📰',notebook:'📓',
  ledger:'📒',clipboard:'📋',calendar:'📅',chart_bar:'📊',chart_line:'📈',money:'💰'
};

function applyEmoji(md) {
  return md.split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g).map((seg, i) =>
    i % 2 ? seg : seg.replace(/:([a-z0-9_+-]+):/g, (m, w) => EMOJI[w] ?? m)
  ).join('');
}

function extractMermaid(md) {
  state.mmd = [];
  return md.replace(/```mermaid\r?\n([\s\S]*?)```/g, (m, c) => {
    state.mmd.push(c.trim());
    return '\n\n⟦MDI' + (state.mmd.length - 1) + '⟧\n\n';
  });
}

// NEW — PlantUML
function extractPlantUml(src) {
  state.plantuml = [];
  return src.replace(/```(?:plantuml|puml)\r?\n([\s\S]*?)```/g, (m, c) => {
    state.plantuml.push(c.trim());
    return '\n\n⟦PU' + (state.plantuml.length - 1) + '⟧\n\n';
  });
}
function toHex(s) {
  return Array.from(new TextEncoder().encode(s))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// NEW — footnote definitions  [^1]: text
function collectFootnoteDefs(src) {
  state.footnotes = {};
  return src.replace(/^\[\^([^\]\s]+)\]:\s*(.+)$/gm, (m, id, text) => {
    state.footnotes[id] = text.trim();
    return '';
  });
}

// NEW — collect {3,5-7} highlight ranges per fenced block (in order)
function collectCodeHl(src) {
  state.codeHl = [];
  let open = false;
  src.split('\n').forEach(line => {
    const f = line.match(/^\s*```(.*)$/);
    if (f) {
      if (!open) {
        open = true;
        const rm = f[1].trim().match(/\{([^}]+)\}/);
        state.codeHl.push(rm ? rm[1] : '');
      } else open = false;
    }
  });
}

// NEW — turn [^id] references into superscripts + add footnote section
function applyFootnotes(html) {
  const defs = state.footnotes;
  if (!Object.keys(defs).length) return html;
  const order = [];
  html = html.replace(/\[\^([^\]\s]+)\]/g, (m, id) => {
    if (!(id in defs)) return m;
    if (!order.includes(id)) order.push(id);
    const n = order.indexOf(id) + 1;
    return '<sup class="fn-ref"><a href="#fn-' + id + '" id="fnref-' + id + '">' + n + '</a></sup>';
  });
  if (!order.length) return html;
  let sec = '<section class="footnotes"><ol>';
  order.forEach(id => {
    let body = defs[id];
    try { body = window.marked ? marked.parseInline(body) : esc(body); } catch (e) {}
    sec += '<li id="fn-' + id + '">' + body +
      ' <a href="#fnref-' + id + '" class="fn-back" title="Back to reference">↩</a></li>';
  });
  sec += '</ol></section>';
  return html + sec;
}

export function buildHTML(md) {
  if (!window.marked) return '<pre>' + esc(md) + '</pre>';
  let src = applyEmoji(extractMermaid(md));
  src = extractPlantUml(src);
  src = collectFootnoteDefs(src);
  collectCodeHl(src);

  let html = marked.parse(src, { gfm: true, breaks: false });
  if (window.DOMPurify) html = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });

  state.mmd.forEach((_, i) => {
    html = html.replaceAll('<p>⟦MDI' + i + '⟧</p>', '<div class="mmd" data-mi="' + i + '"></div>')
               .replaceAll('⟦MDI' + i + '⟧', '<div class="mmd" data-mi="' + i + '"></div>');
  });
  state.plantuml.forEach((p, i) => {
    const fig = '<figure class="puml"><img src="https://www.plantuml.com/plantuml/svg/~h' +
      toHex(p) + '" alt="PlantUML diagram" loading="lazy"></figure>';
    html = html.replaceAll('<p>⟦PU' + i + '⟧</p>', fig).replaceAll('⟦PU' + i + '⟧', fig);
  });

  html = applyFootnotes(html);
  return html;
}

export async function runMermaid(el) {
  el.querySelectorAll('.mmd').forEach(b => {
    const d = document.createElement('div');
    d.className = 'mermaid';
    d.textContent = state.mmd[+b.dataset.mi] || '';
    b.replaceWith(d);
  });
  const nodes = [...el.querySelectorAll('div.mermaid')];
  if (!nodes.length) return;
  if (window.mermaid) {
    try {
      mermaid.initialize({
        startOnLoad: false, securityLevel: 'loose',
        theme: isDark() ? 'dark' : 'neutral',
        themeVariables: {
          fontFamily: '"Bricolage Grotesque", sans-serif', accentColor: '#ff2e88',
          primaryColor: isDark() ? '#1a1a1a' : '#f4f4f4',
          primaryBorderColor: isDark() ? '#3a3a3a' : '#cfcfcf',
          primaryTextColor: isDark() ? '#f5f5f5' : '#0a0a0a',
          lineColor: isDark() ? '#8a8a8a' : '#8c8c8c'
        }
      });
      await mermaid.run({ nodes, suppressErrors: true });
    } catch (e) {}
    nodes.forEach(n => {
      if (!n.querySelector('svg')) {
        const p = document.createElement('pre');
        p.className = 'mmd-err';
        p.textContent = '⚠ mermaid: ' + n.textContent;
        n.replaceWith(p);
      }
    });
  } else {
    nodes.forEach(n => {
      const p = document.createElement('pre');
      p.className = 'mmd-err';
      p.textContent = n.textContent;
      n.replaceWith(p);
    });
  }
}

export function runMath(el) {
  if (!window.renderMathInElement) return;
  try {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false,
      ignoredTags: ['script','noscript','style','textarea','pre','code','option']
    });
  } catch (e) {}
  // NEW — friendly math error badges
  el.querySelectorAll('.katex-error').forEach(e => {
    const raw = e.textContent;
    const w = document.createElement('span');
    w.className = 'math-error';
    const code = document.createElement('code'); code.textContent = raw;
    const badge = document.createElement('span'); badge.className = 'math-badge'; badge.textContent = 'math error';
    w.append(code, badge);
    e.replaceWith(w);
  });
}