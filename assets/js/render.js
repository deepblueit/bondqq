// Markdown + math + visual renderers.
import { icon } from './icons.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const mdOpts = { breaks: true, gfm: true };

function katexOr(src, display) {
  try {
    if (window.katex) return `<span class="math" dir="ltr">${window.katex.renderToString(src, { displayMode: display, throwOnError: false, output: 'html' })}</span>`;
  } catch (e) { /* fall through */ }
  return `<code dir="ltr">${esc(src)}</code>`;
}

// protect $...$ / $$...$$ from markdown, render with KaTeX afterwards (only when math=true)
function withMath(text, math, fn) {
  if (!math || !text.includes('$')) return fn(text);
  const store = [];
  let t = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => { store.push([m, true]); return `\u0000M${store.length - 1}\u0000`; });
  t = t.replace(/\$([^$\n]+?)\$/g, (_, m) => { store.push([m, false]); return `\u0000M${store.length - 1}\u0000`; });
  let html = fn(t);
  html = html.replace(/\u0000M(\d+)\u0000/g, (_, i) => katexOr(store[+i][0], store[+i][1]));
  return html;
}

// keep short English phrases in parentheses together, e.g. (Expert Systems), so RTL lines do not split them
const LATIN_PAREN = /\(([A-Za-z][^()<>\u0600-\u06FF\n]{0,48}?)\)/g;
function bidiFix(h) {
  return h.replace(LATIN_PAREN, (m, inner) => `<bdi class="en${inner.length <= 14 ? ' nw' : ''}">(${inner})</bdi>`);
}

export function md(text, math = false) {
  if (!text) return '';
  return withMath(String(text), math, t => {
    let h = window.marked ? window.marked.parse(t, mdOpts) : `<p>${esc(t).replace(/\n/g, '<br>')}</p>`;
    h = bidiFix(h);
    // blockquotes become callout cards
    h = h.replace(/<blockquote>/g, `<blockquote class="callout">${icon('lightbulb', 'callout-ic')}<div>`).replace(/<\/blockquote>/g, '</div></blockquote>');
    return h;
  });
}

export function inline(text, math = false) {
  if (!text) return '';
  return withMath(String(text), math, t => bidiFix(window.marked ? window.marked.parseInline(t, mdOpts) : esc(t)));
}

// ---------- visuals ----------
export function visual(v, math = false) {
  if (!v || !v.type) return '';
  const I = s => inline(s, math);
  const title = v.title ? `<div class="viz-title">${icon('sparkles')}<span>${I(v.title)}</span></div>` : '';
  let body = '';
  switch (v.type) {
    case 'pyramid': {
      const lv = [...(v.levels || [])].reverse(); // render top first
      const n = lv.length;
      body = `<div class="viz-pyramid">${lv.map((l, i) => `
        <div class="pyr-row" style="--w:${Math.round(38 + (62 * (i + 1)) / n)}%;--i:${i}">
          <div class="pyr-bar"><b>${I(l.label)}</b>${l.sub ? `<small>${I(l.sub)}</small>` : ''}</div>
          ${l.note ? `<div class="pyr-note">${I(l.note)}</div>` : ''}
        </div>`).join('')}</div>`;
      break;
    }
    case 'flow':
      body = `<ol class="viz-flow">${(v.steps || []).map((s, i) => `
        <li style="--i:${i}"><span class="num">${i + 1}</span><div><b>${I(s.label)}</b>${s.sub ? `<small>${I(s.sub)}</small>` : ''}</div></li>`).join('')}</ol>`;
      break;
    case 'cycle': {
      const n = (v.steps || []).length;
      body = `<div class="viz-cycle" style="--n:${n}">${(v.steps || []).map((s, i) => `
        <div class="cyc-step" style="--i:${i}"><span class="num">${i + 1}</span><b>${I(s.label)}</b>${s.sub ? `<small>${I(s.sub)}</small>` : ''}</div>`).join('')}
        <div class="cyc-center">${icon('refresh-cw')}</div></div>`;
      break;
    }
    case 'compare': {
      const cols = v.cols || [];
      body = `<div class="viz-compare" style="--c:${cols.length}">
        <div class="cmp-head"><span></span>${cols.map((c, i) => `<span class="cmp-col c${i}">${I(c)}</span>`).join('')}</div>
        ${(v.rows || []).map(r => `<div class="cmp-row"><span class="cmp-k">${I(r.k)}</span>${(r.v || []).map((x, i) => `<span class="cmp-v c${i}"><em class="cmp-tag">${I(cols[i] || '')}</em>${I(x)}</span>`).join('')}</div>`).join('')}
      </div>`;
      break;
    }
    case 'cards':
      body = `<div class="viz-cards">${(v.items || []).map((c, i) => `
        <div class="vc" style="--i:${i}">${c.tag ? `<span class="vc-tag">${I(c.tag)}</span>` : ''}<b>${I(c.label)}</b>${c.sub ? `<small>${I(c.sub)}</small>` : ''}</div>`).join('')}</div>`;
      break;
    case 'tree':
      body = `<div class="viz-tree"><div class="tree-root">${I(v.root)}</div><div class="tree-branches">${(v.branches || []).map((b, i) => `
        <div class="tree-br" style="--i:${i}"><div class="tree-label">${I(b.label)}</div>${(b.items || []).length ? `<ul>${b.items.map(x => `<li>${I(x)}</li>`).join('')}</ul>` : ''}</div>`).join('')}</div></div>`;
      break;
    case 'numbers':
      body = `<div class="viz-numbers">${(v.items || []).map((c, i) => `
        <div class="vn" style="--i:${i}"><span class="vn-val" dir="ltr">${esc(c.value)}</span><b>${I(c.label || '')}</b>${c.sub ? `<small>${I(c.sub)}</small>` : ''}</div>`).join('')}</div>`;
      break;
    case 'timeline':
      body = `<ol class="viz-timeline">${(v.items || []).map((c, i) => `
        <li style="--i:${i}"><span class="tl-when">${I(c.when || '')}</span><div><b>${I(c.label)}</b>${c.sub ? `<small>${I(c.sub)}</small>` : ''}</div></li>`).join('')}</ol>`;
      break;
    default:
      return '';
  }
  return `<figure class="viz viz-${v.type}-wrap">${title}${body}</figure>`;
}
