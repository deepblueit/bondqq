// Hour-by-hour study planner.
// 5-minute slots from "now" to the last exam. Fixed blocks (sleep, meals, work, exam travel/exam/rest)
// are laid first, then pinned reviews (night before + exam morning), then each subject's tasks in exam
// order. Short windows are filled as soon as possible; long windows as late as possible (fresh memory);
// when a window is too small, the first tasks spill into the free time just before it.
import { SUBJECTS, SUBJECT } from './config.js';
import { MIN, HOUR, DAY, at, parts, dayStart, hm } from './time.js';

const SLOT = 5 * MIN;
const RUN = 10;      // 10 slots = 50 min of study, then a break
const BRK = 2;       // 10 min break
const EFF = 50 / 60; // usable share of free time once breaks are counted

// ---------- tasks ----------
export function buildTasks(content) {
  const out = [];
  for (const sub of SUBJECTS) {
    const c = content[sub.id];
    const T = [];
    if (c && c.units) {
      c.units.forEach((u, i) => {
        const p = u.priority || 1;
        T.push({ id: u.id, sid: sub.id, kind: 'lesson', n: i + 1, title: u.title, minutes: u.minutes || 30, priority: p, seq: (p <= 2 ? 0 : 40) + i * 0.01 });
      });
    } else {
      for (let i = 1; i <= 6; i++) T.push({ id: `${sub.id}-ph${i}`, sid: sub.id, kind: 'lesson', n: i, title: `درس ${i}`, minutes: 35, priority: i <= 4 ? 1 : 2, seq: i * 0.01, placeholder: true });
    }
    const stats = sub.id === 'stats';
    const drills = stats ? [[1, 45, 1, 10], [2, 45, 1, 15], [3, 45, 2, 30], [4, 40, 2, 34]] : [[1, 40, 1, 10], [2, 35, 2, 30]];
    drills.forEach(([k, m, p, seq]) => T.push({ id: `${sub.id}-drill${k}`, sid: sub.id, kind: 'drill', k, nd: drills.length, title: stats ? `حل مسائل (جولة ${k})` : `حل أسئلة متوقعة (جولة ${k})`, minutes: m, priority: p, seq }));
    T.push({ id: `${sub.id}-m1`, sid: sub.id, kind: 'mock', mock: 0, title: 'نموذج امتحان كامل + تصحيح', minutes: 75, priority: 1, seq: 20 });
    T.push({ id: `${sub.id}-cards`, sid: sub.id, kind: 'cards', title: 'فلاش كاردز: تثبيت الحفظ', minutes: 20, priority: 2, seq: 32 });
    T.push({ id: `${sub.id}-m2`, sid: sub.id, kind: 'mock', mock: 1, title: 'نموذج امتحان تاني + تصحيح', minutes: 75, priority: 3, seq: 50 });
    T.push({ id: `${sub.id}-night`, sid: sub.id, kind: 'night', title: 'مراجعة ليلة الامتحان', minutes: 60, priority: 1, pinned: true, seq: 90 });
    T.push({ id: `${sub.id}-morning`, sid: sub.id, kind: 'morning', title: 'مراجعة الصبح السريعة', minutes: 75, priority: 1, pinned: true, seq: 91 });
    T.sort((a, b) => a.seq - b.seq);
    out.push(...T);
  }
  return out;
}

export const taskMap = tasks => Object.fromEntries(tasks.map(t => [t.id, t]));
export const contentSig = tasks => tasks.map(t => t.id + ':' + t.minutes).join('|');

export function taskRoute(t) {
  switch (t.kind) {
    case 'lesson': return t.placeholder ? `#/s/${t.sid}` : `#/s/${t.sid}/u/${t.id}`;
    case 'drill': return `#/drill/${t.id}`;
    case 'mock': return `#/s/${t.sid}/mock/${t.mock}`;
    case 'cards': return `#/s/${t.sid}/cards`;
    case 'night': return `#/s/${t.sid}/last`;
    case 'morning': return `#/s/${t.sid}/morning`;
    default: return `#/s/${t.sid}`;
  }
}

// ---------- plan ----------
export function buildPlan({ now = Date.now(), settings, tasks, done }) {
  const st = settings;
  const exams = SUBJECTS.filter(s => s.startTs > now);
  const last = SUBJECTS[SUBJECTS.length - 1];
  const start = Math.ceil(now / SLOT) * SLOT;
  const end = last.endTs;
  if (start >= end) return { createdAt: now, start, end, blocks: [], overflow: {}, finished: true };
  const N = Math.round((end - start) / SLOT);
  const slots = Array.from({ length: N }, (_, i) => ({ t: start + i * SLOT, type: 'sleep', owner: null, task: null, brk: false }));
  const idx = ts => Math.max(0, Math.min(N, Math.round((ts - start) / SLOT)));
  const range = (a, b, fn) => { for (let i = idx(a); i < idx(b); i++) fn(slots[i], i); };

  const examOnDay = ts => SUBJECTS.find(s => dayStart(s.startTs) === dayStart(ts));
  const wakeOf = d => at(...ymd(d), ...hmArr(examOnDay(d) ? st.wakeExam : st.wake));
  const sleepOf = d => {
    const next = d + DAY + HOUR * 2; // DST-safe enough for this window
    const beforeExam = !!examOnDay(dayStart(next));
    const sm = hm(beforeExam ? st.sleepBeforeExam : st.sleep);
    const wm = hm(examOnDay(d) ? st.wakeExam : st.wake);
    let ts = at(...ymd(d), Math.floor(sm / 60), sm % 60);
    if (sm <= wm) ts += DAY;
    return ts;
  };

  // 1. awake windows, meals, work
  const firstDay = dayStart(start) - DAY;
  for (let d = firstDay; d <= dayStart(end); d += DAY) {
    const w = wakeOf(d), s = sleepOf(d);
    range(w, s, x => { x.type = 'free'; });
    const ex = examOnDay(d);
    const meal = (hhmm, mins) => { const t = at(...ymd(d), ...hmArr(hhmm)); range(t, t + mins * MIN, x => { if (x.type === 'free') x.type = 'meal'; }); };
    if (!ex || hm(st.lunch) >= hm(st.restUntil)) meal(st.lunch, 45);
    meal(st.dinner, 30);
    const wd = parts(d + 12 * HOUR).wd;
    if (st.work && st.work.enabled && st.work.days.includes(wd) && !(ex && st.work.offOnExamDays !== false)) {
      const a = at(...ymd(d), ...hmArr(st.work.from)), b = at(...ymd(d), ...hmArr(st.work.to));
      range(a, b, x => { if (x.type === 'free' || x.type === 'meal') x.type = 'work'; });
    }
  }

  // 2. exams: travel, exam, rest; reserve exam morning and exam eve for that subject
  for (const ex of SUBJECTS) {
    const d = dayStart(ex.startTs);
    const leave = at(...ymd(d), ...hmArr(st.leave));
    const rest = at(...ymd(d), ...hmArr(st.restUntil));
    range(leave, ex.startTs, x => { x.type = 'travel'; x.owner = ex.id; });
    range(ex.startTs, ex.endTs, x => { x.type = 'exam'; x.owner = ex.id; });
    range(ex.endTs, Math.max(rest, ex.endTs), x => { x.type = 'rest'; x.owner = ex.id; });
    range(wakeOf(d), leave, x => { if (x.type === 'free') x.owner = ex.id; });
    const eve = at(...ymd(d - DAY), 18, 0);
    range(eve, sleepOf(d - DAY), x => { if (x.type === 'free') x.owner = ex.id; });
  }

  const usable = (x, sid) => x.type === 'free' && !x.task && (x.owner === null || x.owner === sid);

  // 3. pinned reviews
  const tm = taskMap(tasks);
  for (const ex of exams) {
    const d = dayStart(ex.startTs);
    const mId = `${ex.id}-morning`, nId = `${ex.id}-night`;
    if (tm[mId] && !done[mId]) {
      const leave = at(...ymd(d), ...hmArr(st.leave));
      const endM = leave - 30 * MIN;
      const startM = Math.max(endM - tm[mId].minutes * MIN, wakeOf(d) + 20 * MIN);
      range(startM, endM, x => { if (usable(x, ex.id)) x.task = mId; });
    }
    if (tm[nId] && !done[nId]) {
      const sl = sleepOf(d - DAY) - 15 * MIN;
      let need = tm[nId].minutes / 5;
      for (let i = idx(sl) - 1; i >= 0 && need > 0 && slots[i].t >= sl - 6 * HOUR; i--) {
        if (usable(slots[i], ex.id)) { slots[i].task = nId; need--; }
      }
    }
    // the rest of the exam morning is breakfast / getting ready
    range(wakeOf(d), at(...ymd(d), ...hmArr(st.leave)), x => { if (x.type === 'free' && !x.task) x.type = 'prep'; });
  }

  // daily caps (regular tasks only; pinned reviews and breaks are not counted)
  const CAP = Math.round((st.dailyCap || 8) * 60);
  const CAP_EXAM = Math.min(CAP, 360);
  const dayOfSlot = slots.map(x => studyDay(x.t));
  const capOfDay = {};
  // exam days are lighter, unless another exam comes the very next day
  for (const d of new Set(dayOfSlot)) {
    const examToday = SUBJECTS.some(s => studyDay(s.startTs) === d);
    const examTomorrow = SUBJECTS.some(s => studyDay(s.startTs) === d + DAY);
    capOfDay[d] = examToday ? (examTomorrow ? CAP_EXAM : Math.min(CAP, 240)) : CAP;
  }
  const used = {};                 // minutes per study day (all subjects)
  const usedSid = {};              // minutes per subject per day
  const uKey = (sid, d) => sid + '@' + d;
  const left = (i, sid, quota) => {
    const d = dayOfSlot[i];
    let l = capOfDay[d] - (used[d] || 0);
    if (quota) l = Math.min(l, quota - (usedSid[uKey(sid, d)] || 0));
    return l;
  };
  const cap = (a, b, sid, quota) => {
    const per = {};
    range(a, b, (x, i) => { if (usable(x, sid)) per[dayOfSlot[i]] = (per[dayOfSlot[i]] || 0) + 5; });
    let tot = 0;
    for (const d in per) {
      let l = capOfDay[d] - (used[d] || 0);
      if (quota) l = Math.min(l, quota - (usedSid[uKey(sid, d)] || 0));
      tot += Math.max(0, Math.min(per[d] * EFF, l));
    }
    return tot;
  };
  const take = (i, id, sid) => {
    slots[i].task = id;
    const d = dayOfSlot[i];
    used[d] = (used[d] || 0) + 5;
    usedSid[uKey(sid, d)] = (usedSid[uKey(sid, d)] || 0) + 5;
  };
  const free1 = (i, sid) => {
    const x = slots[i];
    if (x.task && x.task !== '__break') {
      const d = dayOfSlot[i];
      used[d] -= 5; usedSid[uKey(sid, d)] -= 5;
    }
    x.task = null; x.brk = false;
  };
  const ok = (i, sid, quota) => usable(slots[i], sid) && left(i, sid, quota) >= 5;

  const isStudy = k => k >= 0 && slots[k].task && slots[k].task !== '__break' && slots[k].type === 'free';
  // minutes of continuous study (any subject) right before slot i, in slots
  const runBefore = i => { let n = 0; for (let k = i - 1; isStudy(k); k--) n++; return n; };
  const runLen = (i, lim, sid, quota) => { let L = 0; while (i + L < lim && ok(i + L, sid, quota)) L++; return L; };

  function place(list, a, b, sid, overflow, quota) {
    let i = idx(a); const lim = idx(b);
    for (const t of list) {
      let need = Math.round(t.minutes / 5);
      if (i >= lim || cap(slots[Math.min(i, N - 1)].t, b, sid, quota) < t.minutes * 0.95) { overflow.push(t.id); continue; }
      const i0 = i;
      const taken = [];
      const brk = n => { let k = 0; while (k < n && i < lim && usable(slots[i], sid)) { slots[i].task = '__break'; slots[i].brk = true; taken.push(i); i++; k++; } };
      // find a start: skip unusable slots and tiny gaps (under 20 min) that would only hold a scrap of the task
      let L = 0;
      for (;;) {
        while (i < lim && !ok(i, sid, quota)) i++;
        if (i >= lim) break;
        L = runLen(i, lim, sid, quota);
        const want = t.kind === 'mock' ? need + (runBefore(i) ? BRK : 0) : Math.min(need, 4);
        if (L < want || (t.kind === 'mock' && left(i, sid, quota) < t.minutes)) { i += Math.max(1, L); continue; }
        break;
      }
      if (i >= lim) { overflow.push(t.id); i = i0; continue; }
      let run = runBefore(i);
      if (t.kind === 'mock') {
        // one continuous sitting, with a break before it if she was already studying
        if (run) brk(BRK);
        for (let k = 0; k < need; k++) { take(i, t.id, sid); taken.push(i); i++; }
        brk(BRK);
        continue;
      }
      // take the break at the task boundary when the task would not fit before the next break
      if (run >= 4 && run + need > RUN + 3) { brk(BRK); run = 0; while (i < lim && !ok(i, sid, quota)) i++; L = runLen(i, lim, sid, quota); }
      // trim a tiny tail (10 min or less) instead of splitting it off after an interruption
      if (need > L && need - L <= 2 && run + L <= RUN + 3) need = L;
      while (need > 0 && i < lim) {
        if (!ok(i, sid, quota)) { run = 0; i++; continue; }
        if (run >= RUN && !(need <= 3 && run < RUN + 3)) { brk(BRK); run = 0; continue; }
        take(i, t.id, sid); taken.push(i); need--; run++; i++;
      }
      if (need > 0) {
        taken.forEach(j => free1(j, sid));
        i = i0;
        overflow.push(t.id);
      }
    }
    return i;
  }

  const overflow = {};
  let prevRestEnd = start, prevWs = start;
  for (const ex of SUBJECTS) {
    const d = dayStart(ex.startTs);
    const deadline = at(...ymd(d), ...hmArr(st.leave)) - 30 * MIN;
    const rest = Math.max(at(...ymd(d), ...hmArr(st.restUntil)), ex.endTs);
    if (ex.startTs <= now) { prevRestEnd = Math.max(prevRestEnd, rest); continue; }
    const ws = Math.max(start, prevRestEnd);
    const headFrom = Math.max(start, prevWs);
    prevRestEnd = rest; prevWs = ws;
    const over = (overflow[ex.id] = []);
    let list = tasks.filter(t => t.sid === ex.id && !t.pinned && !done[t.id]);
    if (!list.length) continue;
    const sum = l => l.reduce((a, t) => a + t.minutes, 0);
    // triage against everything this subject could use
    const total = cap(ws, deadline, ex.id) + (ws > headFrom ? cap(headFrom, ws, ex.id) : 0);
    while (sum(list) > total && list.length) {
      const worst = Math.max(...list.map(t => t.priority));
      let k = -1; for (let j = list.length - 1; j >= 0; j--) if (list[j].priority === worst) { k = j; break; }
      over.push(list[k].id); list.splice(k, 1);
    }
    const need = sum(list);
    const capDef = cap(ws, deadline, ex.id);
    let head = [], tail = list;
    if (need > capDef) {
      // the window is too small: the last tasks fill it, the first ones start earlier
      tail = []; let acc = 0;
      for (let j = list.length - 1; j >= 0; j--) { if (acc + list[j].minutes <= capDef * 0.97) { tail.unshift(list[j]); acc += list[j].minutes; } else break; }
      head = list.slice(0, list.length - tail.length);
    }
    if (head.length) {
      // spread the head over the days before the window too, so no single day gets crushed
      const hdays = new Set(); range(headFrom, ws, (x, i) => { if (usable(x, ex.id)) hdays.add(dayOfSlot[i]); });
      const hList = [...hdays].filter(dd => cap(Math.max(headFrom, dd + 4 * HOUR), Math.min(ws, dd + 28 * HOUR), ex.id) >= 45);
      const hq = hList.length > 1 ? Math.ceil(sum(head) / hList.length / 5) * 5 + 30 : null;
      const o1 = [];
      place(head, headFrom, ws, ex.id, o1, hq);
      let back = head.filter(t => o1.includes(t.id));
      if (back.length && hq) { const o1b = []; place(back, headFrom, ws, ex.id, o1b); back = back.filter(t => o1b.includes(t.id)); }
      tail = back.concat(tail);
    }
    // spread the tail over the days of the window (daily quota), then fill what is left as early as possible
    const days = new Set(); range(ws, deadline, (x, i) => { if (usable(x, ex.id)) days.add(dayOfSlot[i]); });
    const dayList = [...days].filter(dd => cap(Math.max(ws, dd + 4 * HOUR), Math.min(deadline, dd + 28 * HOUR), ex.id) >= 45);
    const tneed = sum(tail);
    const quota = dayList.length > 1 ? Math.ceil(tneed / dayList.length / 5) * 5 + 30 : null;
    const o2 = [];
    place(tail, ws, deadline, ex.id, o2, quota);
    if (o2.length) {
      // second pass without the quota, keeping the study order: each leftover starts after the tasks before it
      const lastIdx = id => { let k = -1; for (let j = 0; j < N; j++) if (slots[j].task === id) k = j; return k; };
      for (let j = 0; j < tail.length; j++) {
        const t = tail[j];
        if (!o2.includes(t.id)) continue;
        let from = idx(ws);
        for (let q = 0; q < j; q++) { const li = lastIdx(tail[q].id); if (li + 1 > from) from = li + 1; }
        if (from >= N) { over.push(t.id); continue; }
        const o3 = [];
        place([t], slots[from].t, deadline, ex.id, o3);
        over.push(...o3);
      }
    }
  }

  // 4. unused time reserved for an exam (its eve) becomes a light review block for that exam
  for (let i = 0; i < N;) {
    const x = slots[i];
    if (x.type === 'free' && !x.task && x.owner) {
      let j = i; while (j < N && slots[j].type === 'free' && !slots[j].task && slots[j].owner === x.owner) j++;
      const len = j - i;
      if (len >= 6) for (let k = Math.max(i, j - 12); k < j; k++) slots[k].task = `${x.owner}-extra`;
      i = j;
    } else i++;
  }

  // 5. merge into blocks
  const blocks = [];
  for (const x of slots) {
    let type = x.type, task = null, sid = null;
    if (x.task === '__break') type = 'break';
    else if (x.task && x.task.endsWith('-extra')) { type = 'extra'; sid = x.task.replace('-extra', ''); }
    else if (x.task) { type = 'study'; task = x.task; sid = tm[x.task] ? tm[x.task].sid : null; }
    else if (['exam', 'travel', 'rest', 'prep'].includes(type)) sid = x.owner;
    const lastB = blocks[blocks.length - 1];
    if (lastB && lastB.type === type && lastB.task === task && lastB.sid === sid && lastB.e === x.t) lastB.e = x.t + SLOT;
    else blocks.push({ s: x.t, e: x.t + SLOT, type, task, sid });
  }
  if (blocks[0] && blocks[0].type === 'free' && blocks[0].e - blocks[0].s <= 25 * MIN) blocks[0].type = 'warmup';
  // number the parts of tasks split across sessions
  const seen = {};
  for (const b of blocks) if (b.task) { seen[b.task] = (seen[b.task] || 0) + 1; b.part = seen[b.task]; }
  for (const b of blocks) if (b.task && seen[b.task] > 1) b.parts = seen[b.task];

  return { createdAt: now, start, end, blocks, overflow, sig: contentSig(tasks) };
}

function ymd(ts) { const p = parts(ts + 12 * HOUR); return [p.y, p.m, p.d]; }
function hmArr(s) { const v = hm(s); return [Math.floor(v / 60), v % 60]; }

// group key: a "study day" runs from 04:00 to 04:00
export const studyDay = ts => dayStart(ts - 4 * HOUR);

export function currentBlock(plan, now = Date.now()) {
  if (!plan) return null;
  return plan.blocks.find(b => b.s <= now && now < b.e) || null;
}
export function nextStudy(plan, done, now = Date.now()) {
  if (!plan) return null;
  return plan.blocks.find(b => b.type === 'study' && b.e > now && !done[b.task]) || null;
}
export function missed(plan, done, now = Date.now()) {
  if (!plan) return [];
  const last = {};
  for (const b of plan.blocks) if (b.type === 'study') last[b.task] = b.e;
  return Object.entries(last).filter(([id, e]) => e < now && !done[id]).map(([id]) => id);
}
export function subjectOf(id) { return SUBJECT[id.split('-')[0]]; }
