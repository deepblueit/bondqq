// Home, plan, settings, guide, import, onboarding.
import { SUBJECTS, SUBJECT, STUDENT, HELPER, DEFAULT_SETTINGS, PRIORITY_LABEL } from './config.js';
import { icon } from './icons.js';
import { esc, md } from './render.js';
import { S, save, settings, setSetting, isDone, markDone, unmarkDone, exportCode, importCode, decodeCode, resetAll } from './store.js';
import { time, dateLong, dateShort, weekday, until, dur, dayStart, DAY, HOUR, MIN, dayKey, parts, count } from './time.js';
import { taskRoute, currentBlock, nextStudy, missed, studyDay } from './plan.js';
import { ring, chip, subStyle, toast, celebrate, modal, $, $$ } from './ui.js';

const KIND_ICON = { lesson: 'book-open', drill: 'pen-line', mock: 'file-text', cards: 'layers', night: 'moon-star', morning: 'sunrise' };
const KIND_LABEL = { lesson: 'درس', drill: 'حل أسئلة', mock: 'نموذج امتحان', cards: 'فلاش كاردز', night: 'مراجعة ليلة', morning: 'مراجعة الصبح' };

export function subjectProgress(ctx, sid) {
  const ts = ctx.tasks.filter(t => t.sid === sid);
  const tot = ts.reduce((a, t) => a + t.minutes, 0) || 1;
  const d = ts.filter(t => isDone(t.id)).reduce((a, t) => a + t.minutes, 0);
  return d / tot;
}

function taskTitle(ctx, t) {
  if (!t) return '';
  if (t.kind === 'lesson') return `${t.placeholder ? '' : `الوحدة ${t.n}: `}${t.title}`;
  return t.title;
}

function blockLine(ctx, b, now, { compact = false } = {}) {
  const t = b.task ? ctx.tm[b.task] : null;
  const isNow = b.s <= now && now < b.e;
  const past = b.e <= now;
  const dur_ = Math.round((b.e - b.s) / MIN);
  const timeCol = `<div class="bl-time"><b>${time(b.s)}</b><small>${time(b.e)}</small></div>`;
  if (b.type === 'study' && t) {
    const done = isDone(t.id);
    return `<div class="bl study ${done ? 'done' : ''} ${isNow ? 'now' : ''} ${past && !done ? 'missed' : ''}" style="${subStyle(t.sid)}">
      ${timeCol}
      <div class="bl-body">
        <div class="bl-top">${chip(t.sid)}<span class="kind">${icon(KIND_ICON[t.kind] || 'book-open')}${KIND_LABEL[t.kind] || ''}</span>${b.parts ? `<span class="part">جزء ${b.part} من ${b.parts}</span>` : ''}${isNow ? '<span class="now-badge">دلوقتي</span>' : ''}</div>
        <a class="bl-title" href="${taskRoute(t)}">${esc(taskTitle(ctx, t))}</a>
        ${compact ? '' : `<span class="bl-dur">${dur(dur_)}</span>`}
      </div>
      <button class="check-btn ${done ? 'on' : ''}" data-act="toggle-task" data-id="${t.id}" aria-label="خلصت">${icon('check')}</button>
    </div>`;
  }
  const map = {
    break: ['coffee', 'استراحة', 'قومي اتحركي واشربي مية'],
    meal: ['utensils', 'أكل وراحة', ''],
    sleep: ['moon', 'نوم', 'النوم بيثبت اللي ذاكرتيه'],
    work: ['briefcase', 'الشغل', ''],
    prep: ['sunrise', 'فطار وتجهيز', 'بصي على الكروت وانتي بتفطري'],
    travel: ['bus', 'النزول للامتحان', 'خدي معاكي ورقة المراجعة السريعة'],
    exam: ['graduation-cap', 'الامتحان', ''],
    rest: ['coffee', 'راحة بعد الامتحان', 'متراجعيش الامتحان اللي فات، خلاص خلص'],
    free: ['sparkles', 'وقت حر', 'راحة، أو شغل، أو لفة على الكروت'],
    extra: ['zap', 'تثبيت', 'لفي على الأسئلة المتوقعة والكروت'],
    warmup: ['play', 'جهزي نفسك', 'ورقة وقلم وكوباية مية، واقفلي الإشعارات'],
  };
  const [ic, label, sub] = map[b.type] || ['circle', b.type, ''];
  const sid = b.sid;
  if (b.type === 'exam') {
    return `<div class="bl exam ${isNow ? 'now' : ''}" style="${subStyle(sid)}">${timeCol}<div class="bl-body"><div class="bl-top">${chip(sid)}${isNow ? '<span class="now-badge">دلوقتي</span>' : ''}</div><b class="bl-title">${icon('graduation-cap')} امتحان ${esc(SUBJECT[sid].title)}</b><span class="bl-dur">ربنا معاكي. اقري السؤال مرتين قبل ما تكتبي.</span></div></div>`;
  }
  if (b.type === 'break' && compact) return '';
  const link = b.type === 'extra' ? `<a class="mini-link" href="#/s/${sid}/q?likely=1">افتحي الأسئلة المتوقعة ${icon('arrow-left')}</a>` : '';
  return `<div class="bl soft t-${b.type} ${isNow ? 'now' : ''}" ${sid ? `style="${subStyle(sid)}"` : ''}>${timeCol}<div class="bl-body"><span class="bl-soft-title">${icon(ic)} ${label}${sid && b.type !== 'free' ? ` · ${esc(SUBJECT[sid].short)}` : ''}${isNow ? ' <span class="now-badge">دلوقتي</span>' : ''}</span>${sub ? `<small>${sub}</small>` : ''}${link}</div></div>`;
}

// ---------- HOME ----------
export function homeView(ctx) {
  const st = S();
  const now = Date.now();
  const plan = st.plan;
  const upcoming = SUBJECTS.filter(s => s.endTs > now);
  const nextEx = upcoming[0];
  const p = parts(now);
  const greet = p.h < 12 ? 'صباح الفل' : p.h < 17 ? 'أهلا' : 'مساء الفل';
  const cur = currentBlock(plan, now);
  const nxt = nextStudy(plan, st.done, now);
  const miss = missed(plan, st.done, now);

  let nowCard = '';
  if (plan && plan.finished) {
    nowCard = `<div class="now-card card calm"><div class="now-head">${icon('party-popper')}<span>خلصتي كل الامتحانات</span></div><p class="muted">ألف مبروك يا ${STUDENT}. ارتاحي بقى، تستاهلي.</p></div>`;
  } else if (!plan || !plan.blocks.length) {
    nowCard = `<div class="now-card card"><h3>${icon('calendar-clock')} الخطة لسه متعملتش</h3><button class="btn primary" data-act="replan">${icon('wand-sparkles')} اعمليلي الخطة</button></div>`;
  } else {
    const t = cur && cur.type === 'study' ? ctx.tm[cur.task] : null;
    if (t && !isDone(t.id)) {
      const pct = (now - cur.s) / (cur.e - cur.s);
      nowCard = `<div class="now-card card live" style="${subStyle(t.sid)}">
        <div class="now-head"><span class="pulse"></span><span>المطلوب دلوقتي</span><span class="now-time">${time(cur.s)} لـ ${time(cur.e)}</span></div>
        <div class="now-main">${chip(t.sid)}<span class="kind">${icon(KIND_ICON[t.kind])}${KIND_LABEL[t.kind]}</span></div>
        <h2 class="now-title">${esc(taskTitle(ctx, t))}</h2>
        <div class="progress"><i style="width:${(pct * 100).toFixed(1)}%"></i></div>
        <div class="now-actions">
          <a class="btn primary big" href="${taskRoute(t)}">${icon('play')} ابدأي</a>
          <button class="btn soft" data-act="done-now" data-id="${t.id}">${icon('check')} خلصته</button>
        </div>
        ${nxtAfter(ctx, plan, cur, st)}
      </div>`;
    } else {
      const ct = cur ? cur.type : null;
      const msgs = {
        break: ['coffee', 'وقت استراحة', 'قومي، اشربي مية، حركي رجلك. 10 دقايق وراجعة.'],
        meal: ['utensils', 'وقت الأكل', 'كلي كويس وريحي دماغك شوية.'],
        sleep: ['moon', 'ده وقت النوم', 'النوم مش وقت ضايع: المخ بيثبت اللي ذاكرتيه وانتي نايمة.'],
        work: ['briefcase', 'وقت الشغل', 'ركزي في شغلك، والخطة مستنياكي بعده.'],
        prep: ['sunrise', 'فطار وتجهيز', 'افطري وبصي على ورقة المراجعة السريعة.'],
        travel: ['bus', 'نازلة الامتحان', 'خدي معاكي ورقة الصبح، وروحي بدري شوية.'],
        exam: ['graduation-cap', 'وقت الامتحان', 'ربنا معاكي. اقري كل سؤال مرتين قبل ما تكتبي.'],
        rest: ['coffee', 'راحة بعد الامتحان', 'خلاص الامتحان خلص، متراجعيهوش. كلي وريحي.'],
        free: ['sparkles', 'وقت حر', 'لو عايزة تكسبي وقت، ابدأي اللي جاي بدري.'],
        extra: ['zap', 'وقت تثبيت', 'لفي على الأسئلة المتوقعة والكروت.'],
        warmup: ['play', 'جهزي نفسك', 'ورقة وقلم وكوباية مية، واقفلي الإشعارات. المذاكرة هتبدأ حالا.'],
      };
      const [ic, h, sub] = msgs[ct] || (t && isDone(t.id) ? ['party-popper', 'سابقة الخطة!', 'خلصتي المطلوب دلوقتي، تقدري تبدأي اللي بعده.'] : !cur && plan.start > now ? ['clock', 'الخطة بتبدأ كمان شوية', 'جهزي ورقة وقلم وكوباية مية، وابدأي باللي تحت.'] : ['sparkles', 'يلا بينا', 'ابدأي باللي جاي في الخطة.']);
      nowCard = `<div class="now-card card calm">
        <div class="now-head">${icon(ic)}<span>${h}</span>${cur ? `<span class="now-time">لحد ${time(cur.e)}</span>` : ''}</div>
        <p class="muted">${sub}</p>
        ${nxt ? (() => { const tn = ctx.tm[nxt.task]; return tn ? `<div class="next-up" style="${subStyle(tn.sid)}"><small>اللي جاي ${nxt.s > now ? `الساعة ${time(nxt.s)} (${weekday(nxt.s) === weekday(now) ? 'النهارده' : weekday(nxt.s)})` : 'دلوقتي'}</small>
          <div class="nu-row">${chip(tn.sid)}<b>${esc(taskTitle(ctx, tn))}</b></div>
          <a class="btn primary" href="${taskRoute(tn)}">${icon('play')} ابدأيه دلوقتي</a></div>` : ''; })() : ''}
      </div>`;
    }
  }

  const missBanner = miss.length ? `<div class="banner warn">${icon('triangle-alert')}<div><b>فاتك ${count(miss.length, 'مهمة', 'مهمتين', 'مهام')} من الخطة.</b><small>ولا يهمك. نعيد ترتيب اللي فاضل من دلوقتي.</small></div><button class="btn small" data-act="replan">${icon('refresh-cw')} رتبي من جديد</button></div>` : '';

  // today's study blocks
  const today = studyDay(now);
  const todays = plan ? plan.blocks.filter(b => studyDay(b.s) === today && (b.type === 'study' || b.type === 'exam' || b.type === 'extra') && b.e > now - 2 * HOUR) : [];

  const examCard = nextEx ? `<a class="exam-card card" href="#/s/${nextEx.id}" style="${subStyle(nextEx.id)}">
      <span class="ec-label">${icon('alarm-clock')} أقرب امتحان</span>
      <b class="ec-title">${esc(nextEx.title)}</b>
      <span class="ec-count">${nextEx.startTs > now ? `بعد ${until(nextEx.startTs, now)}` : 'شغال دلوقتي'}</span>
      <small>${dateLong(nextEx.startTs)}، من 12 لـ 1 الضهر</small>
    </a>` : `<div class="exam-card card"><b class="ec-title">خلصتي كل الامتحانات</b><span class="ec-count">ألف مبروك</span></div>`;

  const subs = SUBJECTS.map(s => {
    const pr = subjectProgress(ctx, s.id);
    const past = s.endTs <= now;
    return `<a class="sub-card card ${past ? 'past' : ''}" href="#/s/${s.id}" style="${subStyle(s.id)}">
      <div class="sc-ring">${ring(pr, 54, 6)}<span>${Math.round(pr * 100)}%</span></div>
      <div class="sc-body"><b>${esc(s.title)}</b><small>${weekday(s.startTs)} ${dateShort(s.startTs)}${past ? ' · خلص' : ` · بعد ${until(s.startTs, now)}`}</small>${ctx.content[s.id] ? '' : '<small class="tag-soon">المحتوى بيتجهز</small>'}</div>
      ${icon('chevron-left', 'sc-arrow')}
    </a>`;
  }).join('');

  const tools = `
    <a class="tool" href="#/s/${(nextEx || SUBJECTS[0]).id}/cards">${icon('layers')}<b>فلاش كاردز</b><small>للمادة الجاية</small></a>
    <a class="tool" href="#/s/${(nextEx || SUBJECTS[0]).id}/q?likely=1">${icon('target')}<b>الأسئلة المتوقعة</b><small>للمادة الجاية</small></a>
    <a class="tool" href="#/guide/essay">${icon('notebook-pen')}<b>إزاي تكتبي الإجابة</b><small>عشان الدرجة كاملة</small></a>
    <a class="tool" href="#/lab">${icon('dice-5')}<b>معمل الاحتمالات</b><small>نرد وكوتشينة</small></a>
    <a class="tool" href="#/guide/helper">${icon('users')}<b>دليل ${HELPER}</b><small>إزاي تذاكروا سوا</small></a>
    <a class="tool" href="#/plan">${icon('calendar-clock')}<b>الخطة كلها</b><small>بالساعة واليوم</small></a>`;

  const html = `
  <section class="hero">
    <div class="hello">
      <span class="eyebrow">${dateLong(now)} · ${time(now)}</span>
      <h1>${greet} يا ${STUDENT}</h1>
      <p class="lead">${heroLine(nextEx, now)}</p>
      <div class="mode-switch" role="group" aria-label="وضع المذاكرة">
        <button class="${st.settings.mode === 'solo' ? 'on' : ''}" data-act="mode" data-v="solo">${icon('user')} لوحدي</button>
        <button class="${st.settings.mode === 'together' ? 'on' : ''}" data-act="mode" data-v="together">${icon('users')} مع ${HELPER}</button>
      </div>
    </div>
    ${examCard}
  </section>
  ${missBanner}
  ${nowCard}
  ${todays.length ? `<section class="sec"><div class="sec-head"><h2>${icon('list-checks')} النهارده</h2><a class="mini-link" href="#/plan">الخطة كاملة ${icon('arrow-left')}</a></div><div class="timeline compact">${todays.map(b => blockLine(ctx, b, now, { compact: true })).join('')}</div></section>` : ''}
  <section class="sec"><div class="sec-head"><h2>${icon('book-marked')} المواد بترتيب الامتحانات</h2></div><div class="sub-grid">${subs}</div></section>
  <section class="sec"><div class="sec-head"><h2>${icon('wand-sparkles')} أدوات سريعة</h2></div><div class="tools">${tools}</div></section>
  <section class="sec stats-row">
    <div class="stat card">${icon('flame')}<b>${st.streak.count || 0}</b><small>أيام ورا بعض</small></div>
    <div class="stat card">${icon('zap')}<b>${st.xp || 0}</b><small>نقطة</small></div>
    <div class="stat card">${icon('circle-check')}<b>${Object.keys(st.done).length}</b><small>مهمة خلصت</small></div>
  </section>`;
  return { html, tick: 30000 };
}

function nxtAfter(ctx, plan, cur, st) {
  const nb = plan.blocks.find(b => b.s >= cur.e && b.type === 'study' && !st.done[b.task] && b.task !== cur.task);
  if (!nb) return '';
  const t = ctx.tm[nb.task];
  return `<div class="after"><small>بعدها (${time(nb.s)}):</small> ${chip(t.sid)} <span>${esc(taskTitle(ctx, t))}</span></div>`;
}

function heroLine(ex, now) {
  if (!ex) return 'خلصنا. فخورين بيكي.';
  const h = (ex.startTs - now) / HOUR;
  if (h < 0) return `ربنا معاكي في امتحان ${ex.short}.`;
  if (h < 24) return `امتحان ${ex.short} قرب جدا. ركزي على الأساسي والأسئلة المتوقعة، وإنتي قدها.`;
  if (h < 48) return `قدامك أقل من يومين على ${ex.short}. مش محتاجين كمال، محتاجين نقفل الأساسي ونحل كتير.`;
  return 'خطوة خطوة. كل وحدة بتخلصيها بتقربك، والخطة ماشية معاكي بالساعة.';
}

// ---------- PLAN ----------
let overOpen = null; // remembers whether the "did not fit" list was opened, across the 1-minute refresh
export function planView(ctx, params) {
  const st = S();
  const plan = st.plan;
  const now = Date.now();
  if (plan && plan.finished) return { html: `<div class="page-head"><h1>${icon('calendar-clock')} الخطة بالساعة</h1></div><div class="card center"><h2>${icon('party-popper')} خلصتي كل الامتحانات</h2><p>ألف مبروك يا ${STUDENT}. الخطة خلصت مهمتها.</p></div>` };
  if (!plan || !plan.blocks.length) return { html: `<div class="page-head"><h1>${icon('calendar-clock')} الخطة بالساعة</h1></div><div class="card center"><p>الخطة لسه متعملتش.</p><button class="btn primary" data-act="replan">${icon('wand-sparkles')} اعمليلي الخطة</button></div>` };
  const days = [];
  for (const b of plan.blocks) { const d = studyDay(b.s); if (!days.includes(d)) days.push(d); }
  const today = studyDay(now);
  let sel = params.day ? Number(params.day) : (days.includes(today) ? today : days[0]);
  if (!days.includes(sel)) sel = days[0];
  const blocks = plan.blocks.filter(b => studyDay(b.s) === sel);
  const studyMin = blocks.filter(b => b.type === 'study').reduce((a, b) => a + (b.e - b.s) / MIN, 0);
  const examToday = SUBJECTS.find(s => studyDay(s.startTs) === sel);
  const remainingMin = plan.blocks.filter(b => b.type === 'study' && b.e > now && !st.done[b.task]).reduce((a, b) => a + (b.e - Math.max(b.s, now)) / MIN, 0);
  const miss = missed(plan, st.done, now);
  const over = Object.entries(plan.overflow || {}).map(([sid, ids]) => [sid, ids.filter(id => ctx.tm[id] && !st.done[id])]).filter(([, v]) => v.length);
  const overT = over.flatMap(([, ids]) => ids.map(id => ctx.tm[id]));
  const hasP1 = overT.some(t => t.priority === 1);
  const overOpenNow = overOpen === null ? hasP1 : overOpen;
  const overBanner = !overT.length ? '' : `<details class="banner over ${hasP1 ? 'warn' : 'info'}" ${overOpenNow ? 'open' : ''}><summary>${icon(hasP1 ? 'triangle-alert' : 'info')}<div><b>${hasP1 ? 'الوقت مش مكفي كل حاجة' : 'في حاجات مش داخلة الخطة'}</b><small>${hasP1 ? 'الوقت المتاح في مواعيدك مش مكفي المطلوب كله، فدول اتشالوا من الخطة ومنهم حاجات أساسية. لو عندك وقت أكتر (ساعات مذاكرة أكتر في اليوم أو شغل أقل) غيريه من الإعدادات والخطة هتحاول تدخلهم، أو اعمليهم في أي وقت حر.' : 'مفيش وقت ليهم في مواعيدك الحالية. اعمليهم لو لقيتي وقت حر، أو غيري مواعيدك من الإعدادات والخطة هتحاول تدخلهم.'}</small></div></summary><div class="over-list">${overT.slice().sort((x, y) => x.priority - y.priority).map(t => `<div class="ov-row">${chip(t.sid)}<a href="${taskRoute(t)}">${esc(taskTitle(ctx, t))}</a><span class="pri p${t.priority}">${PRIORITY_LABEL[t.priority]}</span></div>`).join('')}</div></details>`;

  const tabs = days.map(d => {
    const ex = SUBJECTS.find(s => studyDay(s.startTs) === d);
    return `<a class="day-tab ${d === sel ? 'on' : ''} ${d === today ? 'today' : ''}" href="#/plan?day=${d}" ${ex ? `style="${subStyle(ex.id)}"` : ''}>
      <small>${weekday(d + 12 * HOUR)}</small><b>${parts(d + 12 * HOUR).d}</b>${ex ? `<i class="ex-dot" title="امتحان"></i>` : ''}${d === today ? '<em>النهارده</em>' : ''}</a>`;
  }).join('');

  const html = `
  <div class="page-head">
    <h1>${icon('calendar-clock')} الخطة بالساعة واليوم</h1>
    <p class="muted">باقي ${dur(remainingMin)} مذاكرة فعلية لحد آخر امتحان. الخطة متظبطة على مواعيدك، ولو اتأخرتي بنرتبها من جديد من اللحظة دي.</p>
  </div>
  ${miss.length ? `<div class="banner warn">${icon('triangle-alert')}<div><b>فاتك ${count(miss.length, 'مهمة', 'مهمتين', 'مهام')}.</b><small>اضغطي نرتب اللي فاضل على الوقت اللي باقي، والأولوية للأساسي.</small></div><button class="btn small" data-act="replan">${icon('refresh-cw')} رتبي من جديد</button></div>` : ''}
  ${overBanner}
  <div class="day-tabs" id="dayTabs">${tabs}</div>
  <div class="day-head">
    <h2>${dateLong(sel + 12 * HOUR)}</h2>
    <span class="chip">${icon('clock')} ${dur(studyMin)} مذاكرة</span>
    ${examToday ? `<span class="chip warn">${icon('graduation-cap')} امتحان ${esc(examToday.short)}</span>` : ''}
  </div>
  <div class="timeline">${blocks.map(b => blockLine(ctx, b, now)).join('')}</div>
  <div class="plan-foot card">
    <div><b>${icon('settings')} مواعيدك مش كده؟</b><small>غيري ميعاد الصحيان والنوم والشغل من الإعدادات، والخطة هتتظبط عليهم.</small></div>
    <div class="row"><a class="btn soft" href="#/settings">${icon('settings')} الإعدادات</a><button class="btn primary" data-act="replan">${icon('refresh-cw')} رتبي من دلوقتي</button></div>
  </div>`;
  return {
    html, tick: 60000,
    mount: el => {
      const on = el.querySelector('.day-tab.on'); on && on.scrollIntoView({ inline: 'center', block: 'nearest' });
      const d = el.querySelector('details.over'); d && d.addEventListener('toggle', () => { overOpen = d.open; });
    }
  };
}

// ---------- SETTINGS ----------
export function settingsView(ctx) {
  const st = settings();
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const tInput = (k, label, hint = '') => `<label class="field"><span>${label}</span><input type="time" data-set="${k}" value="${st[k]}">${hint ? `<small>${hint}</small>` : ''}</label>`;
  const html = `
  <div class="page-head"><h1>${icon('settings')} الإعدادات</h1><p class="muted">أي تغيير هنا بيعيد ترتيب الخطة من دلوقتي.</p></div>
  <section class="card form">
    <h3>${icon('users')} وضع المذاكرة</h3>
    <div class="seg">${[['solo', 'لوحدي'], ['together', `مع ${HELPER}`]].map(([v, l]) => `<button class="${st.mode === v ? 'on' : ''}" data-act="mode" data-v="${v}">${l}</button>`).join('')}</div>
    <small class="muted">في وضع "مع ${HELPER}" بيظهر في كل درس كارت فيه أسئلة ونشاطات تعملوها سوا.</small>
  </section>
  <section class="card form">
    <h3>${icon('alarm-clock')} مواعيدك</h3>
    <div class="grid2">
      ${tInput('wake', 'بتصحي الساعة كام؟')}
      ${tInput('sleep', 'بتنامي الساعة كام؟', 'لو بعد نص الليل اكتبيها عادي، زي 00:30')}
      ${tInput('wakeExam', 'صحيان يوم الامتحان')}
      ${tInput('sleepBeforeExam', 'نوم ليلة الامتحان', 'النوم بدري ليلة الامتحان بيفرق جدا')}
      ${tInput('leave', 'بتنزلي للامتحان الساعة كام؟')}
      ${tInput('restUntil', 'راحة بعد الامتحان لحد')}
      ${tInput('lunch', 'الغدا (45 دقيقة)')}
      ${tInput('dinner', 'العشا (30 دقيقة)')}
    </div>
    <label class="field"><span>أقصى مذاكرة في اليوم</span>
      <select data-set="dailyCap">${[5, 6, 7, 8, 9, 10].map(h => `<option value="${h}" ${+st.dailyCap === h ? 'selected' : ''}>${h} ساعات</option>`).join('')}</select>
      <small>من غير مراجعة ليلة الامتحان ومراجعة الصبح، دول محسوبين لوحدهم. أيام الامتحانات نفسها بتكون أقل: 6 ساعات بعد الامتحان بالكتير.</small></label>
  </section>
  <section class="card form">
    <h3>${icon('briefcase')} الشغل</h3>
    <label class="switch"><input type="checkbox" data-work="enabled" ${st.work.enabled ? 'checked' : ''}><span></span>عندي شغل الأيام دي</label>
    <div class="work-box ${st.work.enabled ? '' : 'off'}">
      <div class="days-pick">${days.map((d, i) => `<button class="${st.work.days.includes(i) ? 'on' : ''}" data-act="work-day" data-v="${i}">${d}</button>`).join('')}</div>
      <div class="grid2">
        <label class="field"><span>من</span><input type="time" data-work="from" value="${st.work.from}"></label>
        <label class="field"><span>لـ</span><input type="time" data-work="to" value="${st.work.to}"></label>
      </div>
      <label class="switch"><input type="checkbox" data-work="offOnExamDays" ${st.work.offOnExamDays !== false ? 'checked' : ''}><span></span>أيام الامتحانات إجازة من الشغل</label>
    </div>
  </section>
  <section class="card form">
    <h3>${icon('sun')} الشكل</h3>
    <div class="seg">${[['auto', 'زي الموبايل'], ['light', 'فاتح'], ['dark', 'غامق']].map(([v, l]) => `<button class="${st.theme === v ? 'on' : ''}" data-act="theme" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="seg">${[[0.9, 'خط صغير'], [1, 'عادي'], [1.12, 'كبير'], [1.25, 'أكبر']].map(([v, l]) => `<button class="${+st.font === v ? 'on' : ''}" data-act="font" data-v="${v}">${l}</button>`).join('')}</div>
  </section>
  <section class="card form">
    <h3>${icon('share-2')} مشاركة التقدم مع ${HELPER}</h3>
    <p class="muted">التقدم بيتحفظ على الجهاز ده بس. ابعتي اللينك ده لـ${HELPER} عشان يشوف وصلتي لفين على جهازه.</p>
    <div class="row"><button class="btn primary" data-act="share">${icon('link')} انسخي لينك التقدم</button><a class="btn soft" href="#/import">${icon('download')} عندي لينك تقدم</a></div>
  </section>
  <section class="card form">
    <h3>${icon('rotate-ccw')} البداية من الأول</h3>
    <div class="row"><button class="btn soft" data-act="replan">${icon('refresh-cw')} رتبي الخطة من دلوقتي</button><button class="btn danger" data-act="reset">${icon('triangle-alert')} امسحي كل التقدم</button></div>
  </section>`;
  // inputs are handled by one delegated listener in app.js
  return { html };
}

// ---------- GUIDE ----------
export function guideView(ctx, params) {
  const sec = params.sec || 'start';
  const tabs = [['start', 'إزاي تستخدمي الموقع', 'compass'], ['essay', 'إزاي تكتبي الإجابة', 'notebook-pen'], ['helper', `دليل ${HELPER}`, 'users'], ['sources', 'المصادر والمنهج', 'book-marked']];
  let body = '';
  if (sec === 'start') body = `
    <div class="steps">
      <div class="step card"><span class="num">1</span><div><b>افتحي الرئيسية</b><p>هتلاقي "المطلوب دلوقتي" متحدد بالساعة. اضغطي "ابدأي" وهيفتحلك الدرس أو الأسئلة على طول.</p></div></div>
      <div class="step card"><span class="num">2</span><div><b>الدرس ماشي خطوات</b><p>الفكرة في جملة، بعدين الشرح بالمصري، بعدين الرسمة، بعدين اللي لازم يتحفظ، وفي الآخر تختبري نفسك وتشوفي سؤال الامتحان بإجابته النموذجية بالفصحى.</p></div></div>
      <div class="step card"><span class="num">3</span><div><b>اضغطي "خلصت"</b><p>كل ما تخلصي حاجة علميها. الخطة بتعرف وصلتي لفين، ولو اتأخرتي اضغطي "رتبي من جديد" وهي تتظبط على الوقت اللي باقي.</p></div></div>
      <div class="step card"><span class="num">4</span><div><b>حلي كتير</b><p>الامتحانات مقالي، فالدرجة بتيجي من إنك تكتبي بنقط مرتبة. في كل مادة بنك أسئلة، ونماذج امتحان بتايمر ساعة، وفلاش كاردز للحفظ.</p></div></div>
    </div>
    <div class="card callout-card">${icon('info')}<div><b>الشرح بالمصري، والإجابات بالفصحى.</b><p>الشرح معمول عشان تفهمي بسرعة. أما الإجابات النموذجية فمكتوبة بالفصحى عشان دي اللي هتكتبيها في ورقة الامتحان.</p></div></div>
    <div class="card callout-card">${icon('download')}<div><b>نزليه على الموبايل كأنه تطبيق</b><p>من كروم: النقط التلاتة فوق، بعدين "إضافة إلى الشاشة الرئيسية". هيشتغل حتى لو النت قطع بعد أول فتحة.</p></div></div>`;
  if (sec === 'essay') body = md(ESSAY_GUIDE);
  if (sec === 'helper') body = md(HELPER_GUIDE);
  if (sec === 'sources') body = `<div class="card prose">${md(SOURCES_INTRO)}</div>` + SUBJECTS.map(s => {
    const c = ctx.content[s.id];
    return `<details class="card src" style="${subStyle(s.id)}"><summary>${chip(s.id)} <b>${esc(s.title)}</b></summary>${c ? `<div class="prose">${md(c.sourceNote)}<h4>المنهج المتوقع في الميدترم</h4>${md(c.scope)}</div>` : '<p class="muted">المحتوى بيتجهز.</p>'}</details>`;
  }).join('');
  const html = `<div class="page-head"><h1>${icon('compass')} الدليل</h1></div>
    <div class="tabs">${tabs.map(([k, l, ic]) => `<a class="tab ${k === sec ? 'on' : ''}" href="#/guide/${k}">${icon(ic)}${l}</a>`).join('')}</div>
    <div class="guide prose-wrap">${body}</div>`;
  return { html };
}

const ESSAY_GUIDE = `
### الدرجة في المقالي بتيجي من الترتيب مش من الكلام الكتير

1. **ابدئي بتعريف في سطر.** أي سؤال "اشرحي" أو "تكلمي عن" افتتحيه بتعريف المصطلح بكلمات الدكتور.
2. **اكتبي نقط مترقمة، وكل نقطة ليها عنوان.** المصحح بيدور على الكلمات المفتاحية، فخليها باينة: عنوان النقطة بخط واضح وبعده سطر شرح.
3. **مثال واحد يفرق.** مثال من الواقع (فودافون كاش، أمازون، نتفليكس...) بيقول للمصحح إنك فاهمة مش حافظة.
4. **سطر خلاصة في الآخر** للأسئلة الطويلة.
5. **قسمي الوقت على الدرجات.** الامتحان ساعة: اقري الورقة كلها الأول دقيقتين، وابدئي بالسؤال اللي حافظاه كويس عشان تاخدي ثقة.
6. **سؤال "قارن"** اكتبيه كنقط: "من حيث التعريف: ... بينما ..."، ولو فيه وقت ارسمي جدول صغير بالقلم.
7. **سؤال "علل"** إجابته سبب واضح: "لأن ..." وبعدين سطر يوضح.
8. **متسيبيش سؤال فاضي.** اكتبي التعريف وأي نقط فاكراها، الدرجة الجزئية بتفرق.

> **قاعدة ذهبية:** لو مش فاكرة الإجابة كلها، اكتبي التعريف + 3 نقط بعناوين + مثال. ده لوحده بيجيب أكتر من نص الدرجة.
`;

const HELPER_GUIDE = `
### يا ${HELPER}، دورك مش إنك تشرح كل حاجة، دورك إنك تخليها تتكلم

**شكل الجلسة المثالية (50 دقيقة):**

1. **5 دقايق تسخين:** اسألها 3 أسئلة سريعة من اللي ذاكرته المرة اللي فاتت (من "اختبري نفسك" أو الفلاش كاردز).
2. **20 دقيقة فهم:** اقروا "الفكرة في جملة" والشرح سوا، وارسموا الرسمة على ورقة. استخدم كارت "مع ${HELPER}" اللي في كل درس.
3. **15 دقيقة "اشرحيلي":** هي تشرحلك الوحدة كأنك مش فاهم حاجة. اسألها "ليه؟" و"يعني إيه؟" لحد ما توصل للكلام المرتب.
4. **10 دقايق سؤال امتحان:** تكتب إجابة سؤال من بنك الأسئلة في ورقة، وانت تصحح بقايمة النقط المطلوبة اللي تحت الإجابة النموذجية.

**نصايح تفرق:**

- **الاسترجاع أهم من القراية:** كل ما تخليها تطلع المعلومة من دماغها، كل ما تثبت أكتر.
- **متصححش غلطها على طول:** اسألها "متأكدة؟" واديها فرصة تلاقيه بنفسها.
- **شجع على الجهد مش على الذكاء:** "حلو إنك رتبتيها بنقط" أحسن من "إنتي شاطرة".
- **لو تعبت:** استراحة 10 دقايق بجد، بعيد عن الموبايل.

> لما تكون مش موجود، الموقع بيكمل الدور: في وضع "لوحدي" كل درس فيه أنشطة تعملها لنفسها، وبنك الأسئلة فيه تصحيح ذاتي بالنقط.
`;

const SOURCES_INTRO = `
**بصراحة عشان تبقي مطمنة:** المحتوى ده اتبنى من الحاجات اللي اتبعتت بس. فيه مواد عندنا محاضراتها نفسها، وفيه مواد عندنا فهرس الكتاب بس.

- **التكنولوجيا والابتكار:** من ملف المحاضرات وصور شرايح الدكتور وتسجيل المحاضرة الأولى، فدي أقرب حاجة لكلام الدكتور. والجروب قال إن الامتحان منها هي بس، مش من الكتاب اللي معاكم.
- **الإحصاء:** من تمارين الفصل التاني في الكتاب وشيت السكشن بحلوله، وكل الأرقام اتراجعت.
- **المخاطر والأمن:** من فهرس الكتاب وصفحة مراجعة الفصل الأول وأسئلته.
- **أنظمة المؤسسات، والمالية العامة، والأعمال الإلكترونية:** من فهرس الكتاب أو صفحة الأهداف، مع المنهج المعتاد للمادة. **قارني عناوين الدروس بالكتاب، ولو فيه جزء الدكتور قال إنه مش مقرر، اعديه.**
- **ملف الـ CamScanner:** طلع تمارين محاسبة حكومية (قيود يومية وتقديرات موازنة) من ترم فات، ومش من مواد الميدترم ده.
`;

// ---------- IMPORT ----------
export function importView(ctx, params) {
  const code = params.code || '';
  let preview = '';
  if (code) {
    try {
      const p = decodeCode(code);
      const nd = (p.d || []).length, nq = Object.keys(p.q || {}).length;
      const tasksTxt = nd ? count(nd, 'مهمة خلصانة', 'مهمتين خلصانين', 'مهام خلصانة') : 'مفيش مهام خلصانة';
      const qTxt = nq ? count(nq, 'سؤال متقيم', 'سؤالين متقيمين', 'أسئلة متقيمة') : 'مفيش أسئلة متقيمة';
      preview = `<p>اللينك فيه: <b>${tasksTxt}</b>، و<b>${qTxt}</b>.</p><button class="btn primary" data-act="import" data-code="${esc(code)}">${icon('download')} ضيفيهم للتقدم هنا</button>`;
    }
    catch (e) { preview = '<p class="bad">اللينك ده مش سليم.</p>'; }
  }
  const html = `<div class="page-head"><h1>${icon('download')} استيراد تقدم</h1></div>
    <div class="card form">${preview || `<p class="muted">الصقي لينك التقدم أو الكود هنا:</p><input class="input" id="impIn" dir="ltr" placeholder="https://...#/import/... أو الكود"><button class="btn primary" data-act="import-paste">${icon('download')} افتحي</button>`}</div>`;
  return { html };
}

// ---------- ONBOARDING ----------
export function onboarding(ctx) {
  const st = settings();
  const m = modal(`
    <div class="onb">
      <div class="onb-hero">${icon('rocket')}</div>
      <h2>أهلا يا ${STUDENT}، خلينا نعديها سوا</h2>
      <p>عندك 6 امتحانات من 9 لـ 19 نوفمبر. الموقع ده عامل لك خطة بالساعة، وشرح بالمصري، وأسئلة متوقعة بإجابات نموذجية، ونماذج امتحانات بتايمر.</p>
      <div class="onb-q">
        <b>${icon('alarm-clock')} مواعيدك</b>
        <div class="grid2">
          <label class="field"><span>بتصحي</span><input type="time" id="obWake" value="${st.wake}"></label>
          <label class="field"><span>بتنامي</span><input type="time" id="obSleep" value="${st.sleep}"></label>
        </div>
      </div>
      <div class="onb-q">
        <b>${icon('briefcase')} عندك شغل الأيام دي؟</b>
        <div class="seg" id="obWork"><button data-v="0" class="${st.work.enabled ? '' : 'on'}">لأ، متفرغة</button><button data-v="1" class="${st.work.enabled ? 'on' : ''}">أيوه</button></div>
        <div class="grid2 ob-work ${st.work.enabled ? '' : 'off'}">
          <label class="field"><span>من</span><input type="time" id="obFrom" value="${st.work.from}"></label>
          <label class="field"><span>لـ</span><input type="time" id="obTo" value="${st.work.to}"></label>
        </div>
        <small class="muted">أيام الشغل افتراضيا من الأحد للخميس، وأيام الامتحانات إجازة. تقدري تغيريها من الإعدادات.</small>
      </div>
      <div class="onb-q">
        <b>${icon('users')} هتذاكري إزاي؟</b>
        <div class="seg" id="obMode"><button data-v="solo" class="${st.mode === 'solo' ? 'on' : ''}">لوحدي</button><button data-v="together" class="${st.mode === 'together' ? 'on' : ''}">مع ${HELPER}</button></div>
      </div>
      <button class="btn primary big wide" id="obGo">${icon('wand-sparkles')} اعمليلي الخطة</button>
    </div>`);
  const el = m.el;
  el.querySelectorAll('.seg').forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    if (seg.id === 'obWork') el.querySelector('.ob-work').classList.toggle('off', b.dataset.v === '0');
  }));
  el.querySelector('#obGo').onclick = () => {
    const s = settings();
    s.wake = el.querySelector('#obWake').value || s.wake;
    s.sleep = el.querySelector('#obSleep').value || s.sleep;
    s.work.enabled = el.querySelector('#obWork .on').dataset.v === '1';
    s.work.from = el.querySelector('#obFrom').value || s.work.from;
    s.work.to = el.querySelector('#obTo').value || s.work.to;
    s.mode = el.querySelector('#obMode .on').dataset.v;
    s.onboarded = true;
    save();
    m.close();
    ctx.replan('الخطة جاهزة، يلا بينا');
    celebrate();
  };
}
