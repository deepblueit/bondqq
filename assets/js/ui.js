import { icon } from './icons.js';
import { esc } from './render.js';
import { SUBJECT } from './config.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function toast(msg, kind = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.innerHTML = `${icon(kind === 'ok' ? 'circle-check' : kind === 'warn' ? 'triangle-alert' : 'info')}<span>${esc(msg)}</span>`;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 2600);
}

export function celebrate(big = false) {
  if (!window.confetti) return;
  const colors = ['#FF5A36', '#FFD84D', '#5B5BD6', '#0E9F6E', '#0B8FC7', '#8B5CF6'];
  window.confetti({ particleCount: big ? 160 : 70, spread: big ? 100 : 70, origin: { y: 0.75 }, colors, disableForReducedMotion: true });
}

export function ring(pct, size = 56, stroke = 6, color = 'var(--sub)') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

export function subStyle(sid) {
  const s = SUBJECT[sid];
  return s ? `--sub:${s.color};--sub-soft-l:${s.soft};` : '';
}

export function chip(sid, extra = '') {
  const s = SUBJECT[sid];
  if (!s) return '';
  return `<span class="chip sub-chip" style="${subStyle(sid)}">${icon(s.icon)}<span>${esc(s.short)}</span>${extra}</span>`;
}

export function modal(htmlStr, { onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="icon-btn modal-x" aria-label="إغلاق">${icon('x')}</button>${htmlStr}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('in'));
  const close = () => { wrap.classList.remove('in'); setTimeout(() => wrap.remove(), 200); onClose && onClose(); };
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('.modal-x') || e.target.closest('[data-close]')) close(); });
  return { el: wrap, close };
}

export function emptyState(title, sub, ic = 'hourglass') {
  return `<div class="empty">${icon(ic)}<h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;
}

// simple count-down timer component bound to an element
export function makeTimer(el, totalMs, { onEnd, label = '' } = {}) {
  let left = totalMs, running = false, last = 0, raf = 0;
  const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); const m = Math.floor(s / 60), x = s % 60; return `${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };
  const draw = () => {
    el.querySelector('.tm-val').textContent = fmt(left);
    el.querySelector('.tm-bar i').style.width = `${(100 * (1 - left / totalMs)).toFixed(1)}%`;
    el.classList.toggle('running', running);
    el.classList.toggle('low', left < 5 * 60000);
    el.querySelector('.tm-toggle').innerHTML = icon(running ? 'pause' : 'play');
  };
  const tick = t => {
    if (!running) return;
    left -= t - last; last = t;
    if (left <= 0) { left = 0; running = false; draw(); onEnd && onEnd(); return; }
    draw(); raf = requestAnimationFrame(tick);
  };
  el.innerHTML = `<button class="tm-toggle icon-btn" aria-label="تشغيل">${icon('play')}</button>
    <div class="tm-main"><span class="tm-label">${esc(label)}</span><span class="tm-val">${fmt(left)}</span><span class="tm-bar"><i></i></span></div>
    <button class="tm-reset icon-btn" aria-label="من الأول">${icon('rotate-ccw')}</button>`;
  el.classList.add('timer');
  el.querySelector('.tm-toggle').onclick = () => { running = !running; if (running) { last = performance.now(); raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf); draw(); };
  el.querySelector('.tm-reset').onclick = () => { running = false; cancelAnimationFrame(raf); left = totalMs; draw(); };
  draw();
  return { start() { if (!running) el.querySelector('.tm-toggle').click(); }, stop() { running = false; cancelAnimationFrame(raf); draw(); }, get left() { return left; } };
}
