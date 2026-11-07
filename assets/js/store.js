import { DEFAULT_SETTINGS } from './config.js';
import { dayKey } from './time.js';

const KEY = 'hn_state_v1';
let mem = null;

function fresh() {
  return { settings: structuredClone(DEFAULT_SETTINGS), done: {}, q: {}, cards: {}, mocks: {}, plan: null, xp: 0, streak: { last: null, count: 0 }, log: [] };
}

export function load() {
  if (mem) return mem;
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
  mem = Object.assign(fresh(), s || {});
  mem.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), mem.settings || {});
  mem.settings.work = Object.assign(structuredClone(DEFAULT_SETTINGS.work), mem.settings.work || {});
  return mem;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* private mode: keep in memory */ }
}

export const S = () => load();
export const settings = () => load().settings;

export function setSetting(k, v) { load().settings[k] = v; save(); }

export function isDone(id) { return !!load().done[id]; }
// points are given once per item, so unchecking and checking again does not farm them
export function award(key, xp) {
  const s = load();
  s.awarded = s.awarded || {};
  if (s.awarded[key]) return false;
  s.awarded[key] = 1;
  addXP(xp);
  return true;
}
export function markDone(id, xp = 0) {
  const s = load();
  if (!s.done[id]) { s.done[id] = Date.now(); award(id, xp); }
  save();
}
export function unmarkDone(id) { delete load().done[id]; save(); }

export function addXP(n) {
  const s = load();
  s.xp = (s.xp || 0) + n;
  const today = dayKey(Date.now());
  if (s.streak.last !== today) {
    const y = dayKey(Date.now() - 86400000);
    s.streak.count = s.streak.last === y ? s.streak.count + 1 : 1;
    s.streak.last = today;
  }
  save();
}

export function qStatus(id) { return load().q[id] || null; }
export function setQ(id, v) { const s = load(); if (v) s.q[id] = v; else delete s.q[id]; save(); }

export function cardBox(id) { return (load().cards[id] || { box: 0 }).box; }
export function setCard(id, known) {
  const s = load();
  const c = s.cards[id] || { box: 0, seen: 0 };
  c.seen++;
  c.box = known ? Math.min(3, c.box + 1) : 0;
  s.cards[id] = c; save();
}

export function addMock(id, score, max) {
  const s = load();
  (s.mocks[id] = s.mocks[id] || []).push({ at: Date.now(), score, max });
  save();
}

export function resetAll() { mem = fresh(); save(); }

// Progress sharing: compact export of done tasks + question statuses.
export function exportCode() {
  const s = load();
  const payload = { d: Object.keys(s.done), q: s.q, x: s.xp, t: Date.now() };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeCode(code) {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function importCode(code) {
  const p = decodeCode(code);
  const s = load();
  (p.d || []).forEach(id => { if (!s.done[id]) s.done[id] = p.t || Date.now(); });
  Object.assign(s.q, p.q || {});
  s.xp = Math.max(s.xp || 0, p.x || 0);
  save();
  return p;
}
