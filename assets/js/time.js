// Time helpers pinned to Cairo time (UTC+2 for the whole 7-19 Nov 2026 window),
// so the plan shows the same hours on any device, even one set to another time zone.
export const MIN = 60000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
const OFF = 120 * MIN;

export const pad = n => String(n).padStart(2, '0');

export function parts(ts) {
  const d = new Date(ts + OFF);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay() };
}
export function at(y, m, d, h = 0, mi = 0) { return Date.UTC(y, m - 1, d, h, mi) - OFF; }
export function dayStart(ts) { const p = parts(ts); return at(p.y, p.m, p.d); }
export function dayKey(ts) { const p = parts(ts); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; }
export function fromKey(key) { const [y, m, d] = key.split('-').map(Number); return at(y, m, d); }
export function hm(s) { const [h, m] = s.split(':').map(Number); return h * 60 + m; }

const WD = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTH = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const weekday = ts => WD[parts(ts).wd];
export const dateShort = ts => { const p = parts(ts); return `${p.d} ${MONTH[p.m - 1]}`; };
export const dateLong = ts => `${weekday(ts)} ${dateShort(ts)}`;

export function time(ts) {
  const p = parts(ts);
  let h = p.h % 12; if (h === 0) h = 12;
  const suf = p.h < 12 ? 'ص' : 'م';
  return `${h}:${pad(p.mi)} ${suf}`;
}

// Arabic counted nouns: 1 singular, 2 dual, 3-10 plural, 11+ singular
export function count(n, one, two, few) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${one}`;
}
const H = n => count(n, 'ساعة', 'ساعتين', 'ساعات');
const M = n => count(n, 'دقيقة', 'دقيقتين', 'دقايق');
const D = n => count(n, 'يوم', 'يومين', 'أيام');

export function dur(mins) {
  mins = Math.round(mins);
  const h = Math.floor(mins / 60), m = mins % 60;
  const hs = h ? H(h) : '', ms = m ? M(m) : '';
  if (hs && ms) return `${hs} و${ms}`;
  return hs || ms || '0 دقيقة';
}

// "بعد يومين و5 ساعات" style countdown
export function until(ts, now = Date.now()) {
  let d = ts - now;
  if (d <= 0) return 'دلوقتي';
  const days = Math.floor(d / DAY); d -= days * DAY;
  const hrs = Math.floor(d / HOUR); d -= hrs * HOUR;
  const mins = Math.floor(d / MIN);
  if (days > 0) return hrs ? `${D(days)} و${H(hrs)}` : D(days);
  if (hrs > 0) return mins ? `${H(hrs)} و${M(mins)}` : H(hrs);
  return M(Math.max(1, mins));
}

export function clock(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`;
}
