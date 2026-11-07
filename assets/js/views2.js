// Subject pages: lessons, question bank, drills, mocks, flashcards, night/morning review, probability lab.
import { SUBJECTS, SUBJECT, HELPER, STUDENT, TYPE_LABEL, PRIORITY_LABEL, CONF_LABEL } from './config.js';
import { icon } from './icons.js';
import { esc, md, inline, visual } from './render.js';
import { S, save, settings, isDone, markDone, qStatus, setQ, cardBox, setCard, addMock, award } from './store.js';
import { time, dateLong, weekday, until, dur, MIN, count } from './time.js';
import { taskRoute } from './plan.js';
import { ring, chip, subStyle, toast, celebrate, emptyState, makeTimer, $, $$ } from './ui.js';
import { subjectProgress } from './views1.js';

const isMath = sid => sid === 'stats';

function needContent(ctx, sid) {
  const s = SUBJECT[sid];
  if (!s) return { html: emptyState('المادة دي مش موجودة', '', 'circle-help', ['#/', 'للرئيسية']) };
  if (!ctx.content[sid]) return { html: subHeader(ctx, sid, '') + emptyState('المحتوى بيتجهز', 'شوية وهيكون هنا. الخطة حاجزاله وقته بالفعل.', 'hourglass') };
  return null;
}

function subHeader(ctx, sid, tab) {
  const s = SUBJECT[sid];
  const now = Date.now();
  const pr = subjectProgress(ctx, sid);
  const tabs = [['', 'الدروس', 'book-open'], ['q', 'بنك الأسئلة', 'pen-line'], ['cards', 'فلاش كاردز', 'layers'], ['mocks', 'النماذج', 'file-text'], ['last', 'ليلة الامتحان', 'moon-star'], ['about', 'عن المادة', 'info']];
  return `<header class="sub-hero" style="${subStyle(sid)}">
    <div class="sh-main">
      <a class="crumb" href="#/">${icon('arrow-right')} الرئيسية</a>
      <h1>${icon(s.icon)} ${esc(s.title)}</h1>
      <p>${esc(s.doctor)} · امتحانها ${dateLong(s.startTs)} الساعة 12 الضهر ${s.startTs > now ? `· <b>بعد ${until(s.startTs, now)}</b>` : '· خلص'}</p>
    </div>
    <div class="sh-ring">${ring(pr, 74, 8, '#fff')}<span>${Math.round(pr * 100)}%</span></div>
  </header>
  <nav class="tabs sub-tabs" style="${subStyle(sid)}">${tabs.map(([k, l, ic]) => `<a class="tab ${k === tab ? 'on' : ''}" href="#/s/${sid}${k ? '/' + k : ''}">${icon(ic)}${l}</a>`).join('')}</nav>`;
}

// ---------- SUBJECT: lessons ----------
export function subjectView(ctx, { sid }) {
  const miss = needContent(ctx, sid); if (miss) return miss;
  const c = ctx.content[sid];
  const units = c.units.map((u, i) => {
    const done = isDone(u.id);
    return `<a class="unit-card card ${done ? 'done' : ''}" href="#/s/${sid}/u/${u.id}" style="${subStyle(sid)}">
      <span class="uc-num">${done ? icon('check') : i + 1}</span>
      <div class="uc-body"><b>${esc(u.title)}</b><small>${esc(u.subtitle || '')}</small>
        <div class="uc-meta"><span class="pri p${u.priority}">${PRIORITY_LABEL[u.priority]}</span><span>${icon('clock')} ${dur(u.minutes)}</span>${u.confidence !== 'high' ? `<span class="conf" title="${esc(CONF_LABEL[u.confidence])}">${icon('info')} راجعيه على الكتاب</span>` : ''}</div>
      </div>${icon('chevron-left', 'uc-arrow')}</a>`;
  }).join('');
  const prac = ctx.tasks.filter(t => t.sid === sid && t.kind !== 'lesson').map(t => `
    <a class="task-row ${isDone(t.id) ? 'done' : ''}" href="${taskRoute(t)}"><span class="tr-ic">${icon(isDone(t.id) ? 'circle-check' : { drill: 'pen-line', mock: 'file-text', cards: 'layers', night: 'moon-star', morning: 'sunrise' }[t.kind])}</span><b>${esc(t.title)}</b><small>${dur(t.minutes)}</small></a>`).join('');
  const html = `${subHeader(ctx, sid, '')}
    <section class="sec"><div class="sec-head"><h2>${icon('book-open')} الدروس بالترتيب</h2><span class="muted">${count(c.units.length, 'وحدة', 'وحدتين', 'وحدات')} · ${dur(c.units.reduce((a, u) => a + u.minutes, 0))}</span></div><div class="unit-list">${units}</div></section>
    <section class="sec"><div class="sec-head"><h2>${icon('target')} التدريب والمراجعة</h2></div><div class="task-list card">${prac}</div></section>`;
  return { html };
}

export function aboutView(ctx, { sid }) {
  const miss = needContent(ctx, sid); if (miss) return miss;
  const c = ctx.content[sid];
  return { html: `${subHeader(ctx, sid, 'about')}<div class="prose-wrap">
    <section class="card prose"><h3>${icon('book-marked')} المحتوى ده مبني على إيه</h3>${md(c.sourceNote, isMath(sid))}</section>
    <section class="card prose"><h3>${icon('target')} المنهج المتوقع في الميدترم</h3>${md(c.scope, isMath(sid))}</section>
    <section class="card prose"><h3>${icon('notebook-pen')} شكل الأسئلة وإزاي تجاوبي</h3>${md(c.examStyle, isMath(sid))}</section></div>` };
}

// ---------- LESSON ----------
export function lessonView(ctx, { sid, uid }) {
  const miss = needContent(ctx, sid); if (miss) return miss;
  const c = ctx.content[sid];
  const i = c.units.findIndex(u => u.id === uid);
  if (i < 0) return { html: emptyState('الدرس ده مش موجود', '', 'circle-help', [`#/s/${sid}`, 'لدروس المادة']) };
  const u = c.units[i];
  const m = isMath(sid);
  const mode = settings().mode;
  const qs = c.questions.filter(q => q.unit === u.id);
  const nextU = c.units[i + 1];
  const done = isDone(u.id);

  const together = `<div class="role-card together"><div class="rc-head">${icon('users')}<b>مع ${HELPER}</b><small>${HELPER} يعمل معاكي ده</small></div><ol>${(u.together || []).map(x => `<li>${inline(x, m)}</li>`).join('')}</ol></div>`;
  const solo = `<div class="role-card solo"><div class="rc-head">${icon('user')}<b>لوحدك</b><small>اعملي ده بنفسك</small></div><ol>${(u.solo || []).map(x => `<li>${inline(x, m)}</li>`).join('')}</ol></div>`;

  const html = `
  <div class="lesson" style="${subStyle(sid)}">
    <div class="lesson-top">
      <a class="crumb" href="#/s/${sid}">${icon('arrow-right')} ${esc(SUBJECT[sid].short)}</a>
      <div class="lt-tools"><button class="icon-btn" data-act="present" title="وضع الشرح">${icon('presentation')}</button><div class="timer-slot" id="lessonTimer"></div></div>
    </div>
    <header class="lesson-head">
      <span class="unit-badge">الوحدة ${i + 1} من ${c.units.length}</span>
      <h1>${esc(u.title)}</h1>
      ${u.subtitle ? `<p class="sub">${inline(u.subtitle, m)}</p>` : ''}
      <div class="uc-meta"><span class="pri p${u.priority}">${PRIORITY_LABEL[u.priority]}</span><span>${icon('clock')} ${dur(u.minutes)}</span><span>${icon('book-marked')} ${esc(u.source || '')}</span></div>
      ${u.confidence !== 'high' ? `<div class="conf-note">${icon('info')} ${esc(CONF_LABEL[u.confidence])}</div>` : ''}
    </header>

    <nav class="lesson-steps" id="lsteps">
      <a href="#ls-hook">${icon('lightbulb')}الفكرة</a><a href="#ls-story">${icon('book-open')}الشرح</a>${u.visual ? `<a href="#ls-viz">${icon('sparkles')}الرسمة</a>` : ''}<a href="#ls-keys">${icon('list')}النقط</a>${u.memorize ? `<a href="#ls-mem">${icon('brain')}احفظي</a>` : ''}<a href="#ls-act">${icon('users')}نشاط</a><a href="#ls-check">${icon('target')}اختبري</a>${qs.length ? `<a href="#ls-exam">${icon('pen-line')}سؤال امتحان</a>` : ''}
    </nav>

    <section id="ls-hook" class="hook card"><span class="hook-label">${icon('lightbulb')} الفكرة في جملة</span><p>${inline(u.hook, m)}</p></section>

    <section id="ls-story" class="card prose story">${md(u.story, m)}</section>

    ${u.visual ? `<section id="ls-viz" class="card viz-card">${visual(u.visual, m)}</section>` : ''}

    <section id="ls-keys" class="sec"><div class="sec-head"><h2>${icon('list')} أهم النقط</h2></div>
      <div class="points">${(u.points || []).map((p, k) => `<div class="point card"><span class="pt-num">${k + 1}</span><div><b>${inline(p.t, m)}</b><p>${inline(p.d, m)}</p></div></div>`).join('')}</div>
    </section>

    ${(u.terms || []).length ? `<section class="sec"><div class="sec-head"><h2>${icon('bookmark')} المصطلحات</h2><small class="muted">اضغطي على الكارت يقلب</small></div>
      <div class="terms">${u.terms.map(t => `<button class="term" data-act="flip"><span class="tf-front"><b>${inline(t.ar, m)}</b><em dir="ltr">${esc(t.en || '')}</em></span><span class="tf-back">${inline(t.def, m)}</span></button>`).join('')}</div></section>` : ''}

    ${u.memorize ? `<section id="ls-mem" class="mem card"><div class="mem-head"><h2>${icon('brain')} ${inline(u.memorize.title, m)}</h2><button class="btn small soft" data-act="mem-hide">${icon('eye-off')} خبي واختبري نفسك</button></div>
      <ol class="mem-list">${(u.memorize.items || []).map(x => `<li><span>${inline(String(x).replace(/^\s*\d+[.)\-]\s+/, ''), m)}</span></li>`).join('')}</ol>
      ${u.memorize.trick ? `<div class="trick">${icon('wand-sparkles')}<div><b>تريكة الحفظ</b><p>${inline(u.memorize.trick, m)}</p></div></div>` : ''}</section>` : ''}

    <section id="ls-act" class="sec"><div class="sec-head"><h2>${icon(mode === 'together' ? 'users' : 'user')} ${mode === 'together' ? `نشاط مع ${HELPER}` : 'نشاط لوحدك'}</h2><button class="mini-link" data-act="mode" data-v="${mode === 'together' ? 'solo' : 'together'}">${mode === 'together' ? 'أنا لوحدي دلوقتي' : `${HELPER} معايا دلوقتي`}</button></div>
      ${mode === 'together' ? together + solo.replace('role-card solo', 'role-card solo dim') : solo}
    </section>

    <section id="ls-check" class="sec"><div class="sec-head"><h2>${icon('target')} اختبري نفسك</h2><small class="muted">جاوبي في دماغك الأول، وبعدين اضغطي</small></div>
      <div class="checks">${(u.check || []).map(ch => `<details class="check card"><summary>${icon('circle-help')}<span>${inline(ch.q, m)}</span></summary><div class="ans">${inline(ch.a, m)}</div></details>`).join('')}</div>
    </section>

    ${qs.length ? `<section id="ls-exam" class="sec"><div class="sec-head"><h2>${icon('pen-line')} أسئلة امتحان على الوحدة دي</h2><small class="muted">${count(qs.length, 'سؤال واحد', 'سؤالين', 'أسئلة')}</small></div>
      <div class="q-list">${qs.slice().sort((a, b) => b.likely - a.likely).map(q => qCard(q, sid)).join('')}</div></section>` : ''}

    <div class="lesson-end card">
      ${done ? `<div class="done-msg">${icon('party-popper')}<b>الوحدة دي خلصانة</b></div>` : `<button class="btn primary big" data-act="unit-done" data-id="${u.id}">${icon('check')} خلصت الوحدة دي</button>`}
      ${nextU ? `<a class="btn soft big" href="#/s/${sid}/u/${nextU.id}">الوحدة الجاية: ${esc(nextU.title)} ${icon('arrow-left')}</a>` : `<a class="btn soft big" href="#/s/${sid}/q?likely=1">${icon('target')} يلا على الأسئلة المتوقعة</a>`}
    </div>
  </div>`;
  return {
    html, mount: el => {
      const slot = el.querySelector('#lessonTimer');
      slot && makeTimer(slot, u.minutes * MIN, { label: 'وقت الوحدة', onEnd: () => toast('وقت الوحدة خلص، لو فاضل حاجة كمليها بسرعة', 'info') });
    }
  };
}

// ---------- QUESTION CARD ----------
export function qCard(q, sid, { num = null, paper = false } = {}) {
  const m = isMath(sid);
  const status = qStatus(q.id);
  const head = `<div class="q-head">${num ? `<span class="q-num">${num}</span>` : ''}<span class="tag t-${q.type}">${TYPE_LABEL[q.type] || q.type}</span>${q.likely ? `<span class="tag likely">${icon('star')} متوقع</span>` : ''}${q.tag ? `<span class="tag src">${esc(q.tag)}</span>` : ''}<span class="q-min">${icon('timer')} ${q.minutes} د</span>${status && !paper ? `<span class="q-status ${status}">${status === 'known' ? 'عارفاه' : 'محتاجة أرجعله'}</span>` : ''}</div>`;
  const text = `<div class="q-text">${inline(q.q, m)}</div>`;
  const hint = q.hint && !paper ? `<details class="hint"><summary>${icon('lightbulb')} تلميح</summary><p>${inline(q.hint, m)}</p></details>` : '';
  const keys = (q.keys || []).length ? `<div class="keys"><b>${icon('list-checks')} صححي لنفسك: علمي على النقط اللي جت في إجابتك</b>${q.keys.map((k, i) => `<label class="key"><input type="checkbox" data-act="key" data-i="${i}"><span>${inline(k, m)}</span></label>`).join('')}<div class="key-score"></div></div>` : '';
  const rate = `<div class="rate"><button class="btn small ok" data-act="q-rate" data-v="known">${icon('circle-check')} عارفاه</button><button class="btn small warn" data-act="q-rate" data-v="review">${icon('rotate-ccw')} محتاجة أرجعله</button></div>`;
  let body = '';
  if (q.type === 'mcq') {
    body = `<div class="choices">${(q.choices || []).map((c, i) => `<button class="choice" data-act="mcq" data-i="${i}"><span class="ch-l">${'أبجد'[i] || i + 1}</span><span>${inline(c, m)}</span></button>`).join('')}</div><div class="q-explain" hidden>${md(q.a, m)}</div>`;
  } else if (q.type === 'tf') {
    body = `<div class="choices tf"><button class="choice" data-act="tf" data-v="1">${icon('check')} صح</button><button class="choice" data-act="tf" data-v="0">${icon('x')} غلط</button></div><div class="q-explain" hidden>${md(q.a, m)}</div>`;
  } else if (q.type === 'problem') {
    body = `${paper ? '' : `<div class="q-actions"><button class="btn small primary" data-act="step">${icon('play')} اعرضي أول خطوة</button><button class="btn small ghost" data-act="reveal">${icon('eye')} الحل كله</button></div>`}
      <ol class="steps-list">${(q.steps || []).map(s => `<li hidden>${md(s, m)}</li>`).join('')}</ol>
      <div class="q-answer" hidden><div class="final">${icon('target')} الناتج النهائي: <b dir="auto">${inline(q.final || '', m)}</b></div><details class="full"><summary>الحل بالتفصيل</summary><div class="prose">${md(q.a, m)}</div></details>${keys}${rate}</div>`;
  } else {
    body = `${paper ? `<textarea class="answer-box" placeholder="اكتبي هنا، أو في ورقة جنبك وده أحسن"></textarea>` : `<div class="q-actions"><button class="btn small primary" data-act="reveal">${icon('eye')} الإجابة النموذجية</button><button class="btn small ghost" data-act="write">${icon('pen-line')} أكتب الأول</button></div><textarea class="answer-box" hidden placeholder="اكتبي إجابتك هنا، وبعدين قارنيها بالنموذجية"></textarea>`}
      <div class="q-answer" hidden><div class="model prose">${md(q.a, m)}</div>${keys}${rate}</div>`;
  }
  return `<article class="q-card ${status || ''}" data-qid="${q.id}" data-sid="${sid}" data-type="${q.type}">${head}${text}${hint}${body}</article>`;
}

// handlers for question cards (called from the global click handler)
export function handleQ(ctx, act, btn) {
  const card = btn.closest('.q-card'); if (!card) return false;
  const q = ctx.qIndex[card.dataset.qid]; if (!q) return false;
  const paper = card.classList.contains('paper');
  if (act === 'reveal') { card.querySelector('.q-answer').hidden = false; card.querySelectorAll('.steps-list li').forEach(li => li.hidden = false); btn.closest('.q-actions') && (btn.closest('.q-actions').hidden = true); return true; }
  if (act === 'write') { const ta = card.querySelector('.answer-box'); ta.hidden = false; ta.focus(); btn.hidden = true; return true; }
  if (act === 'step') {
    const hidden = [...card.querySelectorAll('.steps-list li[hidden]')];
    if (hidden.length) { hidden[0].hidden = false; btn.innerHTML = `${icon('play')} الخطوة اللي بعدها`; }
    if (hidden.length <= 1) { card.querySelector('.q-answer').hidden = false; btn.hidden = true; }
    return true;
  }
  if (act === 'mcq' || act === 'tf') {
    if (card.dataset.answered && !paper) return true;
    const picked = act === 'mcq' ? +btn.dataset.i : btn.dataset.v === '1';
    if (paper) { card.querySelectorAll('.choice').forEach(c => c.classList.toggle('picked', c === btn)); card.dataset.pick = String(picked); return true; }
    gradeChoice(card, q, picked);
    return true;
  }
  if (act === 'key') { keyScore(card); return true; }
  if (act === 'q-rate') {
    setQ(q.id, btn.dataset.v); card.classList.remove('known', 'review'); card.classList.add(btn.dataset.v);
    if (btn.dataset.v === 'known') award('q:' + q.id, 5);
    const head = card.querySelector('.q-head');
    if (head) { let chipEl = head.querySelector('.q-status'); if (!chipEl) { chipEl = document.createElement('span'); head.appendChild(chipEl); } chipEl.className = `q-status ${btn.dataset.v}`; chipEl.textContent = btn.dataset.v === 'known' ? 'عارفاه' : 'محتاجة أرجعله'; }
    toast(btn.dataset.v === 'known' ? 'تمام، اتسجل إنك عارفاه' : 'اتسجل، هيظهرلك في المراجعة', btn.dataset.v === 'known' ? 'ok' : 'info');
    ctx.onProgress && ctx.onProgress();
    return true;
  }
  return false;
}

export function gradeChoice(card, q, picked) {
  card.dataset.answered = '1';
  const right = q.type === 'mcq' ? q.answer : q.answer === true;
  const btns = [...card.querySelectorAll('.choice')];
  if (q.type === 'mcq') btns.forEach((b, i) => { b.classList.toggle('right', i === q.answer); b.classList.toggle('wrong', i === picked && picked !== q.answer); });
  else btns.forEach(b => { const v = b.dataset.v === '1'; b.classList.toggle('right', v === q.answer); b.classList.toggle('wrong', v === picked && picked !== q.answer); });
  const ok = q.type === 'mcq' ? picked === q.answer : picked === q.answer;
  card.querySelector('.q-explain').hidden = false;
  setQ(q.id, ok ? 'known' : 'review');
  card.classList.add(ok ? 'known' : 'review');
  return ok;
}

function keyScore(card) {
  const ks = [...card.querySelectorAll('.keys input')];
  const n = ks.filter(k => k.checked).length;
  const p = ks.length ? n / ks.length : 0;
  const msg = p >= 0.85 ? 'ممتاز! دي إجابة درجتها كاملة تقريبا' : p >= 0.6 ? 'كويسة، زودي النقط الناقصة وتبقى كاملة' : p > 0 ? 'محتاجة ترجعي للنقط الناقصة دي' : '';
  const el = card.querySelector('.key-score');
  if (el) el.innerHTML = n ? `<span class="${p >= 0.85 ? 'ok' : p >= 0.6 ? 'mid' : 'low'}">${n} من ${ks.length} نقط · ${msg}</span>` : '';
  return p;
}

// ---------- QUESTION BANK ----------
export function bankView(ctx, { sid, query }) {
  const miss = needContent(ctx, sid); if (miss) return miss;
  const c = ctx.content[sid];
  const f = { likely: query.likely === '1', type: query.type || '', unit: query.unit || '', status: query.status || '' };
  let qs = c.questions.slice();
  if (f.likely) qs = qs.filter(q => q.likely);
  if (f.type) qs = qs.filter(q => (f.type === 'written' ? !['mcq', 'tf'].includes(q.type) : f.type === 'quick' ? ['mcq', 'tf'].includes(q.type) : q.type === f.type));
  if (f.unit) qs = qs.filter(q => q.unit === f.unit);
  if (f.status) qs = qs.filter(q => (f.status === 'none' ? !qStatus(q.id) : qStatus(q.id) === f.status));
  const order = Object.fromEntries(c.units.map((u, i) => [u.id, i]));
  qs.sort((a, b) => (order[a.unit] - order[b.unit]) || (b.likely - a.likely));
  const link = patch => { const p = { ...f, ...patch }; const s = Object.entries(p).filter(([, v]) => v && v !== false).map(([k, v]) => `${k}=${v === true ? 1 : encodeURIComponent(v)}`).join('&'); return `#/s/${sid}/q${s ? '?' + s : ''}`; };
  const types = [['', 'الكل'], ['written', 'مقالي ومسائل'], ['quick', 'اختيار وصح وغلط'], ['define', 'تعريفات'], ['compare', 'قارني'], ['reason', 'علل']];
  const known = c.questions.filter(q => qStatus(q.id) === 'known').length;
  const html = `${subHeader(ctx, sid, 'q')}
    <div class="bank-bar card">
      <div class="bb-stats"><b>${known}</b> من ${c.questions.length} عارفاهم ${ring(known / c.questions.length, 34, 5)}</div>
      <div class="filters">
        <a class="fchip ${f.likely ? 'on' : ''}" href="${link({ likely: !f.likely })}">${icon('star')} المتوقع بس</a>
        ${types.map(([k, l]) => `<a class="fchip ${f.type === k ? 'on' : ''}" href="${link({ type: k })}">${l}</a>`).join('')}
        <a class="fchip ${f.status === 'review' ? 'on' : ''}" href="${link({ status: f.status === 'review' ? '' : 'review' })}">${icon('rotate-ccw')} محتاجة أرجعلها</a>
        <a class="fchip ${f.status === 'none' ? 'on' : ''}" href="${link({ status: f.status === 'none' ? '' : 'none' })}">لسه مجاوبتهاش</a>
      </div>
      <select class="unit-select" data-nav="${link({ unit: '__U__' })}"><option value="">كل الوحدات</option>${c.units.map((u, i) => `<option value="${u.id}" ${f.unit === u.id ? 'selected' : ''}>الوحدة ${i + 1}: ${esc(u.title)}</option>`).join('')}</select>
    </div>
    <div class="q-list">${qs.length ? qs.map(q => qCard(q, sid)).join('') : emptyState('مفيش أسئلة بالفلتر ده', 'جربي فلتر تاني', 'circle-help')}</div>`;
  return { html };
}

// ---------- DRILL ----------
export function drillQuestions(c, k, nd) {
  const order = Object.fromEntries(c.units.map((u, i) => [u.id, i]));
  const written = c.questions.filter(q => !['mcq', 'tf'].includes(q.type)).sort((a, b) => order[a.unit] - order[b.unit]);
  const likely = written.filter(q => q.likely), rest = written.filter(q => !q.likely);
  const quick = c.questions.filter(q => ['mcq', 'tf'].includes(q.type));
  const pool = likely.concat(rest);
  const per = Math.ceil(pool.length / nd);
  const part = pool.slice((k - 1) * per, k * per);
  const qq = quick.filter((_, i) => i % nd === k - 1).slice(0, 5);
  return qq.concat(part.slice(0, 9));
}

export function drillView(ctx, { tid }) {
  const t = ctx.tm[tid];
  if (!t) return { html: emptyState('المهمة دي مش موجودة', '', 'circle-help', ['#/plan', 'للخطة']) };
  const sid = t.sid;
  const miss = needContent(ctx, sid); if (miss) return miss;
  const c = ctx.content[sid];
  const qs = drillQuestions(c, t.k, t.nd);
  const done = isDone(tid);
  const html = `${subHeader(ctx, sid, 'q')}
    <div class="drill-head card" style="${subStyle(sid)}">
      <div><span class="eyebrow">${icon('pen-line')} جولة تدريب ${t.k} من ${t.nd}</span><h2>${esc(t.title)}</h2>
      <p class="muted">${isMath(sid) ? 'حلي كل مسألة في ورقة الأول، وبعدين افتحي الخطوات وصححي.' : 'جاوبي كل سؤال في دماغك أو في ورقة، وبعدين افتحي الإجابة وعلمي على النقط اللي جبتيها.'} ${settings().mode === 'together' ? `${HELPER} يسأل وانتي تجاوبي بصوت عالي.` : ''}</p></div>
      <div class="timer-slot" id="drillTimer"></div>
    </div>
    <div class="q-list">${qs.map((q, i) => qCard(q, sid, { num: i + 1 })).join('')}</div>
    <div class="lesson-end card">${done ? `<div class="done-msg">${icon('party-popper')}<b>الجولة دي خلصانة</b></div>` : `<button class="btn primary big" data-act="task-done" data-id="${tid}">${icon('check')} خلصت الجولة</button>`}<a class="btn soft big" href="#/s/${sid}/q?status=review">${icon('rotate-ccw')} الأسئلة اللي محتاجة أرجعلها</a></div>`;
  return { html, mount: el => makeTimer(el.querySelector('#drillTimer'), t.minutes * MIN, { label: 'وقت الجولة' }) };
}

// ---------- MOCKS ----------
export function mocksView(ctx, { sid }) {
  const miss = needContent(ctx, sid); if (miss) return miss;
  const c = ctx.content[sid];
  const res = S().mocks;
  const html = `${subHeader(ctx, sid, 'mocks')}
    <div class="mock-list">${c.mocks.map((mk, i) => {
      const r = res[`${sid}-m${i + 1}`] || [];
      const best = r.length ? Math.max(...r.map(x => Math.round(100 * x.score / x.max))) : null;
      return `<a class="mock-card card" href="#/s/${sid}/mock/${i}" style="${subStyle(sid)}"><span class="mc-ic">${icon('file-text')}</span><div><b>${esc(mk.title)}</b><small>${count(mk.questions.length, 'سؤال واحد', 'سؤالين', 'أسئلة')} · ${dur(mk.minutes)}</small>${best !== null ? `<span class="best">أحسن درجة: ${best}%</span>` : ''}</div>${icon('chevron-left')}</a>`;
    }).join('')}</div>
    <div class="card callout-card">${icon('info')}<div><b>اعمليه كأنه امتحان بجد</b><p>ورقة وقلم، والموبايل على وضع الطيران، والتايمر شغال. بعد ما تخلصي اضغطي "سلمي الورقة" وصححي لنفسك بالنقط.</p></div></div>`;
  return { html };
}

export function mockView(ctx, { sid, i }) {
  const miss = needContent(ctx, sid); if (miss) return miss;
  const c = ctx.content[sid];
  const mk = c.mocks[+i];
  if (!mk) return { html: emptyState('النموذج ده مش موجود', '', 'circle-help', [`#/s/${sid}/mocks`, 'للنماذج']) };
  const qs = mk.questions.map(id => ctx.qIndex[id]).filter(Boolean);
  const ord = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];
  const html = `${subHeader(ctx, sid, 'mocks')}
    <div class="paper card" id="paper" style="${subStyle(sid)}">
      <div class="paper-head">
        <div><b>امتحان منتصف الفصل الدراسي (نموذج تدريبي)</b><span>المادة: ${esc(SUBJECT[sid].title)}</span><span>الزمن: ساعة واحدة</span></div>
        <div class="timer-slot big" id="mockTimer"></div>
      </div>
      <p class="paper-inst">${inline(mk.instructions, isMath(sid))}</p>
      <div class="q-list paper-qs">${qs.map((q, k) => `<div class="pq"><h3>السؤال ${ord[k] || k + 1}</h3>${qCard(q, sid, { paper: true }).replace('class="q-card', 'class="q-card paper')}</div>`).join('')}</div>
      <div class="paper-actions"><button class="btn primary big" data-act="mock-submit">${icon('upload')} سلمي الورقة وصححي</button></div>
      <div class="mock-result" hidden></div>
    </div>`;
  return {
    html, mount: el => {
      const tm = makeTimer(el.querySelector('#mockTimer'), mk.minutes * MIN, { label: 'باقي', onEnd: () => toast('الوقت خلص! سلمي الورقة', 'warn') });
      el.querySelector('[data-act="mock-submit"]').addEventListener('click', () => {
        tm.stop();
        el.querySelectorAll('.q-card.paper').forEach(card => {
          card.classList.remove('paper');
          const q = ctx.qIndex[card.dataset.qid];
          if (q.type === 'mcq' || q.type === 'tf') {
            const pick = card.dataset.pick;
            if (pick !== undefined) gradeChoice(card, q, q.type === 'mcq' ? +pick : pick === 'true');
            else { card.querySelector('.q-explain').hidden = false; }
          } else {
            const fresh = document.createElement('div');
            fresh.innerHTML = qCard(q, sid);
            const ans = fresh.querySelector('.q-answer');
            const steps = fresh.querySelector('.steps-list');
            const old = card.querySelector('.q-answer'); old && old.remove();
            if (steps) { const o = card.querySelector('.steps-list'); o && o.remove(); steps.querySelectorAll('li').forEach(li => li.hidden = false); card.appendChild(steps); }
            ans.hidden = false; card.appendChild(ans);
          }
        });
        el.querySelector('.paper-actions').innerHTML = `<button class="btn primary big" data-act="mock-score">${icon('calculator')} احسبي درجتي</button>`;
        let scored = false;
        el.querySelector('[data-act="mock-score"]').addEventListener('click', e => {
          e.currentTarget.innerHTML = `${icon('calculator')} احسبي تاني بعد ما تعدلي العلامات`;
          let score = 0, max = 0;
          el.querySelectorAll('.q-card').forEach(card => {
            const q = ctx.qIndex[card.dataset.qid];
            const w = q.minutes || 5; max += w;
            if (q.type === 'mcq' || q.type === 'tf') { if (card.classList.contains('known')) score += w; }
            else { const ks = [...card.querySelectorAll('.keys input')]; score += ks.length ? w * ks.filter(k => k.checked).length / ks.length : 0; }
          });
          const pct = Math.round(100 * score / max);
          // the first press records the result; pressing again after fixing the ticks updates it
          const mid = `${sid}-m${+i + 1}`;
          if (!scored) addMock(mid, score, max);
          else { const arr = S().mocks[mid] || []; if (arr.length) { arr[arr.length - 1].score = score; arr[arr.length - 1].max = max; save(); } }
          markDone(mid, 60);
          const r = el.querySelector('.mock-result');
          r.hidden = false;
          r.innerHTML = `<div class="result ${pct >= 75 ? 'ok' : pct >= 50 ? 'mid' : 'low'}">${ring(pct / 100, 96, 10)}<div><b>${pct}%</b><p>${pct >= 75 ? 'ممتاز! كده إنتي جاهزة للمادة دي.' : pct >= 50 ? 'كويس، ارجعي للنقط الناقصة في الأسئلة اللي درجتها قليلة.' : 'ولا يهمك، ده تدريب. ارجعي للدروس اللي أسئلتها وقعت وبعدين جربي النموذج التاني.'}</p></div></div>`;
          r.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (pct >= 60 && !scored) celebrate(true);
          scored = true;
          ctx.onProgress && ctx.onProgress();
        });
        toast('صححي كل سؤال بالنقط، وبعدين احسبي الدرجة', 'info');
      });
    }
  };
}

// ---------- FLASHCARDS ----------
export function cardsView(ctx, { sid, query }) {
  const miss = needContent(ctx, sid); if (miss) return miss;
  const c = ctx.content[sid];
  const unit = query.unit || '';
  let deck = c.flashcards.filter(x => !unit || x.unit === unit);
  const fresh = deck.filter(x => cardBox(x.id) < 3);
  const queue = (fresh.length ? fresh : deck).slice().sort((a, b) => cardBox(a.id) - cardBox(b.id) || Math.random() - 0.5);
  const known = deck.filter(x => cardBox(x.id) >= 2).length;
  const html = `${subHeader(ctx, sid, 'cards')}
    <div class="fc-bar card"><span>${icon('layers')} ${count(deck.length, 'كارت', 'كارتين', 'كروت')} · ثابتين: <b>${known}</b></span>
      <select class="unit-select" data-nav="#/s/${sid}/cards?unit=__U__"><option value="">كل الوحدات</option>${c.units.map((u, i) => `<option value="${u.id}" ${unit === u.id ? 'selected' : ''}>الوحدة ${i + 1}: ${esc(u.title)}</option>`).join('')}</select></div>
    <div class="fc-stage" id="fcStage" style="${subStyle(sid)}"></div>`;
  return {
    html, mount: el => {
      let k = 0, right = 0;
      const stage = el.querySelector('#fcStage');
      const draw = () => {
        if (k >= queue.length) {
          stage.innerHTML = `<div class="fc-done card">${icon('party-popper')}<h2>خلصتي اللفة!</h2><p>عرفتي ${right} من ${queue.length}. الكروت اللي لسه هتطلعلك الأول المرة الجاية.</p><div class="row"><a class="btn primary" href="#/s/${sid}/cards" data-act="reload">${icon('refresh-cw')} لفة كمان</a><a class="btn soft" href="#/s/${sid}">${icon('arrow-right')} للمادة</a></div></div>`;
          if (!isDone(`${sid}-cards`) && queue.length >= Math.min(10, deck.length)) { markDone(`${sid}-cards`, 30); celebrate(); }
          return;
        }
        const x = queue[k];
        stage.innerHTML = `<div class="fc-count">كارت ${k + 1} من ${queue.length}</div>
          <button class="flash" id="flash"><span class="fl-front">${inline(x.front, isMath(sid))}<small>${icon('rotate-ccw')} اضغطي تشوفي الإجابة</small></span><span class="fl-back">${inline(x.back, isMath(sid))}</span></button>
          <div class="fc-actions"><button class="btn warn big" id="fcNo">${icon('rotate-ccw')} لسه</button><button class="btn ok big" id="fcYes">${icon('check')} عارفاها</button></div>`;
        stage.querySelector('#flash').onclick = e => e.currentTarget.classList.toggle('flipped');
        stage.querySelector('#fcYes').onclick = () => { setCard(x.id, true); right++; k++; S().xp += 2; save(); draw(); };
        stage.querySelector('#fcNo').onclick = () => { setCard(x.id, false); k++; draw(); };
      };
      draw();
    }
  };
}

// ---------- NIGHT & MORNING ----------
export function lastView(ctx, { sid }) {
  const miss = needContent(ctx, sid); if (miss) return miss;
  const c = ctx.content[sid];
  const id = `${sid}-night`;
  const html = `${subHeader(ctx, sid, 'last')}
    <div class="card prose last-night" style="${subStyle(sid)}"><div class="ln-head"><h2>${icon('moon-star')} ملخص ليلة الامتحان</h2>${/github\.io$|localhost$/.test(location.hostname) ? `<button class="btn small soft" data-act="print">${icon('printer')} اطبعي</button>` : ''}</div>${md(c.lastNight, isMath(sid))}</div>
    <div class="lesson-end card">${isDone(id) ? `<div class="done-msg">${icon('party-popper')}<b>المراجعة خلصت، نامي بدري</b></div>` : `<button class="btn primary big" data-act="task-done" data-id="${id}">${icon('check')} خلصت المراجعة</button>`}<a class="btn soft big" href="#/s/${sid}/morning">${icon('sunrise')} مراجعة الصبح</a></div>`;
  return { html };
}

export function morningView(ctx, { sid }) {
  const miss = needContent(ctx, sid); if (miss) return miss;
  const c = ctx.content[sid];
  const id = `${sid}-morning`;
  const likely = c.questions.filter(q => q.likely && !['mcq', 'tf'].includes(q.type));
  const html = `${subHeader(ctx, sid, 'last')}
    <div class="card morning" style="${subStyle(sid)}"><h2>${icon('sunrise')} مراجعة الصبح السريعة</h2><p class="muted">مش وقت حاجة جديدة. لفة سريعة على اللي عارفاه عشان يبقى حاضر في دماغك.</p>
      <div class="m-check">${(c.morningChecklist || []).map(x => `<label class="key"><input type="checkbox"><span>${inline(x, isMath(sid))}</span></label>`).join('')}</div></div>
    <section class="sec"><div class="sec-head"><h2>${icon('star')} الأسئلة المتوقعة: افتكري النقط بس</h2></div>
      <div class="checks">${likely.map(q => `<details class="check card"><summary>${icon('circle-help')}<span>${inline(q.q, isMath(sid))}</span></summary><div class="ans prose">${(q.keys || []).length ? `<ol>${q.keys.map(k => `<li>${inline(k, isMath(sid))}</li>`).join('')}</ol>` : md(q.a, isMath(sid))}</div></details>`).join('')}</div></section>
    <div class="lesson-end card">${isDone(id) ? `<div class="done-msg">${icon('party-popper')}<b>جاهزة. ربنا معاكي</b></div>` : `<button class="btn primary big" data-act="task-done" data-id="${id}">${icon('check')} خلصت، نازلة الامتحان</button>`}</div>`;
  return { html };
}

// ---------- PROBABILITY LAB ----------
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const frac = (n, d) => { if (!n) return '0'; const g = gcd(n, d); return `${n / g}/${d / g}`; };

export function labView() {
  const html = `<div class="page-head"><h1>${icon('dice-5')} معمل الاحتمالات</h1><p class="muted">شوفي الحدث بعينك: اختاري حدث، والخانات اللي بتحققه هتنور، والاحتمال يتحسب لوحده.</p></div>
    <section class="card lab" id="diceLab">
      <h2>${icon('dice-5')} رمي زهرتين نرد (36 نتيجة)</h2>
      <div class="lab-ctrl">
        <label>المجموع = <select id="sumSel"><option value="">اختاري</option>${Array.from({ length: 11 }, (_, i) => `<option>${i + 2}</option>`).join('')}</select></label>
        <button class="fchip" data-ev="ge10">المجموع 10 أو أكتر</button>
        <button class="fchip" data-ev="double">وجهين متشابهين</button>
        <button class="fchip" data-ev="odd2">فردي في الرمية التانية</button>
        <button class="fchip" data-ev="sumodd">المجموع فردي</button>
        <button class="fchip" data-ev="three1">3 في الرمية الأولى</button>
      </div>
      <div class="dice-grid" id="diceGrid"></div>
      <div class="lab-out" id="diceOut">اختاري حدث من فوق</div>
    </section>
    <section class="card lab" id="cardLab">
      <h2>${icon('spade')} الكوتشينة (52 ورقة)</h2>
      <div class="lab-ctrl">
        <div class="seg small" id="cardOp"><button class="on" data-op="or">أو (اتحاد)</button><button data-op="and">و (تقاطع)</button></div>
        ${[['red', 'حمراء'], ['black', 'سوداء'], ['face', 'صورة (ولد/بنت/شايب)'], ['H', 'قلب'], ['D', 'ديناري'], ['S', 'بستوني'], ['C', 'سباتي'], ['Q', 'بنت'], ['J', 'ولد'], ['K', 'شايب'], ['A', 'آس'], ['10', 'رقم 10'], ['lt4', 'أقل من 4']].map(([k, l]) => `<button class="fchip" data-cf="${k}">${l}</button>`).join('')}
      </div>
      <div class="deck" id="deck"></div>
      <div class="lab-out" id="cardOut">اختاري صفة أو أكتر</div>
    </section>
    <section class="card lab">
      <h2>${icon('coins')} رمي عملتين (ص = صورة، ك = كتابة)</h2>
      <div class="coins">${['صص', 'صك', 'كص', 'كك'].map(x => `<span class="coin-o">${x}</span>`).join('')}</div>
      <p class="muted">فضاء العينة 4 نتائج. صورة واحدة بالظبط: صك، كص = 2/4. صورة واحدة على الأقل: صص، صك، كص = 3/4. على الأكتر صورة واحدة: صك، كص، كك = 3/4.</p>
    </section>`;
  return {
    html, mount: el => {
      const grid = el.querySelector('#diceGrid');
      let cells = '<span class="dg-h"></span>' + [1, 2, 3, 4, 5, 6].map(b => `<span class="dg-h">${b}</span>`).join('');
      for (let a = 1; a <= 6; a++) { cells += `<span class="dg-h">${a}</span>`; for (let b = 1; b <= 6; b++) cells += `<span class="dg-c" data-a="${a}" data-b="${b}">${a},${b}</span>`; }
      grid.innerHTML = cells;
      const show = (fn, label) => {
        let n = 0;
        grid.querySelectorAll('.dg-c').forEach(c => { const on = fn(+c.dataset.a, +c.dataset.b); c.classList.toggle('on', on); if (on) n++; });
        el.querySelector('#diceOut').innerHTML = `<b>${label}</b>: عدد النتائج = ${n} من 36 ← الاحتمال = <b dir="ltr">${n}/36 = ${frac(n, 36)}</b> ≈ ${(n / 36).toFixed(3)}`;
      };
      const evs = { ge10: [(a, b) => a + b >= 10, 'المجموع 10 أو أكتر'], double: [(a, b) => a === b, 'وجهين متشابهين'], odd2: [(a, b) => b % 2 === 1, 'فردي في الرمية التانية'], sumodd: [(a, b) => (a + b) % 2 === 1, 'المجموع فردي'], three1: [(a) => a === 3, '3 في الرمية الأولى'] };
      el.querySelector('#diceLab .lab-ctrl').addEventListener('click', e => { const b = e.target.closest('[data-ev]'); if (!b) return; el.querySelectorAll('#diceLab .fchip').forEach(x => x.classList.toggle('on', x === b)); el.querySelector('#sumSel').value = ''; show(...evs[b.dataset.ev]); });
      el.querySelector('#sumSel').addEventListener('change', e => { const v = +e.target.value; el.querySelectorAll('#diceLab .fchip').forEach(x => x.classList.remove('on')); if (v) show((a, b) => a + b === v, `المجموع = ${v}`); });
      // deck
      const suits = [['H', 'قلب', true], ['D', 'ديناري', true], ['S', 'بستوني', false], ['C', 'سباتي', false]];
      const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      const rl = { A: 'آس', J: 'ولد', Q: 'بنت', K: 'شايب' };
      el.querySelector('#deck').innerHTML = suits.map(([s, sn, red]) => `<div class="deck-row"><span class="suit-name ${red ? 'red' : ''}">${sn}</span>${ranks.map(r => `<span class="pc ${red ? 'red' : ''}" data-s="${s}" data-r="${r}">${rl[r] || r}</span>`).join('')}</div>`).join('');
      const sel = new Set(); let op = 'or';
      const test = (k, s, r) => ({ red: s === 'H' || s === 'D', black: s === 'S' || s === 'C', face: ['J', 'Q', 'K'].includes(r), lt4: ['A', '2', '3'].includes(r) }[k] ?? (k === s || k === r));
      const names = { red: 'حمراء', black: 'سوداء', face: 'صورة', H: 'قلب', D: 'ديناري', S: 'بستوني', C: 'سباتي', Q: 'بنت', J: 'ولد', K: 'شايب', A: 'آس', '10': 'رقم 10', lt4: 'أقل من 4' };
      const drawDeck = () => {
        let n = 0;
        el.querySelectorAll('.pc').forEach(c => {
          const hits = [...sel].map(k => test(k, c.dataset.s, c.dataset.r));
          const on = sel.size && (op === 'or' ? hits.some(Boolean) : hits.every(Boolean));
          c.classList.toggle('on', !!on); if (on) n++;
        });
        el.querySelector('#cardOut').innerHTML = sel.size ? `<b>${[...sel].map(k => names[k]).join(op === 'or' ? ' أو ' : ' و ')}</b>: ${n} ورقة من 52 ← الاحتمال = <b dir="ltr">${n}/52 = ${frac(n, 52)}</b> ≈ ${(n / 52).toFixed(3)}` : 'اختاري صفة أو أكتر';
      };
      el.querySelector('#cardLab .lab-ctrl').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.op) { op = b.dataset.op; el.querySelectorAll('#cardOp button').forEach(x => x.classList.toggle('on', x === b)); }
        if (b.dataset.cf) { const k = b.dataset.cf; sel.has(k) ? sel.delete(k) : sel.add(k); b.classList.toggle('on', sel.has(k)); }
        drawDeck();
      });
    }
  };
}
