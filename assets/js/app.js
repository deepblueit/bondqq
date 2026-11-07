import { SUBJECTS, SUBJECT, APP_VERSION } from './config.js';
import { icon } from './icons.js';
import { S, save, settings, setSetting, isDone, markDone, unmarkDone, exportCode, importCode, resetAll } from './store.js';
import { buildTasks, buildPlan, taskMap, contentSig } from './plan.js';
import { homeView, planView, settingsView, guideView, importView, onboarding } from './views1.js';
import { subjectView, aboutView, lessonView, bankView, drillView, mocksView, mockView, cardsView, lastView, morningView, labView, handleQ } from './views2.js';
import { toast, celebrate, $, $$ } from './ui.js';

const ctx = { content: {}, tasks: [], tm: {}, qIndex: {}, route: null };

async function loadContent() {
  await Promise.all(SUBJECTS.map(async s => {
    try {
      const r = await fetch(`data/${s.id}.json?v=${APP_VERSION}`, { cache: 'no-cache' });
      if (r.ok) ctx.content[s.id] = await r.json();
    } catch (e) { /* offline and not cached yet */ }
  }));
  ctx.tasks = buildTasks(ctx.content);
  ctx.tm = taskMap(ctx.tasks);
  ctx.qIndex = {};
  for (const s of SUBJECTS) (ctx.content[s.id]?.questions || []).forEach(q => { ctx.qIndex[q.id] = q; });
}

function makePlan() {
  const st = S();
  st.plan = buildPlan({ now: Date.now(), settings: st.settings, tasks: ctx.tasks, done: st.done });
  save();
}

ctx.replan = msg => { makePlan(); if (msg) toast(msg); render(); };
ctx.render = () => render();
ctx.onProgress = () => updateChrome();

function ensurePlan() {
  const st = S();
  const sig = contentSig(ctx.tasks);
  if (!st.plan) { makePlan(); return; }
  if (st.plan.sig !== sig) {
    const stale = st.plan.blocks.some(b => b.task && !ctx.tm[b.task]);
    const anyDone = Object.keys(st.done).some(id => st.done[id] > st.plan.createdAt);
    if (stale || !anyDone) makePlan();
  }
}

// ---------- routing ----------
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const seg = path.split('/').filter(Boolean);
  return { path, seg, query };
}

function resolve({ seg, query }) {
  if (!seg.length) return ['home', homeView, {}];
  const [a, b, c, d] = seg;
  if (a === 'plan') return ['plan', planView, { day: query.day }];
  if (a === 'settings') return ['settings', settingsView, {}];
  if (a === 'guide') return ['guide', guideView, { sec: b }];
  if (a === 'lab') return ['lab', labView, {}];
  if (a === 'import') return ['import', importView, { code: b }];
  if (a === 'drill') return ['drill', drillView, { tid: b }];
  if (a === 's' && b) {
    if (!c) return ['subject', subjectView, { sid: b }];
    if (c === 'u') return ['lesson', lessonView, { sid: b, uid: d }];
    if (c === 'q') return ['bank', bankView, { sid: b, query }];
    if (c === 'cards') return ['cards', cardsView, { sid: b, query }];
    if (c === 'mocks') return ['mocks', mocksView, { sid: b }];
    if (c === 'mock') return ['mock', mockView, { sid: b, i: d || 0 }];
    if (c === 'last') return ['last', lastView, { sid: b }];
    if (c === 'morning') return ['morning', morningView, { sid: b }];
    if (c === 'about') return ['about', aboutView, { sid: b }];
  }
  return ['home', homeView, {}];
}

let tickTimer = 0;
function render({ keepScroll = false } = {}) {
  const r = parseHash();
  const [name, view, params] = resolve(r);
  const main = $('#main');
  const y = window.scrollY;
  const out = view(ctx, params) || { html: '' };
  main.innerHTML = out.html;
  main.dataset.view = name;
  ctx.route = name;
  out.mount && out.mount(main);
  if (window.katex === undefined) { /* math renders as code until KaTeX loads */ }
  updateChrome(name);
  if (keepScroll) window.scrollTo(0, y);
  else if (!location.hash.includes('#ls-')) window.scrollTo(0, 0);
  clearInterval(tickTimer);
  if (out.tick) tickTimer = setInterval(() => { if (!document.hidden && ctx.route === name && !main.contains(document.activeElement) ) render({ keepScroll: true }); }, out.tick);
}

function updateChrome(name = ctx.route) {
  const st = S();
  $$('.nav-link').forEach(a => a.classList.toggle('on', a.dataset.nav === navGroup(name)));
  const xp = $('#xpVal'); if (xp) xp.textContent = st.xp || 0;
  const m = $('#modeBtn');
  if (m) { m.innerHTML = st.settings.mode === 'together' ? `${icon('users')}<span>مع يوسف</span>` : `${icon('user')}<span>لوحدي</span>`; m.classList.toggle('on', st.settings.mode === 'together'); }
}
const navGroup = n => (['home'].includes(n) ? 'home' : n === 'plan' ? 'plan' : ['settings', 'import'].includes(n) ? 'settings' : ['guide', 'lab'].includes(n) ? 'tools' : 'subjects');

function applyTheme() {
  const st = settings();
  const root = document.documentElement;
  if (st.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', st.theme);
  root.style.fontSize = `${100 * (+st.font || 1)}%`;
}

// ---------- global actions ----------
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  if (handleQ(ctx, act, btn)) return;
  switch (act) {
    case 'toggle-task': {
      const id = btn.dataset.id;
      if (isDone(id)) { unmarkDone(id); toast('اتشالت العلامة', 'info'); }
      else { markDone(id, 25); toast('عاش! خلصت'); celebrate(); }
      render({ keepScroll: true });
      break;
    }
    case 'done-now': case 'task-done': case 'unit-done': {
      markDone(btn.dataset.id, act === 'unit-done' ? 50 : 30);
      celebrate(true);
      toast(act === 'unit-done' ? 'الوحدة خلصت، برافو عليكي' : 'خلصت، كملي كده');
      render({ keepScroll: true });
      break;
    }
    case 'replan':
      ctx.replan('رتبت الخطة من دلوقتي على الوقت اللي باقي');
      break;
    case 'mode':
      setSetting('mode', btn.dataset.v);
      toast(btn.dataset.v === 'together' ? 'وضع المذاكرة مع يوسف' : 'وضع المذاكرة لوحدك', 'info');
      render({ keepScroll: true });
      break;
    case 'mode-toggle':
      setSetting('mode', settings().mode === 'together' ? 'solo' : 'together');
      render({ keepScroll: true });
      break;
    case 'theme': setSetting('theme', btn.dataset.v); applyTheme(); render({ keepScroll: true }); break;
    case 'theme-toggle': {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
      setSetting('theme', dark ? 'light' : 'dark'); applyTheme(); break;
    }
    case 'font': setSetting('font', +btn.dataset.v); applyTheme(); render({ keepScroll: true }); break;
    case 'work-day': {
      const w = settings().work; const v = +btn.dataset.v;
      w.days = w.days.includes(v) ? w.days.filter(x => x !== v) : [...w.days, v].sort();
      save(); ctx.replan('اتظبطت أيام الشغل'); break;
    }
    case 'share': {
      const url = `${location.origin}${location.pathname}#/import/${exportCode()}`;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('اتنسخ اللينك، ابعتيه'), () => prompt('انسخي اللينك ده:', url));
      break;
    }
    case 'import': {
      try { const p = importCode(btn.dataset.code); toast(`اتضاف ${(p.d || []).length} مهمة`); location.hash = '#/'; }
      catch (err) { toast('اللينك مش سليم', 'warn'); }
      break;
    }
    case 'import-paste': {
      const v = ($('#impIn') || {}).value || '';
      const m = v.match(/#\/import\/([A-Za-z0-9_-]+)/);
      if (m) location.hash = `#/import/${m[1]}`; else toast('اللينك مش سليم', 'warn');
      break;
    }
    case 'reset':
      if (confirm('متأكدة؟ هيتمسح كل التقدم والخطة.')) { resetAll(); makePlan(); toast('بدأنا من الأول', 'info'); location.hash = '#/'; render(); }
      break;
    case 'flip': btn.classList.toggle('flipped'); break;
    case 'mem-hide': {
      const box = btn.closest('.mem'); box.classList.toggle('hidden-mode');
      btn.innerHTML = box.classList.contains('hidden-mode') ? `${icon('eye')} اظهري تاني` : `${icon('eye-off')} خبي واختبري نفسك`;
      break;
    }
    case 'present': document.body.classList.toggle('present'); break;
    case 'print': window.print(); break;
    case 'onboard': onboarding(ctx); break;
  }
});

// reveal hidden memorize items one by one when in test mode
document.addEventListener('click', e => {
  const li = e.target.closest('.mem.hidden-mode .mem-list li');
  if (li) li.classList.toggle('peek');
});

document.addEventListener('change', e => {
  const s = e.target.closest('select[data-nav]');
  if (s) location.hash = s.dataset.nav.replace('__U__', encodeURIComponent(s.value)).replace(/([?&])unit=(&|$)/, '$1').replace(/[?&]$/, '');
});

window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#ls-')) return;
  render();
});

// in-lesson anchor links should scroll, not route
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#ls-"]');
  if (!a) return;
  e.preventDefault();
  const t = document.getElementById(a.getAttribute('href').slice(1));
  t && t.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------- boot ----------
async function boot() {
  applyTheme();
  $('#main').innerHTML = `<div class="boot">${icon('sparkles')}<span>بنجهز الخطة...</span></div>`;
  await loadContent();
  ensurePlan();
  render();
  if (!settings().onboarded && !location.hash.startsWith('#/import')) setTimeout(() => onboarding(ctx), 350);
  if ('serviceWorker' in navigator && location.protocol === 'https:' && location.hostname.endsWith('github.io')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ['home', 'plan'].includes(ctx.route)) render({ keepScroll: true }); });
}
boot();
