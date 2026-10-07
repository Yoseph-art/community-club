/* Community Club — football hub. Plain JavaScript, no build step. */
(() => {
'use strict';

// ============ helpers ============
const db = () => Store.db;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const today = () => iso(new Date());
const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = (s, opt) => (s ? parseD(s).toLocaleDateString('en-GB', opt || { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtShort = (s) => fmtDate(s, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDM = (s) => fmtDate(s, { day: '2-digit', month: '2-digit' });
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
const age = (dob) => { if (!dob) return null; const b = parseD(dob), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--; return a; };
const monthKey = (s) => s.slice(0, 7);
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const f1 = (v) => (v == null ? '–' : Number(v).toFixed(1));
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const plural = (n, w, ws) => `${n} ${n === 1 ? w : ws || w + 's'}`;

const ui = { playerTab: 'overview', matchTab: null, matchesTab: 'fixtures', search: '', line: 'all', status: 'all', sel: null, drag: null, revealNin: {} };

// ============ football vocabulary ============
const POSITIONS = ['GK', 'RB', 'CB', 'LB', 'RWB', 'LWB', 'DM', 'CM', 'AM', 'RM', 'LM', 'RW', 'LW', 'ST'];
const POS_NAME = { GK: 'Goalkeeper', RB: 'Right back', CB: 'Centre back', LB: 'Left back', RWB: 'Right wing-back', LWB: 'Left wing-back', DM: 'Defensive midfield', CM: 'Central midfield', AM: 'Attacking midfield', RM: 'Right midfield', LM: 'Left midfield', RW: 'Right wing', LW: 'Left wing', ST: 'Striker' };
const LINE = { GK: 'GK', RB: 'DEF', CB: 'DEF', LB: 'DEF', RWB: 'DEF', LWB: 'DEF', DM: 'MID', CM: 'MID', AM: 'MID', RM: 'MID', LM: 'MID', RW: 'FWD', LW: 'FWD', ST: 'FWD' };
const LINES = [['GK', 'Goalkeepers'], ['DEF', 'Defenders'], ['MID', 'Midfielders'], ['FWD', 'Forwards']];
const LINE_RANK = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
const SKILLS = [['pace', 'Pace'], ['passing', 'Passing'], ['shooting', 'Shooting'], ['dribbling', 'Dribbling'], ['defending', 'Defending'], ['fitness', 'Fitness'], ['discipline', 'Discipline']];
const STATUS = { active: ['Active', 'good'], injured: ['Injured', 'bad'], suspended: ['Suspended', 'warn'], left: ['Left club', 'mute'] };
const ATT = { P: 'Present', L: 'Late', E: 'Excused', A: 'Absent' };
const AVAIL = { yes: 'Available', maybe: 'Maybe', no: 'Unavailable' };
const TAGS = ['Improvement', 'Strength', 'Concern', 'General'];
const BIBS = ['Gold bibs', 'Blue bibs', 'White bibs', 'Red bibs'];

// Shapes by players per side. "GK" = has a keeper; numbers = outfield lines from the back.
const SHAPES = {
  2: ['2', '1-1'], 3: ['GK 2', 'GK 1-1', '1-2'], 4: ['GK 2-1', 'GK 1-2', '2-2'],
  5: ['GK 2-1-1', 'GK 1-2-1', 'GK 2-2'], 6: ['GK 2-2-1', 'GK 3-1-1', 'GK 2-1-2'],
  7: ['GK 2-3-1', 'GK 3-2-1', 'GK 3-1-2'], 8: ['GK 3-3-1', 'GK 3-2-2', 'GK 2-3-2'],
  9: ['GK 3-3-2', 'GK 3-4-1', 'GK 4-3-1'], 10: ['GK 4-3-2', 'GK 3-4-2', 'GK 4-4-1'],
  11: ['GK 4-3-3', 'GK 4-4-2', 'GK 3-5-2', 'GK 4-2-3-1'],
};
const SIDE_MIN = 2, SIDE_MAX = 11;
const ROLE_SET = {
  DEF: { 1: ['CB'], 2: ['CB', 'CB'], 3: ['LB', 'CB', 'RB'], 4: ['LB', 'CB', 'CB', 'RB'], 5: ['LWB', 'CB', 'CB', 'CB', 'RWB'] },
  MID: { 1: ['CM'], 2: ['CM', 'CM'], 3: ['LM', 'CM', 'RM'], 4: ['LM', 'CM', 'CM', 'RM'], 5: ['LM', 'CM', 'DM', 'CM', 'RM'] },
  DML: { 1: ['DM'], 2: ['DM', 'DM'], 3: ['DM', 'DM', 'DM'] },
  AML: { 1: ['AM'], 2: ['AM', 'AM'], 3: ['LW', 'AM', 'RW'] },
  FWD: { 1: ['ST'], 2: ['ST', 'ST'], 3: ['LW', 'ST', 'RW'] },
};
const shapeLabel = (s) => (s.startsWith('GK ') ? s.slice(3) : `${s} (no keeper)`);
// Where a side stands: full pitch (vs another team) or one half each (our players split in two)
const AREA = { full: { gk: 86, back: 70, front: 20 }, half: { gk: 87, back: 77, front: 57.5 } };
function shapeSlots(shape, area, mirror) {
  const gk = shape.startsWith('GK ');
  const lines = shape.replace('GK ', '').split('-').map(Number);
  const types = { 1: ['FWD'], 2: ['DEF', 'FWD'], 3: ['DEF', 'MID', 'FWD'], 4: ['DEF', 'DML', 'AML', 'FWD'] }[lines.length];
  const out = gk ? [['GK', 50, area.gk]] : [];
  lines.forEach((n, li) => {
    const y = lines.length === 1 ? (area.back + area.front) / 2 : area.back + ((area.front - area.back) * li) / (lines.length - 1);
    const roles = ROLE_SET[types[li]][n] || Array(n).fill(ROLE_SET[types[li]][1][0]);
    const gap = Math.min(30, 84 / n);
    for (let i = 0; i < n; i++) out.push([roles[i], 50 + (i - (n - 1) / 2) * gap, y]);
  });
  return mirror ? out.map(([r, x, y]) => [r, 100 - x, 100 - y]) : out;
}

// ============ icons ============
const I = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  squad: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.6.2 4.3 1.9 5 4.9"/>',
  training: '<path d="M12 3l7 17H5z"/><path d="M8.2 12h7.6M6.6 16h10.8"/><path d="M3 20h18"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l4 2.9-1.5 4.7h-5L8 10.4z"/><path d="M12 3v4.5M16 10.4l4.6-1.6M14.5 15.1l2.8 3.9M9.5 15.1l-2.8 3.9M8 10.4L3.4 8.8"/>',
  health: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  comment: '<path d="M4 5h16v11H9l-5 4z"/>', back: '<path d="M15 5l-7 7 7 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>', download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>', shuffle: '<path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  wand: '<path d="M4 20L15 9M13 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 12l.7 1.3L21 14l-1.3.7L19 16l-.7-1.3L17 14l1.3-.7z"/>',
  alert: '<path d="M12 3.5l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>', cake: '<path d="M4 21h16v-8H4zM4 16.5c2.6 1.4 5.4 1.4 8 0s5.4-1.4 8 0M12 13V9M12 6v.01"/>',
  check: '<path d="M5 12l5 5 9-10"/>', moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', pin: '<path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

function crest(text, color, stripe) {
  const t = esc(String(text || '').slice(0, 3).toUpperCase());
  const fs = t.length > 2 ? 11 : 14;
  return `<svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 1.5L37 7v14c0 11-7.4 19.6-17 23.5C10.4 40.6 3 32 3 21V7z" fill="${color}" stroke="rgba(255,255,255,.85)" stroke-width="1.6"/><path d="M3 15h34v6H3z" fill="${stripe}" opacity=".9"/><text x="20" y="${t.length > 2 ? 34 : 35}" text-anchor="middle" font-family="Big Shoulders Display, Arial Narrow, sans-serif" font-weight="900" font-size="${fs}" fill="#fff">${t}</text></svg>`;
}
const clubCrest = () => crest(db().club.short || 'CC', '#0f1830', '#f5b841');
const oppCrest = (name) => { const h = hash(name); const hues = [355, 210, 140, 28, 265, 190, 95, 320]; const hue = hues[h % hues.length]; return crest(oppShort(name), `hsl(${hue} 55% 38%)`, `hsl(${hue} 70% 70%)`); };
const oppShort = (name) => String(name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 3);

// ============ data access & derived stats ============
const player = (id) => db().players.find((p) => p.id === id);
const fullName = (p) => (p ? `${p.first} ${p.last}` : 'Former player');
const shortName = (p) => (p ? `${p.first[0]}. ${p.last}` : '?');
const initials = (p) => (p ? (p.first[0] + p.last[0]).toUpperCase() : '?');
const byJersey = (a, b) => (a.jersey ?? 999) - (b.jersey ?? 999) || a.last.localeCompare(b.last);
const squad = () => db().players.filter((p) => p.status !== 'left').sort(byJersey);
const fit = (p) => p.status === 'active';
const sortDesc = (a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''));
const sortAsc = (a, b) => sortDesc(b, a);
const pastSessions = () => db().sessions.filter((s) => s.date <= today()).sort(sortDesc);
const upcomingSessions = () => db().sessions.filter((s) => s.date > today()).sort(sortAsc);
const playedMatches = () => db().matches.filter((m) => m.status === 'played').sort(sortDesc);
const openMatches = () => db().matches.filter((m) => m.status !== 'played').sort(sortAsc);
const result = (m) => (m.ourScore > m.theirScore ? 'W' : m.ourScore < m.theirScore ? 'L' : 'D');
const isSplit = (m) => m.mode !== 'opponent';
const vsGames = (list) => list.filter((m) => !isSplit(m));
const TEAM_NAME = { A: 'Gold', B: 'Blue' };
const gameTitle = (m) => teams(m).map((t) => t.name).join(' v ');
const headcount = (m) => (m.lineup || []).filter(Boolean).length + (m.lineupB || []).filter(Boolean).length + (m.bench || []).length;
// Short match-centre meta line: NEXT · WED 8 OCT · 5v5 · KISASI TURF (time sits under the score)
const metaBits = (m, lead) => [`<span class="live">${esc(lead)}</span>`, fmtShort(m.date), `${sideSize(m)}v${sideSize(m)}`, !isSplit(m) && m.competition, m.location].filter(Boolean).map((x, i) => (i ? `<span>${esc(x)}</span>` : x)).join('');

// ---- turf lineups: side size follows how many people are coming ----
const confirmed = (m) => squad().filter((p) => fit(p) && m.availability?.[p.id] === 'yes');
function autoSize(m) {
  const n = confirmed(m).length;
  if (!n) return isSplit(m) ? 5 : 7;
  return Math.max(SIDE_MIN, Math.min(SIDE_MAX, isSplit(m) ? Math.floor(n / 2) : n));
}
const sideSize = (m) => (m.sideSize ? +m.sideSize : autoSize(m));
function shapeOf(m, team) {
  const k = sideSize(m);
  const s = team === 'B' ? m.shapeB : m.shapeA;
  return SHAPES[k].includes(s) ? s : SHAPES[k][0];
}
const slotsFor = (m, team) => shapeSlots(shapeOf(m, team), isSplit(m) ? AREA.half : AREA.full, team === 'B');
function lineupOf(m, team) {
  const n = slotsFor(m, team).length;
  const L = ((team === 'B' ? m.lineupB : m.lineup) || []).slice();
  return L.concat(Array(Math.max(0, n - L.length)).fill(null));
}
// Keep lineups the right length when the side size changes; anyone pushed off goes to the bench
function syncLineup(m) {
  m.bench = m.bench || [];
  let changed = false;
  for (const team of isSplit(m) ? ['A', 'B'] : ['A']) {
    const key = team === 'B' ? 'lineupB' : 'lineup';
    const n = slotsFor(m, team).length;
    const L = lineupOf(m, team);
    const extra = L.slice(n).filter(Boolean);
    if (extra.length || (m[key] || []).length !== n) changed = true;
    extra.forEach((pid) => { if (!m.bench.includes(pid)) m.bench.push(pid); });
    m[key] = L.slice(0, n);
  }
  if (!isSplit(m) && m.lineupB?.some(Boolean)) { m.lineupB.filter(Boolean).forEach((pid) => m.bench.push(pid)); m.lineupB = []; changed = true; }
  return changed;
}
const teamOf = (m, pid) => ((m.lineup || []).includes(pid) ? 'A' : (m.lineupB || []).includes(pid) ? 'B' : (m.teamOfSub || {})[pid] || null);
function playerResult(m, pid) {
  if (!isSplit(m)) return result(m);
  const t = teamOf(m, pid);
  if (!t) return null;
  const mine = t === 'A' ? m.ourScore : m.theirScore, theirs = t === 'A' ? m.theirScore : m.ourScore;
  return mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
}

function attendance(pid, limit) {
  let ss = pastSessions().filter((s) => s.attendance && s.attendance[pid]);
  if (limit) ss = ss.slice(0, limit);
  const present = ss.filter((s) => s.attendance[pid] === 'P' || s.attendance[pid] === 'L').length;
  return { total: ss.length, present, rate: ss.length ? Math.round((present / ss.length) * 100) : null };
}
function missedStreak(pid) {
  let n = 0;
  for (const s of pastSessions()) { const v = s.attendance?.[pid]; if (!v) continue; if (v === 'A') n++; else break; }
  return n;
}
function playerStats(pid) {
  const r = { apps: 0, starts: 0, min: 0, goals: 0, assists: 0, yc: 0, rc: 0, motm: 0, ratings: [], log: [], W: 0, D: 0, L: 0 };
  for (const m of playedMatches()) {
    const st = m.stats?.[pid];
    const started = (m.lineup || []).includes(pid) || (isSplit(m) && (m.lineupB || []).includes(pid));
    const min = st ? Number(st.min) || 0 : started ? +m.duration || 60 : 0;
    if (!started && min <= 0) continue;
    r.apps++; if (started) r.starts++;
    const res = playerResult(m, pid); if (res) r[res]++;
    r.min += min;
    r.goals += +st?.goals || 0; r.assists += +st?.assists || 0; r.yc += +st?.yc || 0; r.rc += +st?.rc || 0;
    if (st?.rating) r.ratings.push(+st.rating);
    if (m.motm === pid) r.motm++;
    r.log.push({ m, st: st || {}, started, min });
  }
  r.avg = avg(r.ratings);
  return r;
}
const skillsOf = (pid) => db().skills.filter((s) => s.pid === pid).sort((a, b) => b.date.localeCompare(a.date));
const skillAvg = (s) => (s ? avg(SKILLS.map(([k]) => +s[k] || 0)) : null);
const overall = (pid) => skillAvg(skillsOf(pid)[0]);

const activeInjuries = () => db().injuries.filter((i) => !i.resolved).sort((a, b) => b.date.localeCompare(a.date));
function daysToBirthday(dob) {
  const b = parseD(dob), n = parseD(today());
  let next = new Date(n.getFullYear(), b.getMonth(), b.getDate());
  if (next < n) next = new Date(n.getFullYear() + 1, b.getMonth(), b.getDate());
  return Math.round((next - n) / 86400000);
}

// ============ small render pieces ============
const AV_COLORS = ['#3b5bdb', '#0c8599', '#2f9e44', '#e8590c', '#ae3ec9', '#c2255c', '#1971c2', '#5f3dc4', '#087f5b', '#d9480f'];
function avatar(p, size = '') {
  if (!p) return `<span class="avatar ${size}">?</span>`;
  if (p.photo) return `<span class="avatar ${size}"><img src="${p.photo}" alt=""></span>`;
  return `<span class="avatar ${size}" style="--av:${AV_COLORS[hash(p.id) % AV_COLORS.length]}">${esc(initials(p))}</span>`;
}
const kit = (p) => `<span class="kit" title="Squad number">${esc(p?.jersey ?? '')}</span>`;
const rtClass = (r) => (r == null ? 'rt-none' : r >= 8 ? 'rt-top' : r >= 6.5 ? 'rt-good' : r >= 5 ? 'rt-mid' : 'rt-low');
const rating = (r) => `<span class="rt ${rtClass(r)}">${f1(r)}</span>`;
const statusPill = (s) => { const [l, c] = STATUS[s] || STATUS.active; return `<span class="pill ${c}">${l}</span>`; };
const formPills = (ms) => `<span class="form">${ms.map((m) => `<span class="fm ${result(m)}" title="${esc(m.opponent)} ${m.ourScore}-${m.theirScore}">${result(m)}</span>`).join('')}</span>`;
const maskNin = (n) => (n ? n.slice(0, 2) + '•'.repeat(Math.max(0, n.length - 4)) + n.slice(-2) : '—');
const empty = (title, text, btn = '') => `<div class="empty"><strong>${esc(title)}</strong>${esc(text)}${btn ? `<div style="margin-top:12px">${btn}</div>` : ''}</div>`;
const pageHead = (title, eyebrow, actions = '', back = '') => `<div class="topbar"><div>${back}${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}<h1>${esc(title)}</h1></div><div class="actions">${actions}</div></div>`;
const backLink = (href, label) => `<a class="backlink" href="${href}">${icon('back')} ${esc(label)}</a>`;
const tabs = (name, items, on) => `<div class="tabs" role="tablist">${items.map(([k, l, c]) => `<button type="button" role="tab" aria-selected="${k === on}" class="${k === on ? 'on' : ''}" data-action="tab" data-tab="${name}" data-v="${k}">${esc(l)}${c != null ? `<span class="count">${c}</span>` : ''}</button>`).join('')}</div>`;

const bibCrest = (t) => (t === 'A' ? crest('G', '#b8860b', '#f5b841') : crest('B', '#1f4fa8', '#6aa5ff'));
function teams(m) {
  if (isSplit(m)) return [{ name: TEAM_NAME.A, crest: bibCrest('A'), us: false, score: m.ourScore }, { name: TEAM_NAME.B, crest: bibCrest('B'), us: false, score: m.theirScore }];
  const us = { name: db().club.name, crest: clubCrest(), us: true, score: m.ourScore };
  const them = { name: m.opponent, crest: oppCrest(m.opponent), us: false, score: m.theirScore };
  return m.venue === 'A' ? [them, us] : [us, them];
}

function matchRow(m) {
  const played = m.status === 'played';
  const [h, a] = teams(m);
  const overdue = !played && m.date < today();
  const av = m.availability || {};
  const yes = Object.values(av).filter((v) => v === 'yes').length;
  const lead = (x, y) => (played ? (x.score > y.score ? 'lead' : x.score < y.score ? 'trail' : '') : '');
  return `<a class="mrow" href="#/match/${m.id}">
    <div class="mrow-time">${fmtDM(m.date)}<small>${played ? 'FT' : overdue ? 'RESULT?' : esc(m.time || '')}</small></div>
    <div class="mrow-teams"><div class="${h.us ? 'us' : ''}">${h.crest}${esc(h.name)}</div><div class="${a.us ? 'us' : ''}">${a.crest}${esc(a.name)}</div></div>
    <div class="mrow-score">${played ? `<span class="${lead(h, a)}">${h.score}</span><span class="${lead(a, h)}">${a.score}</span>` : '<span class="trail">–</span><span class="trail">–</span>'}</div>
    <div class="mrow-end">${overdue ? '<span class="pill warn">Add result</span>' : isSplit(m) ? `<span class="pill mute">${sideSize(m)}v${sideSize(m)}</span>` : played ? `<span class="fm ${result(m)}">${result(m)}</span>` : `${yes} in`}</div>
  </a>`;
}

// ============ shell ============
const NAV = [
  ['dashboard', 'Matchday', 'home'], ['players', 'Squad', 'squad'], ['training', 'Training', 'training'],
  ['matches', 'Games', 'ball'], ['health', 'Injuries', 'health'], ['settings', 'Settings', 'settings'],
];
const ROUTE_PARENT = { player: 'players', session: 'training', match: 'matches', more: 'more' };

function renderShell(route) {
  const c = db().club;
  const navKey = ROUTE_PARENT[route] || route;
  $('#brand').innerHTML = `${clubCrest()}<div><strong>${esc(c.name)}</strong><span>Season ${esc(c.season)}</span></div>`;
  const counts = { players: squad().length, health: activeInjuries().length || '' };
  $('#nav').innerHTML = NAV.map(([k, l, ic]) => `<a href="#/${k}" class="${navKey === k ? 'on' : ''}">${icon(ic)}${esc(l)}${counts[k] ? `<span class="count">${counts[k]}</span>` : ''}</a>`).join('');
  const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#sideFoot').innerHTML = `<button class="btn btn-sm" type="button" data-action="theme">${icon(dark ? 'sun' : 'moon')} ${dark ? 'Light mode' : 'Dark mode'}</button><span>Saved on this device</span>`;
  const mob = [['dashboard', 'Home', 'home'], ['players', 'Squad', 'squad'], ['training', 'Training', 'training'], ['matches', 'Games', 'ball'], ['more', 'More', 'more']];
  const mobKey = ['health', 'settings'].includes(navKey) ? 'more' : navKey;
  $('#tabbar').innerHTML = mob.map(([k, l, ic]) => `<a href="#/${k}" class="${mobKey === k ? 'on' : ''}">${icon(ic)}${l}</a>`).join('');
  $('#banner').innerHTML = db().isSample ? `<div class="banner">${icon('alert')}<span><b>Sample data</b> · made-up players</span><span class="grow"></span><button class="btn btn-sm" type="button" data-action="clear-sample">Clear</button></div>` : '';
}

const VIEWS = {};
function render() {
  const [, route = 'dashboard', id] = location.hash.split('/');
  const view = VIEWS[route] || VIEWS.dashboard;
  renderShell(route);
  $('#view').innerHTML = `<div class="page">${view(id)}</div>`;
  document.title = `${db().club.name} Matchday`;
}
let lastRoute = '';
window.addEventListener('hashchange', () => {
  const r = location.hash.split('/').slice(0, 3).join('/');
  if (r !== lastRoute) { ui.sel = null; ui.matchTab = ui.nextTab || null; ui.nextTab = null; if (!r.startsWith('#/player/')) ui.playerTab = 'overview'; window.scrollTo(0, 0); }
  lastRoute = r;
  render();
});

// ============ DASHBOARD ============
VIEWS.dashboard = () => {
  const next = openMatches().find((m) => m.date >= today()) || openMatches()[0];
  const played = playedMatches();
  const active = squad();

  let board;
  if (next) {
    const [h, a] = teams(next);
    const d = daysBetween(today(), next.date);
    const av = next.availability || {};
    const n = { yes: 0, maybe: 0, no: 0 };
    const pool = active.filter(fit);
    pool.forEach((p) => { const v = av[p.id]; if (v) n[v]++; });
    const none = pool.length - n.yes - n.maybe - n.no;
    const pct = (x) => (pool.length ? (x / pool.length) * 100 : 0);
    board = `<section class="board" aria-label="Next game">
      <div class="board-meta">${metaBits(next, 'Next')}</div>
      <div class="board-teams">
        <div class="bt">${h.crest}<span>${esc(h.name)}</span></div>
        <div class="bt-mid"><div class="countdown">${d < 0 ? 'Result due' : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d + ' days'}</div><small>${esc(next.time)}</small></div>
        <div class="bt">${a.crest}<span>${esc(a.name)}</span></div>
      </div>
      <div class="board-foot">
        <div class="availbar"><div class="bar"><i style="width:${pct(n.yes)}%;background:#17924f"></i><i style="width:${pct(n.maybe)}%;background:#e1b524"></i><i style="width:${pct(n.no)}%;background:#d0343a"></i></div>
          <div class="legend"><span><span class="dot" style="background:#17924f"></span><b>${n.yes}</b> in</span><span><span class="dot" style="background:#e1b524"></span><b>${n.maybe}</b> maybe</span><span><span class="dot" style="background:#d0343a"></span><b>${n.no}</b> out</span><span><b>${none}</b> no reply</span></div></div>
        <a class="btn btn-primary" href="#/match/${next.id}">${icon('ball')} Lineups</a>
      </div></section>`;
  } else {
    board = `<section class="board"><div class="board-meta"><span class="live">Next</span></div><div class="board-teams"><div class="bt">${bibCrest('A')}<span>${TEAM_NAME.A}</span></div><div class="bt-mid"><div class="countdown">No game</div></div><div class="bt">${bibCrest('B')}<span>${TEAM_NAME.B}</span></div></div><div class="board-foot"><span></span><button class="btn btn-primary" type="button" data-action="new-match">${icon('plus')} New game</button></div></section>`;
  }

  const recent = pastSessions().filter((s) => daysBetween(s.date, today()) <= 28);
  const attRates = recent.map((s) => { const v = Object.values(s.attendance || {}); return v.length ? v.filter((x) => x === 'P' || x === 'L').length / v.length : null; }).filter((x) => x != null);
  const vs = vsGames(played);
  const goals = played.reduce((s, m) => s + (+m.ourScore || 0) + (isSplit(m) ? +m.theirScore || 0 : 0), 0);
  const turnout = avg(played.map(headcount));
  const strip = `<div class="card strip">
    <div><div class="k">Squad</div><div class="v">${active.length}</div><div class="s">${active.filter(fit).length} fit</div></div>
    <div><div class="k">Training</div><div class="v">${attRates.length ? Math.round(avg(attRates) * 100) + '%' : '–'}</div><div class="s">Last 4 weeks</div></div>
    <div><div class="k">Played</div><div class="v">${played.length}</div><div class="s">${turnout ? `Avg ${Math.round(turnout)} players` : '–'}</div></div>
    <div><div class="k">Goals</div><div class="v">${goals}</div><div class="s">${played.length ? `${f1(goals / played.length)} per game` : '–'}</div></div>
  </div>`;

  const results = `<div class="card"><div class="card-h"><h2>Results</h2><span class="sub">${vs.length ? formPills(vs.slice(0, 5).reverse()) : ''}${played.length > 6 ? ' <a class="btn btn-sm" href="#/matches">All</a>' : ''}</span></div>
    <div class="list">${played.length ? played.slice(0, 6).map(matchRow).join('') : empty('No results', '')}</div></div>`;

  const chartSessions = pastSessions().slice(0, 14).reverse();
  const chart = `<div class="card"><div class="card-h"><h2>Training</h2><span class="sub">Present per session</span></div><div class="card-b">${chartSessions.length ? attendanceChart(chartSessions) : empty('No sessions', '')}</div></div>`;

  const alerts = [];
  activeInjuries().forEach((i) => { const p = player(i.pid); if (!p) return; const back = i.expectedReturn ? daysBetween(today(), i.expectedReturn) : null; alerts.push(['bad', 'health', fullName(p), `Injured · ${esc(i.type)}${back != null ? (back > 0 ? ` · back in ${plural(back, 'day')}` : ' · due back') : ''}`, `#/player/${p.id}`]); });
  active.forEach((p) => { const n = missedStreak(p.id); if (n >= 3) alerts.push(['warn', 'alert', fullName(p), `Missed last ${n} sessions`, `#/player/${p.id}`]); });
  openMatches().filter((m) => m.date < today()).forEach((m) => alerts.push(['info', 'ball', 'Result missing', `${esc(gameTitle(m))} · ${fmtShort(m.date)}`, `#/match/${m.id}`]));
  if (next) { const none = active.filter((p) => fit(p) && !next.availability?.[p.id]).length; if (none) alerts.push(['info', 'ball', `${none} no reply`, `${esc(gameTitle(next))} · ${fmtShort(next.date)}`, `#/match/${next.id}`]); }
  active.filter((p) => p.dob).map((p) => [p, daysToBirthday(p.dob)]).filter(([, d]) => d <= 14).sort((a, b) => a[1] - b[1])
    .forEach(([p, d]) => { const on = parseD(today()); on.setDate(on.getDate() + d); alerts.push(['good', 'cake', fullName(p), `Birthday · ${age(p.dob) + (d === 0 ? 0 : 1)} · ${d === 0 ? 'today' : fmtShort(iso(on))}`, `#/player/${p.id}`]); });
  const alertCard = `<div class="card"><div class="card-h"><h2>Alerts</h2><span class="sub">${alerts.length || ''}</span></div><div class="alerts">${alerts.length ? alerts.map(([cls, ic, t, s, href]) => `<a class="alert ${cls}" href="${href}"><span class="ai">${icon(ic)}</span><span><b>${esc(t)}</b><small>${s}</small></span></a>`).join('') : empty('All clear', '')}</div></div>`;

  const rows = active.map((p) => ({ p, s: playerStats(p.id), a: attendance(p.id) }));
  const lb = (title, list, val) => `<div><h4>${title}</h4>${list.length ? list.slice(0, 3).map((r, i) => `<a class="lrow" href="#/player/${r.p.id}"><span class="pos">${i + 1}</span>${avatar(r.p, 'sm')}<span class="n">${esc(shortName(r.p))}</span><span class="v">${val(r)}</span></a>`).join('') : '<div class="hint">–</div>'}</div>`;
  const leaders = `<div class="card"><div class="card-h"><h2>Top players</h2></div><div class="leaders">
    ${lb('Goals', rows.filter((r) => r.s.goals).sort((a, b) => b.s.goals - a.s.goals || b.s.assists - a.s.assists), (r) => r.s.goals)}
    ${lb('Assists', rows.filter((r) => r.s.assists).sort((a, b) => b.s.assists - a.s.assists || b.s.goals - a.s.goals), (r) => r.s.assists)}
    ${lb('Wins', rows.filter((r) => r.s.W).sort((a, b) => b.s.W - a.s.W || a.s.apps - b.s.apps), (r) => `${r.s.W}<small style="color:var(--faint);font-weight:700">/${r.s.apps}</small>`)}
    ${lb('Training', rows.filter((r) => r.a.total >= 3).sort((a, b) => b.a.rate - a.a.rate || b.a.total - a.a.total), (r) => r.a.rate + '%')}
  </div></div>`;

  return `${board}${strip}<div class="grid-2"><div class="stack">${results}${chart}</div><div class="stack">${alertCard}${leaders}</div></div>`;
};

function attendanceChart(ss) {
  const W = 560, H = 170, pl = 26, pb = 22, pt = 8;
  const max = Math.max(squad().length, ...ss.map((s) => Object.keys(s.attendance || {}).length), 1);
  const bw = (W - pl) / ss.length;
  const y = (v) => pt + (H - pt - pb) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max];
  let g = ticks.map((t) => `<line class="grid" x1="${pl}" x2="${W}" y1="${y(t)}" y2="${y(t)}"/><text x="${pl - 6}" y="${y(t) + 3}" text-anchor="end">${t}</text>`).join('');
  ss.forEach((s, i) => {
    const vals = Object.values(s.attendance || {});
    const p = vals.filter((v) => v === 'P').length, l = vals.filter((v) => v === 'L').length;
    const x = pl + i * bw + bw * 0.18, w = bw * 0.64;
    g += `<a href="#/session/${s.id}"><title>${fmtShort(s.date)}: ${p} present, ${l} late</title><rect x="${x}" y="${y(p + l)}" width="${w}" height="${y(p) - y(p + l)}" fill="#e1b524" rx="2"/><rect x="${x}" y="${y(p)}" width="${w}" height="${y(0) - y(p)}" fill="${i === ss.length - 1 ? 'var(--gold)' : '#17924f'}" rx="2"/></a>`;
    if (ss.length <= 8 || i % 2 === ss.length % 2 || i === ss.length - 1) g += `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${fmtDM(s.date)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Players present per session">${g}</svg>`;
}

// ============ SQUAD ============
VIEWS.players = () => {
  const actions = `<button class="btn" type="button" data-action="export-csv">${icon('download')} CSV</button><button class="btn btn-primary" type="button" data-action="new-player">${icon('plus')} Player</button>`;
  const lineChips = [['all', 'All'], ...LINES.map(([k, l]) => [k, l])].map(([k, l]) => `<button type="button" class="chip ${ui.line === k ? 'on' : ''}" data-action="filter-line" data-v="${k}">${l}</button>`).join('');
  return `${pageHead('Squad', '', actions)}
  <div class="card">
    <div class="toolbar">
      <label class="search">${icon('search')}<input id="squadSearch" type="search" placeholder="Search" value="${esc(ui.search)}" aria-label="Search squad"></label>
      <div class="chips">${lineChips}</div>
      <select class="sel" id="statusFilter" aria-label="Status"><option value="all">Status</option>${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}" ${ui.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div id="squadList">${squadList()}</div>
  </div>`;
};
function squadList() {
  const q = ui.search.trim().toLowerCase();
  let ps = db().players.slice().sort(byJersey);
  if (ui.status === 'all') ps = ps.filter((p) => p.status !== 'left'); else ps = ps.filter((p) => p.status === ui.status);
  if (ui.line !== 'all') ps = ps.filter((p) => LINE[p.position] === ui.line);
  if (q) ps = ps.filter((p) => [p.first, p.last, p.jersey, p.position, p.position2, POS_NAME[p.position], p.address, p.phone].join(' ').toLowerCase().includes(q));
  if (!db().players.length) return empty('No players', '', `<button class="btn btn-primary" type="button" data-action="new-player">${icon('plus')} Add player</button>`);
  if (!ps.length) return empty('No players found', '');
  const head = `<div class="prow prow-head"><span></span><span></span><span>Player</span><span class="c hide-sm">Age</span><span class="c hide-md">Apps</span><span class="c hide-sm">Goals</span><span class="c hide-md hide-sm">Assists</span><span class="c">Train</span><span class="c hide-sm">Avg</span><span class="c">Status</span></div>`;
  return head + LINES.map(([k, label]) => {
    const g = ps.filter((p) => LINE[p.position] === k);
    if (!g.length) return '';
    return `<div class="group-h"><span>${label}</span><span>${g.length}</span></div>` + g.map((p) => {
      const s = playerStats(p.id), a = attendance(p.id);
      return `<a class="prow" href="#/player/${p.id}">${kit(p)}${avatar(p)}<span class="who"><b>${esc(fullName(p))}</b><small>${esc(p.position)}${p.position2 ? '/' + esc(p.position2) : ''} · ${esc(p.foot || '–')}</small></span>
        <span class="c hide-sm">${age(p.dob) ?? '–'}</span><span class="c hide-md">${s.apps}</span><span class="c hide-sm">${s.goals}</span><span class="c hide-md hide-sm">${s.assists}</span>
        <span class="c">${a.rate == null ? '–' : a.rate + '%'}</span><span class="c hide-sm">${rating(s.avg)}</span><span class="c">${statusPill(p.status)}</span></a>`;
    }).join('');
  }).join('');
}

// ============ PLAYER PROFILE ============
VIEWS.player = (id) => {
  const p = player(id);
  if (!p) return `${pageHead('Player not found', '', '', backLink('#/players', 'Squad'))}`;
  const s = playerStats(p.id), a = attendance(p.id), ov = overall(p.id);
  const comments = db().comments.filter((c) => c.pid === p.id).sort((x, y) => y.date.localeCompare(x.date));
  const hero = `${backLink('#/players', 'Squad')}
  <section class="hero">
    <span class="bignum" aria-hidden="true">${esc(p.jersey ?? '')}</span>
    ${avatar(p, 'lg')}
    <div style="min-width:0;position:relative;z-index:1">
      <h1>${esc(p.first)}<br>${esc(p.last)}</h1>
      <div class="meta"><span>#<b>${esc(p.jersey ?? '–')}</b></span><span><b>${esc(POS_NAME[p.position] || p.position)}</b>${p.position2 ? ' / ' + esc(POS_NAME[p.position2]) : ''}</span><span>Age <b>${age(p.dob) ?? '–'}</b></span><span><b>${esc(p.foot || '–')}</b> foot</span>${statusPill(p.status)}</div>
      <div class="acts">
        <button class="btn btn-primary btn-sm" type="button" data-action="add-comment" data-pid="${p.id}">${icon('comment')} Comment</button>
        <button class="btn btn-sm" type="button" data-action="assess" data-pid="${p.id}">${icon('chart')} Rate</button>
        <button class="btn btn-sm" type="button" data-action="new-injury" data-pid="${p.id}">${icon('health')} Injury</button>
        <button class="btn btn-sm" type="button" data-action="edit-player" data-pid="${p.id}">${icon('edit')} Edit</button>
      </div>
    </div>
    <div class="ring" style="--v:${ov ? ov * 10 : 0}"><div><span><b>${ov ? f1(ov) : '–'}</b><small>Overall</small></span></div></div>
  </section>`;
  const t = ui.playerTab;
  const tabBar = tabs('player', [['overview', 'Profile'], ['performance', 'Games'], ['skills', 'Skills'], ['training', 'Training'], ['comments', 'Comments', comments.length || null]], t);
  let body = '';
  if (t === 'overview') body = playerOverview(p);
  if (t === 'performance') body = playerPerformance(p, s);
  if (t === 'skills') body = playerSkills(p);
  if (t === 'training') body = playerTraining(p, a);
  if (t === 'comments') body = `<div class="card"><div class="card-h"><h2>Comments</h2><button class="btn btn-sm" type="button" data-action="add-comment" data-pid="${p.id}">${icon('plus')} Add</button></div>${commentList(comments)}</div>`;
  return `${hero}<div class="card" style="box-shadow:none;border:0;background:none">${tabBar}</div>${body}`;
};

function playerOverview(p) {
  const show = ui.revealNin[p.id];
  const inj = db().injuries.filter((i) => i.pid === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const dl = (rows) => `<dl class="dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v || '<span style="color:var(--faint)">—</span>'}</dd>`).join('')}</dl>`;
  return `<div class="grid-2"><div class="stack">
    <div class="card"><div class="card-h"><h2>Personal</h2></div>${dl([
      ['Date of birth', p.dob ? `${fmtDate(p.dob)} (${age(p.dob)})` : ''], ['Gender', esc(p.gender)], ['Phone', esc(p.phone)], ['Email', esc(p.email)], ['Area', esc(p.address)],
      ['NIN', p.nin ? `<span class="mask">${esc(show ? p.nin : maskNin(p.nin))}</span><button type="button" class="reveal" data-action="reveal-nin" data-pid="${p.id}">${show ? 'Hide' : 'Show'}</button>` : ''],
    ])}</div>
    <div class="card"><div class="card-h"><h2>Football</h2></div>${dl([
      ['Position', esc(POS_NAME[p.position] || p.position)], ['Also plays', esc(POS_NAME[p.position2] || '')], ['Strong foot', esc(p.foot)], ['Number', esc(p.jersey ?? '')],
      ['Height', p.height ? esc(p.height) + ' cm' : ''], ['Weight', p.weight ? esc(p.weight) + ' kg' : ''], ['Joined', p.joined ? fmtDate(p.joined) : ''], ['Status', statusPill(p.status)],
    ])}</div>
  </div><div class="stack">
    <div class="card"><div class="card-h"><h2>Next of kin</h2></div>${dl([['Name', esc(p.nokName)], ['Relationship', esc(p.nokRel)], ['Phone', esc(p.nokPhone)]])}</div>
    <div class="card"><div class="card-h"><h2>Health</h2><button class="btn btn-sm" type="button" data-action="new-injury" data-pid="${p.id}">${icon('plus')} Injury</button></div>${dl([['Blood group', esc(p.blood)], ['Medical', esc(p.medical)]])}
      ${inj.length ? `<div class="group-h">Injuries</div>${inj.map(injuryRow).join('')}` : ''}</div>
    ${p.notes ? `<div class="card"><div class="card-h"><h2>Notes</h2></div><div class="card-b">${esc(p.notes)}</div></div>` : ''}
    <div><button class="btn btn-danger btn-sm" type="button" data-action="delete-player" data-pid="${p.id}">${icon('trash')} Delete</button></div>
  </div></div>`;
}

function playerPerformance(p, s) {
  const tiles = [['Played', s.apps], ['W', s.W], ['D', s.D], ['L', s.L], ['Goals', s.goals], ['Assists', s.assists], ['Mins', s.min], ['Cards', s.yc + s.rc], ['POTM', s.motm]];
  const spark = s.log.length >= 2 ? ratingSpark(s.log.slice().reverse()) : '';
  return `<div class="card"><div class="card-h"><h2>Season ${esc(db().club.season)}</h2><span class="sub">Avg ${rating(s.avg)}</span></div>
    <div class="tiles">${tiles.map(([k, v]) => `<div><div class="v">${v}</div><div class="k">${k}</div></div>`).join('')}</div>
    ${spark ? `<div class="card-b">${spark}</div>` : ''}</div>
  <div class="card"><div class="card-h"><h2>Games</h2></div>${s.log.length ? `<div class="scroll-x"><table class="t"><thead><tr><th>Date</th><th>Game</th><th class="c">Result</th><th class="c">Min</th><th class="c">G</th><th class="c">A</th><th class="c">Cards</th><th class="r">Rtg</th></tr></thead><tbody>
    ${s.log.map(({ m, st, started, min }) => `<tr><td>${fmtDate(m.date, { day: 'numeric', month: 'short' })}</td><td><a href="#/match/${m.id}"><b>${esc(gameTitle(m))}</b></a> <small style="color:var(--faint)">${isSplit(m) ? (teamOf(m, p.id) ? TEAM_NAME[teamOf(m, p.id)] : '') : m.venue === 'H' ? 'H' : 'A'}</small></td><td class="c">${playerResult(m, p.id) ? `<span class="fm ${playerResult(m, p.id)}">${playerResult(m, p.id)}</span> ` : ''}${m.ourScore}-${m.theirScore}</td><td class="c">${min}${started ? '' : '<small style="color:var(--faint)">*</small>'}</td><td class="c">${st.goals || ''}</td><td class="c">${st.assists || ''}</td><td class="c">${st.yc ? '<span class="card-y" style="display:inline-block;width:8px;height:11px"></span>' : ''}${st.rc ? ' <span class="card-r" style="display:inline-block;width:8px;height:11px"></span>' : ''}</td><td class="r">${m.motm === p.id ? icon('star') + ' ' : ''}${rating(st.rating ? +st.rating : null)}</td></tr>`).join('')}
  </tbody></table></div>` : empty('No games', '')}</div>`;
}

function ratingSpark(log) {
  const W = 560, H = 120, pl = 24, pb = 18, pt = 10;
  const pts = log.filter((x) => x.st.rating).map((x) => ({ r: +x.st.rating, m: x.m }));
  if (pts.length < 2) return '';
  const x = (i) => pl + (i * (W - pl - 10)) / (pts.length - 1);
  const y = (r) => pt + (H - pt - pb) * (1 - (r - 3) / 7);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.r).toFixed(1)}`).join('');
  const area = `${line}L${x(pts.length - 1)},${y(3)}L${x(0)},${y(3)}Z`;
  let g = [4, 6, 8, 10].map((t) => `<line class="grid" x1="${pl}" x2="${W}" y1="${y(t)}" y2="${y(t)}"/><text x="${pl - 6}" y="${y(t) + 3}" text-anchor="end">${t}</text>`).join('');
  g += `<path d="${area}" fill="rgba(245,184,65,.16)"/><path d="${line}" fill="none" stroke="var(--gold)" stroke-width="2.2"/>`;
  pts.forEach((p, i) => { g += `<circle cx="${x(i)}" cy="${y(p.r)}" r="${i === pts.length - 1 ? 4.5 : 3}" fill="${i === pts.length - 1 ? 'var(--gold)' : 'var(--surface)'}" stroke="var(--gold)" stroke-width="2"><title>${esc(gameTitle(p.m))}: ${f1(p.r)}</title></circle>`; });
  g += `<text x="${x(0)}" y="${H - 3}" text-anchor="start">${fmtDM(pts[0].m.date)}</text><text x="${x(pts.length - 1)}" y="${H - 3}" text-anchor="end">${fmtDM(pts[pts.length - 1].m.date)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Match rating trend">${g}</svg>`;
}

function radar(cur, prev) {
  const S = 310, c = S / 2, R = 92, n = SKILLS.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [c + Math.cos(a) * R * (v / 10), c + Math.sin(a) * R * (v / 10)]; };
  const poly = (s) => SKILLS.map(([k], i) => pt(i, +s[k] || 0).map((v) => v.toFixed(1)).join(',')).join(' ');
  let g = [2.5, 5, 7.5, 10].map((v) => `<polygon class="web" points="${SKILLS.map((_, i) => pt(i, v).join(',')).join(' ')}"/>`).join('');
  g += SKILLS.map((_, i) => { const [x, y] = pt(i, 10); return `<line class="web" x1="${c}" y1="${c}" x2="${x}" y2="${y}"/>`; }).join('');
  if (prev) g += `<polygon class="prev" points="${poly(prev)}"/>`;
  g += `<polygon class="area" points="${poly(cur)}"/>`;
  g += SKILLS.map(([k, l], i) => { const [x, y] = pt(i, 12.4); return `<text x="${x}" y="${y + 3}" text-anchor="middle">${l} ${cur[k]}</text>`; }).join('');
  return `<svg class="radar chart" viewBox="0 0 ${S} ${S}" style="max-width:340px;margin:0 auto" role="img" aria-label="Skill profile">${g}</svg>`;
}

function playerSkills(p) {
  const list = skillsOf(p.id);
  const add = `<button class="btn btn-sm" type="button" data-action="assess" data-pid="${p.id}">${icon('plus')} Rate</button>`;
  if (!list.length) return `<div class="card"><div class="card-h"><h2>Skills</h2>${add}</div>${empty('Not rated', 'Rate skills out of 10.')}</div>`;
  const [cur, prev] = list;
  const bars = SKILLS.map(([k, l]) => { const d = prev ? (+cur[k] || 0) - (+prev[k] || 0) : 0; return `<div class="sb"><span>${l}</span><span class="track"><i style="width:${(+cur[k] || 0) * 10}%"></i></span><span><b>${cur[k]}</b> ${d ? `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>` : ''}</span></div>`; }).join('');
  return `<div class="grid-2"><div class="card"><div class="card-h"><h2>Skills</h2><span class="sub">${fmtDate(cur.date)}${prev ? ` · dashed: ${fmtDate(prev.date, { day: 'numeric', month: 'short' })}` : ''}</span></div><div class="card-b">${radar(cur, prev)}${cur.note ? `<p class="hint" style="text-align:center">${esc(cur.note)}</p>` : ''}</div></div>
  <div class="stack"><div class="card"><div class="card-h"><h2>Ratings</h2>${add}</div><div class="card-b skillbars">${bars}</div></div>
  <div class="card"><div class="card-h"><h2>History</h2></div><div class="scroll-x"><table class="t"><thead><tr><th>Date</th>${SKILLS.map(([, l]) => `<th class="c" title="${l}">${l.slice(0, 3)}</th>`).join('')}<th class="r">Avg</th><th></th></tr></thead><tbody>
  ${list.map((s) => `<tr><td>${fmtDate(s.date, { day: 'numeric', month: 'short', year: '2-digit' })}</td>${SKILLS.map(([k]) => `<td class="c">${s[k]}</td>`).join('')}<td class="r"><b>${f1(skillAvg(s))}</b></td><td class="r"><button class="icon-btn" type="button" aria-label="Delete rating" data-action="delete-skill" data-id="${s.id}">${icon('trash')}</button></td></tr>`).join('')}
  </tbody></table></div></div></div></div>`;
}

function playerTraining(p, a) {
  const ss = pastSessions().slice().reverse();
  const strip = ss.map((s) => { const v = s.attendance?.[p.id]; return `<a href="#/session/${s.id}" title="${fmtShort(s.date)}: ${v ? ATT[v] : 'Not recorded'}"><i class="a-${v || 'none'}">${v || ''}</i></a>`; }).join('');
  const counts = { P: 0, L: 0, E: 0, A: 0 };
  ss.forEach((s) => { const v = s.attendance?.[p.id]; if (v) counts[v]++; });
  const l4 = attendance(p.id, 8);
  return `<div class="card"><div class="card-h"><h2>Training</h2><span class="sub">${a.rate == null ? '–' : `${a.rate}% · last 8: ${l4.rate}%`}</span></div>
    <div class="card-b" style="display:flex;flex-direction:column;gap:12px"><div class="counts">${Object.entries(counts).map(([k, v]) => `<span><span class="dot a-${k}"></span>${ATT[k]} <b>${v}</b></span>`).join('')}${missedStreak(p.id) >= 2 ? `<span class="pill warn">Missed last ${missedStreak(p.id)}</span>` : ''}</div>
    <div class="att-strip">${strip || '<span class="hint">No sessions</span>'}</div></div></div>`;
}

function commentList(cs) {
  if (!cs.length) return empty('No comments', '');
  return `<div class="timeline">${cs.map((c) => {
    const p = player(c.pid); const s = c.sessionId && db().sessions.find((x) => x.id === c.sessionId); const m = c.matchId && db().matches.find((x) => x.id === c.matchId);
    return `<div class="tl"><div class="top"><span class="tag ${esc(c.tag)}">${esc(c.tag)}</span><span>${fmtDate(c.date)}</span>${s ? `<a href="#/session/${s.id}">· ${esc(s.focus || 'Training')}</a>` : ''}${m ? `<a href="#/match/${m.id}">· ${esc(gameTitle(m))}</a>` : ''}${p && !location.hash.includes(p.id) ? `<a href="#/player/${p.id}"><b>· ${esc(fullName(p))}</b></a>` : ''}<span class="grow"></span><button class="icon-btn" type="button" aria-label="Delete comment" data-action="delete-comment" data-id="${c.id}">${icon('trash')}</button></div><p>${esc(c.text)}</p></div>`;
  }).join('')}</div>`;
}

function injuryRow(i) {
  const p = player(i.pid);
  const back = i.expectedReturn ? daysBetween(today(), i.expectedReturn) : null;
  return `<div class="srow"><span class="mrow-time">${fmtDM(i.date)}<small>${esc(i.severity || '')}</small></span><span style="min-width:0">${location.hash.startsWith('#/player/') ? '' : `<a href="#/player/${i.pid}"><b>${esc(fullName(p))}</b></a>`}<b>${esc(i.type)}</b><small>${i.resolved ? `Fit ${fmtDate(i.resolvedDate, { day: 'numeric', month: 'short' })}` : back != null ? (back > 0 ? `Back ${fmtDate(i.expectedReturn, { day: 'numeric', month: 'short' })} · ${back}d` : 'Due back') : 'Return unknown'}${i.notes ? ' · ' + esc(i.notes) : ''}</small></span>
    <span style="display:flex;gap:4px">${i.resolved ? '<span class="pill good">Fit</span>' : `<button class="btn btn-sm" type="button" data-action="recover" data-id="${i.id}">${icon('check')} Fit</button>`}<button class="icon-btn" type="button" aria-label="Edit injury" data-action="edit-injury" data-id="${i.id}">${icon('edit')}</button></span></div>`;
}

// ============ TRAINING ============
VIEWS.training = () => {
  const up = upcomingSessions(), past = pastSessions();
  const row = (s) => {
    const v = Object.values(s.attendance || {});
    const pres = v.filter((x) => x === 'P' || x === 'L').length;
    const cc = db().comments.filter((c) => c.sessionId === s.id).length;
    const pct = v.length ? (pres / v.length) * 100 : 0;
    return `<a class="srow" href="#/session/${s.id}"><span class="mrow-time">${fmtDM(s.date)}<small>${esc(s.time || '')}</small></span><span style="min-width:0"><b>${esc(s.focus || 'Training')}</b><small>${fmtShort(s.date)}${s.venue ? ' · ' + esc(s.venue) : ''}${cc ? ` · ${plural(cc, 'comment')}` : ''}</small></span>
      <span style="display:flex;align-items:center;gap:10px">${v.length ? `<span class="meter" title="${pres} of ${v.length}"><i style="width:${pct}%"></i></span><b class="num">${pres}/${v.length}</b>` : s.date > today() ? '<span class="pill info">Next</span>' : '<span class="pill warn">No register</span>'}</span></a>`;
  };
  return `${pageHead('Training', `${plural(past.length, 'session')}`, `<button class="btn btn-primary" type="button" data-action="new-session">${icon('plus')} New session</button>`)}
  ${up.length ? `<div class="card"><div class="card-h"><h2>Next</h2></div><div class="list">${up.map(row).join('')}</div></div>` : ''}
  <div class="card"><div class="card-h"><h2>Past</h2></div><div class="list">${past.length ? past.map(row).join('') : empty('No sessions', '', `<button class="btn btn-primary" type="button" data-action="new-session">${icon('plus')} New session</button>`)}</div></div>`;
};

VIEWS.session = (id) => {
  const s = db().sessions.find((x) => x.id === id);
  if (!s) return `${pageHead('Session not found', '', '', backLink('#/training', 'Training'))}`;
  s.attendance = s.attendance || {};
  const ps = squad();
  const cnt = { P: 0, L: 0, E: 0, A: 0 };
  ps.forEach((p) => { const v = s.attendance[p.id]; if (v) cnt[v]++; });
  const unmarked = ps.length - cnt.P - cnt.L - cnt.E - cnt.A;
  const comments = db().comments.filter((c) => c.sessionId === s.id);
  const regRows = ps.map((p) => {
    const v = s.attendance[p.id];
    const cs = comments.filter((c) => c.pid === p.id);
    return `<div class="reg ${p.status === 'injured' && !v ? 'dim' : ''}">${kit(p)}<span class="who"><b>${esc(fullName(p))}</b><small>${esc(p.position)}${p.status !== 'active' ? ' · ' + STATUS[p.status][0] : ''}</small></span>
      <span class="seg" role="group" aria-label="Attendance for ${esc(fullName(p))}">${Object.keys(ATT).map((k) => `<button type="button" class="${k} ${v === k ? 'on' : ''}" title="${ATT[k]}" aria-pressed="${v === k}" data-action="att" data-sid="${s.id}" data-pid="${p.id}" data-v="${k}">${k}</button>`).join('')}</span>
      <button class="icon-btn" type="button" aria-label="Comment on ${esc(fullName(p))}" data-action="add-comment" data-pid="${p.id}" data-sid="${s.id}">${icon('comment')}</button>
      ${cs.length ? `<div class="notes">${cs.map((c) => `<div><span class="tag ${esc(c.tag)}">${esc(c.tag)}</span> ${esc(c.text)}</div>`).join('')}</div>` : ''}</div>`;
  }).join('');

  const teamsHtml = s.teams && s.teams.length ? `<div class="teams">${s.teams.map((t, i) => {
    const tp = t.map(player).filter(Boolean);
    const tot = avg(tp.map((p) => overall(p.id) || 5));
    return `<div class="team bib-${i % 4}"><div class="team-h">${BIBS[i % 4]}<small>${tp.length} · avg ${f1(tot)}</small></div><ul>${tp.sort((a, b) => LINE_RANK[LINE[a.position]] - LINE_RANK[LINE[b.position]]).map((p) => `<li><span class="p">${esc(p.position)}</span><span class="n">${esc(fullName(p))}</span>${rating(overall(p.id))}</li>`).join('')}</ul></div>`;
  }).join('')}</div>` : `<div class="card-b hint">Balanced by skill. Keepers spread.</div>`;

  return `${pageHead(s.focus || 'Training', `${fmtShort(s.date)} · ${s.time || ''}${s.venue ? ' · ' + s.venue : ''}`,
    `<button class="btn" type="button" data-action="edit-session" data-id="${s.id}">${icon('edit')} Edit</button><button class="btn btn-danger" type="button" data-action="delete-session" data-id="${s.id}">${icon('trash')}</button>`, backLink('#/training', 'Training'))}
  ${s.notes ? `<div class="card"><div class="card-b">${esc(s.notes)}</div></div>` : ''}
  <div class="grid-2"><div class="card"><div class="card-h"><h2>Register</h2><button class="btn btn-sm" type="button" data-action="all-present" data-sid="${s.id}">${icon('check')} Rest present</button></div>
    <div class="card-b" style="border-bottom:1px solid var(--line)"><div class="counts">${Object.entries(ATT).map(([k, l]) => `<span><span class="dot a-${k}"></span>${l} <b>${cnt[k]}</b></span>`).join('')}<span>Unmarked <b>${unmarked}</b></span></div></div>
    <div class="list">${ps.length ? regRows : empty('No players', '')}</div></div>
  <div class="stack"><div class="card"><div class="card-h"><h2>Teams</h2><span style="display:flex;gap:6px"><select class="sel" id="teamCount" aria-label="Number of teams">${[2, 3, 4].map((n) => `<option value="${n}" ${(s.teams?.length || 2) === n ? 'selected' : ''}>${n} teams</option>`).join('')}</select><button class="btn btn-primary btn-sm" type="button" data-action="split" data-sid="${s.id}">${icon('shuffle')} ${s.teams ? 'Reshuffle' : 'Split'}</button></span></div>${teamsHtml}</div>
  <div class="card"><div class="card-h"><h2>Comments</h2></div>${commentList(comments.slice().sort((a, b) => fullName(player(a.pid)).localeCompare(fullName(player(b.pid)))))}</div></div></div>`;
};

function splitTeams(pids, n) {
  const ps = pids.map((id) => ({ id, r: (overall(id) || 5) + (Math.random() - 0.5) * 0.9, gk: player(id)?.position === 'GK' }));
  const T = Array.from({ length: n }, () => ({ ids: [], tot: 0 }));
  const assign = (list) => list.sort((a, b) => b.r - a.r).forEach((p) => {
    const t = T.slice().sort((a, b) => a.ids.length - b.ids.length || a.tot - b.tot)[0];
    t.ids.push(p.id); t.tot += p.r;
  });
  assign(ps.filter((p) => p.gk));
  assign(ps.filter((p) => !p.gk));
  return T.map((t) => t.ids);
}

// ============ MATCHES ============
VIEWS.matches = () => {
  const fx = openMatches(), rs = playedMatches();
  const t = ui.matchesTab;
  const list = t === 'fixtures' ? fx : rs;
  return `${pageHead('Games', '', `<button class="btn btn-primary" type="button" data-action="new-match">${icon('plus')} New game</button>`)}
  <div class="card">${tabs('matches', [['fixtures', 'Fixtures', fx.length], ['results', 'Results', rs.length]], t)}
    <div class="list">${list.length ? list.map(matchRow).join('') : t === 'fixtures' ? empty('No fixtures', '', `<button class="btn btn-primary" type="button" data-action="new-match">${icon('plus')} New game</button>`) : empty('No results', '')}</div></div>`;
};

VIEWS.match = (id) => {
  const m = db().matches.find((x) => x.id === id);
  if (!m) return `${pageHead('Game not found', '', '', backLink('#/matches', 'Games'))}`;
  m.availability = m.availability || {}; m.stats = m.stats || {}; m.bench = m.bench || [];
  if (syncLineup(m)) Store.save();
  const played = m.status === 'played';
  const split = isSplit(m);
  const [h, a] = teams(m);
  const d = daysBetween(today(), m.date);
  const k = sideSize(m), yes = confirmed(m).length;
  const board = `<section class="board"><div class="board-meta">${metaBits(m, played ? 'FT' : d < 0 ? 'Result due' : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`)}</div>
    <div class="board-teams"><div class="bt">${h.crest}<span>${esc(h.name)}</span></div>
    <div class="bt-mid">${played ? `<div class="score-big">${h.score}<span>-</span>${a.score}</div><small>FT</small>` : `<div class="score-big" style="color:var(--board-muted)">VS</div><small>${esc(m.time)} · ${yes} in</small>`}</div>
    <div class="bt">${a.crest}<span>${esc(a.name)}</span></div></div>
    ${played && m.motm ? `<div class="board-meta" style="justify-content:center"><span class="live">${icon('star')} Player of the match</span><span style="color:var(--board-fg)">${esc(fullName(player(m.motm)))}</span></div>` : ''}</section>`;
  const t = ui.matchTab || 'lineup';
  const tabBar = tabs('match', [['lineup', 'Lineups'], ['result', 'Stats'], ['availability', 'Availability', yes]], t);
  let body = '';
  if (t === 'lineup') body = matchLineup(m);
  if (t === 'result') body = matchResult(m);
  if (t === 'availability') body = matchAvailability(m);
  return `${pageHead(gameTitle(m), '', `<button class="btn" type="button" data-action="edit-match" data-id="${m.id}">${icon('edit')} Edit</button><button class="btn btn-danger" type="button" data-action="delete-match" data-id="${m.id}" aria-label="Delete game">${icon('trash')}</button>`, backLink('#/matches', 'Games'))}
  ${board}<div class="card" style="box-shadow:none;border:0;background:none">${tabBar}</div>${body}`;
};

function headcountNote(m) {
  const k = sideSize(m), yes = confirmed(m).length, need = isSplit(m) ? 2 * k : k;
  const spare = yes - need;
  return `${yes} in · ${k}v${k}${spare > 0 ? ` · ${spare} sub${spare > 1 ? 's' : ''}` : spare < 0 ? ` · ${-spare} short` : ''}`;
}

function matchAvailability(m) {
  const ps = squad();
  const n = { yes: 0, maybe: 0, no: 0, none: 0 };
  ps.forEach((p) => { n[m.availability[p.id] || 'none']++; });
  return `<div class="card"><div class="card-h"><h2>Availability</h2><span class="sub">${esc(headcountNote(m))}</span></div>
  <div class="card-b" style="border-bottom:1px solid var(--line);display:flex;gap:10px;flex-wrap:wrap;align-items:center"><div class="counts"><span><span class="dot a-P"></span>In <b>${n.yes}</b></span><span><span class="dot a-L"></span>Maybe <b>${n.maybe}</b></span><span><span class="dot a-A"></span>Out <b>${n.no}</b></span><span>No reply <b>${n.none}</b></span></div><span class="grow"></span><button class="btn btn-sm" type="button" data-action="all-coming" data-mid="${m.id}">${icon('check')} Rest in</button></div>
  <div class="list">${ps.map((p) => { const v = m.availability[p.id]; return `<div class="reg ${!fit(p) ? 'dim' : ''}">${kit(p)}<span class="who"><b>${esc(fullName(p))}</b><small>${esc(p.position)}${!fit(p) ? ` · <span style="color:var(--bad)">${STATUS[p.status][0]}</span>` : ''} · ${attendance(p.id, 8).rate ?? '–'}%</small></span>
    <span class="seg" role="group" aria-label="Availability for ${esc(fullName(p))}">${Object.keys(AVAIL).map((k) => `<button type="button" class="${k} ${v === k ? 'on' : ''}" aria-pressed="${v === k}" data-action="avail" data-mid="${m.id}" data-pid="${p.id}" data-v="${k}">${k === 'yes' ? 'In' : k === 'maybe' ? 'Maybe' : 'Out'}</button>`).join('')}</span><span></span></div>`; }).join('')}</div></div>`;
}

function eligible(m) {
  return squad().filter((p) => fit(p) && m.availability[p.id] !== 'no');
}

const PITCH_LINES = `<svg class="pitch-lines" viewBox="0 0 68 105" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width=".35"><rect x="1.5" y="1.5" width="65" height="102"/><line x1="1.5" y1="52.5" x2="66.5" y2="52.5"/><circle cx="34" cy="52.5" r="9.15"/><circle cx="34" cy="52.5" r=".5" fill="currentColor"/><rect x="13.84" y="1.5" width="40.32" height="16.5"/><rect x="24.84" y="1.5" width="18.32" height="5.5"/><path d="M26.7 18A9.15 9.15 0 0 0 41.3 18"/><rect x="13.84" y="87" width="40.32" height="16.5"/><rect x="24.84" y="98" width="18.32" height="5.5"/><path d="M26.7 87A9.15 9.15 0 0 1 41.3 87"/></g></svg>`;

function matchLineup(m) {
  const split = isSplit(m), played = m.status === 'played';
  const k = sideSize(m);
  const teamKeys = split ? ['A', 'B'] : ['A'];
  const sel = ui.sel && ui.sel.mid === m.id ? ui.sel : null;
  const events = (pid) => { const st = m.stats[pid]; if (!played || !st) return ''; let e = ''; for (let i = 0; i < (+st.goals || 0); i++) e += '<span class="goal" title="Goal">G</span>'; if (+st.yc) e += '<span class="card-y" title="Yellow card"></span>'; if (+st.rc) e += '<span class="card-r" title="Red card"></span>'; return e ? `<span class="ev">${e}</span>` : ''; };
  const placed = new Set(m.bench);
  const slotHtml = teamKeys.map((team) => {
    const slots = slotsFor(m, team);
    const L = lineupOf(m, team);
    L.forEach((pid) => pid && placed.add(pid));
    return slots.map(([role, x, y], i) => {
      const p = player(L[i]);
      const isSel = sel && sel.from === 'slot' && sel.team === team && sel.i === i;
      const st = p && m.stats[p.id];
      return `<button type="button" class="slot ${split ? 'team-' + team : ''} ${p ? 'filled' : ''} ${isSel ? 'sel' : ''} ${sel && !p ? 'target' : ''}" style="left:${x}%;top:${y}%" data-action="slot" data-team="${team}" data-i="${i}" data-drop="slot:${team}:${i}" ${p ? `draggable="true" data-drag="${p.id}"` : ''} aria-label="${split ? TEAM_NAME[team] + ' ' : ''}${role}${p ? ': ' + esc(fullName(p)) : ' (empty)'}">
        ${p ? `<span class="slot-dot">${p.photo ? `<img src="${p.photo}" alt="">` : esc(p.jersey ?? initials(p))}${played && st?.rating ? rating(+st.rating) : ''}${events(p.id)}</span><span class="slot-name">${esc(p.last)}</span>` : `<span class="slot-dot empty">${role}</span><span class="slot-name">&nbsp;</span>`}
      </button>`;
    }).join('');
  }).join('');
  const tags = split ? `<span class="pitch-tag tag-B">${TEAM_NAME.B}</span><span class="pitch-tag tag-A">${TEAM_NAME.A}</span>` : '';
  const chip = (p, from, extra = '') => { const isSel = sel && sel.pid === p.id; const ov = overall(p.id); return `<button type="button" class="pchip ${isSel ? 'sel' : ''} ${extra}" data-action="pick" data-pid="${p.id}" data-from="${from}" draggable="true" data-drag="${p.id}">${kit(p)}${esc(shortName(p))} <small>${esc(p.position)}${ov ? ' · ' + f1(ov) : ''}</small></button>`; };
  const benchP = m.bench.map(player).filter(Boolean);
  const pool = squad().filter((p) => !placed.has(p.id));
  const grp = { yes: [], maybe: [], none: [], out: [] };
  pool.forEach((p) => { if (!fit(p) || m.availability[p.id] === 'no') grp.out.push(p); else grp[m.availability[p.id] || 'none'].push(p); });
  const sortPool = (a) => a.sort((x, y) => LINE_RANK[LINE[x.position]] - LINE_RANK[LINE[y.position]] || byJersey(x, y));
  const selP = sel && player(sel.pid);
  const selbar = selP ? `<div class="selbar">${kit(selP)}<span><b>${esc(fullName(selP))}</b> · tap a spot</span><span class="grow"></span>${sel.from === 'slot' ? `<button class="btn btn-sm" type="button" data-action="to-bench">Sub</button>` : ''}${sel.from !== 'pool' ? `<button class="btn btn-sm" type="button" data-action="to-pool">Remove</button>` : ''}<button class="btn btn-sm" type="button" data-action="sel-cancel">Cancel</button></div>` : '';
  const strength = split ? teamKeys.map((t) => { const ids = lineupOf(m, t).filter(Boolean); const r = avg(ids.map((id) => overall(id) || 5)); return `<span class="tstr team-${t}"><i></i>${TEAM_NAME[t]} <b>${ids.length}</b>${r ? ` · avg ${f1(r)}` : ''}</span>`; }).join('') : `<span class="hint">${lineupOf(m, 'A').filter(Boolean).length}/${k}</span>`;
  const shapeSel = (team) => `<select class="sel" id="shape${team}" aria-label="${split ? TEAM_NAME[team] + ' shape' : 'Shape'}">${SHAPES[k].map((s) => `<option value="${s}" ${s === shapeOf(m, team) ? 'selected' : ''}>${split ? TEAM_NAME[team] + ' ' : ''}${shapeLabel(s)}</option>`).join('')}</select>`;
  return `<div class="lineup"><div class="pitch-wrap">
    <div class="card"><div class="toolbar" style="flex-direction:column;align-items:stretch">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select class="sel" id="sideSize" aria-label="Players per side"><option value="" ${!m.sideSize ? 'selected' : ''}>Auto · ${autoSize(m)}v${autoSize(m)}</option>${Array.from({ length: SIDE_MAX - SIDE_MIN + 1 }, (_, i) => i + SIDE_MIN).map((n) => `<option value="${n}" ${+m.sideSize === n ? 'selected' : ''}>${n}v${n}</option>`).join('')}</select>
        ${teamKeys.map(shapeSel).join('')}
        <span class="grow"></span>
        <button class="btn btn-primary btn-sm" type="button" data-action="auto-pick" data-mid="${m.id}">${icon('wand')} ${split ? 'Fair teams' : 'Auto-pick'}</button>
        <button class="btn btn-sm" type="button" data-action="clear-lineup" data-mid="${m.id}">Clear</button>
      </div>
      <div class="counts"><span>${esc(headcountNote(m))}</span><span class="grow"></span>${strength}</div>
    </div></div>
    ${selbar}
    <div class="pitch ${split && k >= 8 ? 'dense' : ''}" data-drop="pitch">${PITCH_LINES}${tags}${slotHtml}</div>
    <div class="bench ${sel && sel.from !== 'bench' ? 'target' : ''}" data-action="bench-drop" data-drop="bench"><h4><span>Subs</span><span>${m.bench.length}</span></h4><div class="chipset">${benchP.length ? benchP.map((p) => chip(p, 'bench')).join('') : '<span class="hint">–</span>'}</div></div>
  </div>
  <div class="card" data-drop="pool"><div class="card-h"><h2>Players</h2><span class="sub">Tap, then place</span></div><div class="pool">
    ${grp.yes.length ? `<div><h4><span>In</span><span>${grp.yes.length}</span></h4><div class="chipset">${sortPool(grp.yes).map((p) => chip(p, 'pool')).join('')}</div></div>` : ''}
    ${grp.maybe.length ? `<div><h4><span>Maybe</span><span>${grp.maybe.length}</span></h4><div class="chipset">${sortPool(grp.maybe).map((p) => chip(p, 'pool', 'maybe')).join('')}</div></div>` : ''}
    ${grp.none.length ? `<div><h4><span>No reply</span><span>${grp.none.length}</span></h4><div class="chipset">${sortPool(grp.none).map((p) => chip(p, 'pool', 'maybe')).join('')}</div></div>` : ''}
    ${grp.out.length ? `<div><h4><span>Out</span><span>${grp.out.length}</span></h4><div class="chipset">${sortPool(grp.out).map((p) => `<button type="button" class="pchip" disabled title="${!fit(p) ? STATUS[p.status][0] : 'Not coming'}">${kit(p)}${esc(shortName(p))} <small>${!fit(p) ? STATUS[p.status][0] : 'Out'}</small></button>`).join('')}</div></div>` : ''}
    ${!pool.length ? '<span class="hint">All placed</span>' : ''}
  </div></div></div>`;
}

function movePlayer(m, pid, to) {
  const lists = { A: lineupOf(m, 'A'), B: isSplit(m) ? lineupOf(m, 'B') : [] };
  m.bench = m.bench || [];
  let from = null;
  for (const t of ['A', 'B']) { const i = lists[t].indexOf(pid); if (i > -1) { lists[t][i] = null; from = { kind: 'slot', team: t, i }; } }
  const bi = m.bench.indexOf(pid);
  if (bi > -1) { m.bench.splice(bi, 1); from = { kind: 'bench', i: bi }; }
  if (to.kind === 'slot') {
    const arr = lists[to.team];
    const q = arr[to.i];
    arr[to.i] = pid;
    if (q && q !== pid && from) { if (from.kind === 'slot') lists[from.team][from.i] = q; else m.bench.splice(from.i, 0, q); }
  } else if (to.kind === 'bench') m.bench.push(pid);
  m.lineup = lists.A;
  if (isSplit(m)) m.lineupB = lists.B;
  Store.save();
}

function assignRoles(slots, players) {
  const used = new Set();
  const L = Array(slots.length).fill(null);
  const order = slots.map((_, i) => i).sort((a, b) => LINE_RANK[LINE[slots[a][0]]] - LINE_RANK[LINE[slots[b][0]]]);
  for (const i of order) {
    const role = slots[i][0];
    let best = null, bs = -Infinity;
    for (const p of players) {
      if (used.has(p.id)) continue;
      let f = p.position === role ? 3 : p.position2 === role ? 2.4 : LINE[p.position] === LINE[role] ? 1.5 : LINE[p.position2] === LINE[role] ? 1 : 0;
      if (role === 'GK' && p.position !== 'GK' && p.position2 !== 'GK') f = -6;
      if (role !== 'GK' && p.position === 'GK') f = -4;
      const sc = f * 3 + (overall(p.id) || 5) * 0.7;
      if (sc > bs) { bs = sc; best = p; }
    }
    if (best) { L[i] = best.id; used.add(best.id); }
  }
  return L;
}

function autoPick(m) {
  const split = isSplit(m);
  const need = split ? 2 * sideSize(m) : sideSize(m);
  const keen = (p) => (m.availability[p.id] === 'yes' ? 100 : m.availability[p.id] === 'maybe' ? 50 : 0) + (attendance(p.id, 8).rate ?? 70) / 25 - missedStreak(p.id) * 0.8 + (overall(p.id) || 5) * 0.3;
  const ranked = eligible(m).sort((a, b) => keen(b) - keen(a));
  const yesCount = ranked.filter((p) => m.availability[p.id] === 'yes').length;
  const playing = ranked.slice(0, need);
  const rest = ranked.slice(need, Math.max(need, yesCount));
  if (split) {
    const [A, B] = splitTeams(playing.map((p) => p.id), 2);
    m.lineup = assignRoles(slotsFor(m, 'A'), A.map(player));
    m.lineupB = assignRoles(slotsFor(m, 'B'), B.map(player));
  } else m.lineup = assignRoles(slotsFor(m, 'A'), playing);
  m.bench = rest.map((p) => p.id);
  Store.save();
}

function matchResult(m) {
  const split = isSplit(m);
  const LA = lineupOf(m, 'A').filter(Boolean), LB = split ? lineupOf(m, 'B').filter(Boolean) : [];
  let ids = [...LA, ...LB, ...m.bench.filter((x) => !LA.includes(x) && !LB.includes(x))];
  Object.keys(m.stats).forEach((pid) => { if (!ids.includes(pid)) ids.push(pid); });
  if (!ids.length) ids = eligible(m).map((p) => p.id);
  const rows = ids.map(player).filter(Boolean);
  const st = (pid) => m.stats[pid] || {};
  const dur = +m.duration || (split ? 60 : 90);
  const num = (name, pid, v, attrs = '') => `<input type="number" inputmode="decimal" name="${name}_${pid}" value="${v ?? ''}" ${attrs} aria-label="${name}">`;
  const [nameA, nameB] = split ? [TEAM_NAME.A, TEAM_NAME.B] : [db().club.name, m.opponent];
  const goalsFor = (t) => rows.filter((p) => (split ? teamOf(m, p.id) === t : t === 'A')).reduce((s, p) => s + (+st(p.id).goals || 0), 0);
  const warn = [];
  if (m.ourScore != null && goalsFor('A') && goalsFor('A') !== +m.ourScore) warn.push(`${nameA}: ${goalsFor('A')} goals vs score ${m.ourScore}`);
  if (split && m.theirScore != null && goalsFor('B') && goalsFor('B') !== +m.theirScore) warn.push(`${nameB}: ${goalsFor('B')} goals vs score ${m.theirScore}`);
  const teamCell = (p) => {
    if (!split) return LA.includes(p.id) ? 'Start' : 'Sub';
    if (LA.includes(p.id)) return `<span class="tstr team-A"><i></i>${TEAM_NAME.A}</span>`;
    if (LB.includes(p.id)) return `<span class="tstr team-B"><i></i>${TEAM_NAME.B}</span>`;
    const cur = (m.teamOfSub || {})[p.id] || '';
    return `<select name="team_${p.id}" aria-label="Which team did ${esc(fullName(p))} play for"><option value="">Both</option><option value="A" ${cur === 'A' ? 'selected' : ''}>${TEAM_NAME.A}</option><option value="B" ${cur === 'B' ? 'selected' : ''}>${TEAM_NAME.B}</option></select>`;
  };
  return `<form class="card" id="resultForm" data-mid="${m.id}">
    <div class="card-h"><h2>Score</h2><span class="sub">${m.status === 'played' ? 'FT' : ''}</span></div>
    <div class="card-b" style="display:flex;gap:16px;align-items:end;flex-wrap:wrap">
      <label class="fld" style="width:140px"><span>${esc(nameA)}</span><input type="number" min="0" name="ourScore" value="${m.ourScore ?? ''}" required></label>
      <label class="fld" style="width:140px"><span>${esc(nameB)}</span><input type="number" min="0" name="theirScore" value="${m.theirScore ?? ''}" required></label>
      <label class="fld" style="min-width:200px;flex:1"><span>Player of the match</span><select name="motm"><option value="">—</option>${rows.map((p) => `<option value="${p.id}" ${m.motm === p.id ? 'selected' : ''}>${esc(fullName(p))}</option>`).join('')}</select></label>
    </div>
    <div class="group-h"><span>Player stats</span><span>${warn.length ? `<span style="color:var(--bad)">${esc(warn.join(' · '))}</span>` : ''}</span></div>
    <div class="scroll-x"><table class="t"><thead><tr><th>Player</th><th>${split ? 'Team' : ''}</th><th class="c">Min</th><th class="c">G</th><th class="c">A</th><th class="c">YC</th><th class="c">RC</th><th class="c">Rtg</th></tr></thead><tbody>
    ${rows.map((p) => { const s = st(p.id); const started = LA.includes(p.id) || LB.includes(p.id); const d = started && s.min == null ? dur : s.min; return `<tr><td>${kit(p)} <b>${esc(fullName(p))}</b></td><td>${teamCell(p)}</td><td class="c">${num('min', p.id, d, 'min="0" max="130"')}</td><td class="c">${num('goals', p.id, s.goals || '', 'min="0"')}</td><td class="c">${num('assists', p.id, s.assists || '', 'min="0"')}</td><td class="c">${num('yc', p.id, s.yc || '', 'min="0" max="2"')}</td><td class="c">${num('rc', p.id, s.rc || '', 'min="0" max="1"')}</td><td class="c">${num('rating', p.id, s.rating || '', 'min="1" max="10" step="0.1"')}</td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="card-b" style="display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--line)">${m.status === 'played' ? `<button class="btn" type="button" data-action="unplay" data-mid="${m.id}">Not played</button>` : ''}<button class="btn btn-primary" type="submit">${icon('check')} Save</button></div>
  </form>
  <div class="card"><div class="card-h"><h2>Comments</h2><button class="btn btn-sm" type="button" data-action="add-comment" data-mid="${m.id}">${icon('plus')} Add</button></div>${commentList(db().comments.filter((c) => c.matchId === m.id))}</div>`;
}

// ============ INJURIES & DISCIPLINE ============
VIEWS.health = () => {
  const act = activeInjuries();
  const past = db().injuries.filter((i) => i.resolved).sort((a, b) => b.date.localeCompare(a.date));
  const cards = squad().map((p) => ({ p, s: playerStats(p.id) })).filter((r) => r.s.yc || r.s.rc).sort((a, b) => b.s.rc - a.s.rc || b.s.yc - a.s.yc);
  const susp = squad().filter((p) => p.status === 'suspended');
  const conds = squad().filter((p) => p.medical);
  return `${pageHead('Injuries', '', `<button class="btn btn-primary" type="button" data-action="new-injury">${icon('plus')} Injury</button>`)}
  <div class="grid-2"><div class="stack">
    <div class="card"><div class="card-h"><h2>Out injured</h2><span class="sub">${act.length || ''}</span></div><div class="list">${act.length ? act.map(injuryRow).join('') : empty('All fit', '')}</div></div>
    <div class="card"><div class="card-h"><h2>History</h2></div><div class="list">${past.length ? past.map(injuryRow).join('') : empty('None', '')}</div></div>
  </div><div class="stack">
    <div class="card"><div class="card-h"><h2>Suspended</h2></div><div class="list">${susp.length ? susp.map((p) => `<a class="srow" href="#/player/${p.id}">${kit(p)}<span><b>${esc(fullName(p))}</b><small>${esc(p.position)}</small></span>${statusPill(p.status)}</a>`).join('') : empty('None', '')}</div></div>
    <div class="card"><div class="card-h"><h2>Cards</h2></div>${cards.length ? `<table class="t"><thead><tr><th>Player</th><th class="c"><span class="card-y" style="display:inline-block;width:9px;height:12px" title="Yellow"></span></th><th class="c"><span class="card-r" style="display:inline-block;width:9px;height:12px" title="Red"></span></th></tr></thead><tbody>${cards.map(({ p, s }) => `<tr><td><a href="#/player/${p.id}"><b>${esc(fullName(p))}</b></a></td><td class="c">${s.yc}</td><td class="c">${s.rc}</td></tr>`).join('')}</tbody></table>` : empty('None', '')}</div>
    <div class="card"><div class="card-h"><h2>Medical</h2></div><div class="list">${conds.length ? conds.map((p) => `<a class="srow" href="#/player/${p.id}">${kit(p)}<span><b>${esc(fullName(p))}</b><small>${esc(p.medical)}${p.blood ? ' · ' + esc(p.blood) : ''}</small></span><span></span></a>`).join('') : empty('None', '')}</div></div>
  </div></div>`;
};

// ============ SETTINGS / MORE ============
VIEWS.settings = () => {
  const c = db().club;
  return `${pageHead('Settings', '')}
  <form class="card" id="clubForm"><div class="card-h"><h2>Club</h2></div><div class="card-b"><div class="fgrid">
    <label class="fld"><span>Name</span><input name="name" id="set_name" value="${esc(c.name)}" required></label>
    <label class="fld"><span>Crest letters</span><input name="short" id="set_short" value="${esc(c.short)}" maxlength="3" required></label>
    <label class="fld"><span>Season</span><input name="season" id="set_season" value="${esc(c.season)}"></label>
    <label class="fld"><span>Home turf</span><input name="defaultVenue" id="set_venue" value="${esc(c.defaultVenue || '')}"></label>
  </div></div><div class="card-b" style="border-top:1px solid var(--line);display:flex;justify-content:flex-end"><button class="btn btn-primary" type="submit">${icon('check')} Save</button></div></form>
  <div class="card"><div class="card-h"><h2>Data</h2><span class="sub">Saved on this device</span></div><div class="card-b" style="display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" type="button" data-action="backup">${icon('download')} Backup</button>
      <label class="btn">${icon('upload')} Restore<input type="file" id="restoreFile" accept="application/json,.json" hidden></label>
      <button class="btn" type="button" data-action="export-csv">${icon('download')} Squad CSV</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:12px">
      ${db().isSample ? `<button class="btn btn-danger" type="button" data-action="clear-sample">Clear sample data</button>` : `<button class="btn" type="button" data-action="load-sample">Load sample data</button><button class="btn btn-danger" type="button" data-action="wipe">Delete all data</button>`}
    </div></div></div>`;
};
VIEWS.more = () => `${pageHead('More', '')}<div class="card more-list">${NAV.slice(4).map(([k, l, ic]) => `<a href="#/${k}">${icon(ic)}${l}</a>`).join('')}<a href="#" data-action="theme">${icon('moon')}Light / dark</a></div>`;

// ============ modal / forms ============
function field(f) {
  const id = 'f_' + f.name; const v = f.value ?? '';
  let input;
  if (f.type === 'select') input = `<select id="${id}" name="${f.name}" ${f.required ? 'required' : ''}>${f.options.map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;
  else if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''}>${esc(v)}</textarea>`;
  else if (f.type === 'file') input = `<input id="${id}" name="${f.name}" type="file" accept="${f.accept || ''}">`;
  else input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${f.required ? 'required' : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${f.maxlength ? `maxlength="${f.maxlength}"` : ''} placeholder="${esc(f.placeholder || '')}">`;
  return `<label class="fld ${f.span ? 'span2' : ''}" for="${id}"><span>${esc(f.label)}${f.required ? ' *' : ''}</span>${input}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</label>`;
}
function openForm({ title, fields, submitLabel = 'Save', onSubmit, extraFoot = '', bodyTop = '', narrow = false }) {
  $('#modal-root').innerHTML = `<div class="modal-back" data-action="modal-bg"><form class="modal ${narrow ? 'narrow' : ''}" id="modalForm" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-action="modal-close" aria-label="Close">${icon('x')}</button></header>
    <div class="modal-body">${bodyTop}<div class="fgrid">${fields.map((f) => (f.section ? `<div class="fsec span2">${esc(f.section)}</div>` : f.html ? `<div class="span2">${f.html}</div>` : field(f))).join('')}</div></div>
    <footer>${extraFoot}<span class="grow"></span><button type="button" class="btn" data-action="modal-close">Cancel</button><button class="btn btn-primary" type="submit">${esc(submitLabel)}</button></footer></form></div>`;
  const form = $('#modalForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {}; const files = {};
    for (const el of form.elements) { if (!el.name) continue; if (el.type === 'file') files[el.name] = el.files[0]; else data[el.name] = el.value.trim(); }
    try { const r = await onSubmit(data, files, form); if (r !== false) closeModal(); }
    catch (err) { toast(err.message || 'Not saved', 'bad'); }
  });
  setTimeout(() => { const f = form.querySelector('.modal-body input:not([type=file]), .modal-body select, .modal-body textarea'); if (f) f.focus(); }, 30);
}
function openConfirm(title, text, label, onYes) {
  $('#modal-root').innerHTML = `<div class="modal-back" data-action="modal-bg"><div class="modal narrow" role="alertdialog" aria-modal="true" aria-label="${esc(title)}"><header><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-action="modal-close" aria-label="Close">${icon('x')}</button></header><div class="modal-body"><p style="margin:0">${esc(text)}</p></div><footer><span class="grow"></span><button type="button" class="btn" data-action="modal-close">Cancel</button><button type="button" class="btn btn-primary" id="confirmYes" style="background:var(--bad);border-color:var(--bad);color:#fff">${esc(label)}</button></footer></div></div>`;
  $('#confirmYes').addEventListener('click', () => { closeModal(); onYes(); });
}
const closeModal = () => { $('#modal-root').innerHTML = ''; };
function toast(msg, kind = '', undo) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
  if (undo) el.querySelector('button').addEventListener('click', () => { undo(); el.remove(); });
  $('#toast').replaceChildren(el);
  setTimeout(() => el.remove(), undo ? 6000 : 3200);
}
function readPhoto(file) {
  return new Promise((res, rej) => {
    if (!file || !file.size) return res(null);
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => { const s = 240, r = Math.min(img.width, img.height); const c = document.createElement('canvas'); c.width = c.height = s; c.getContext('2d').drawImage(img, (img.width - r) / 2, (img.height - r) / 2, r, r, 0, 0, s, s); res(c.toDataURL('image/jpeg', 0.82)); }; img.onerror = () => rej(new Error('Use a JPG or PNG photo')); img.src = fr.result; };
    fr.onerror = () => rej(new Error('Could not read file'));
    fr.readAsDataURL(file);
  });
}
function save(msg) { if (!Store.save()) toast('Storage full · remove photos or back up', 'bad'); else if (msg) toast(msg); render(); }

// ============ forms for each record ============
function playerForm(p) {
  const isNew = !p;
  p = p || { status: 'active', foot: 'Right', joined: today(), gender: 'Male', position: 'CM' };
  const posOpts = POSITIONS.map((c) => [c, `${c} · ${POS_NAME[c]}`]);
  openForm({
    title: isNew ? 'Add player' : `Edit ${fullName(p)}`, submitLabel: isNew ? 'Add' : 'Save',
    fields: [
      { section: 'Personal' },
      { name: 'first', label: 'First name', value: p.first, required: true }, { name: 'last', label: 'Last name', value: p.last, required: true },
      { name: 'dob', label: 'Date of birth', type: 'date', value: p.dob, required: true, max: today() }, { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'], value: p.gender },
      { name: 'phone', label: 'Phone', type: 'tel', value: p.phone, placeholder: '+256 7XX XXX XXX' }, { name: 'email', label: 'Email', type: 'email', value: p.email },
      { name: 'address', label: 'Area', value: p.address, placeholder: 'Kisasi, Kampala' },
      { name: 'nin', label: 'NIN', value: p.nin, placeholder: '14 characters', maxlength: 14 },
      { section: 'Next of kin' },
      { name: 'nokName', label: 'Full name', value: p.nokName }, { name: 'nokRel', label: 'Relationship', type: 'select', options: ['', 'Mother', 'Father', 'Guardian', 'Spouse', 'Brother', 'Sister', 'Uncle', 'Aunt', 'Friend', 'Other'], value: p.nokRel },
      { name: 'nokPhone', label: 'Phone', type: 'tel', value: p.nokPhone },
      { section: 'Football' },
      { name: 'position', label: 'Position', type: 'select', options: posOpts, value: p.position, required: true },
      { name: 'position2', label: 'Also plays', type: 'select', options: [['', '—'], ...posOpts], value: p.position2 },
      { name: 'foot', label: 'Strong foot', type: 'select', options: ['Right', 'Left', 'Both'], value: p.foot },
      { name: 'jersey', label: 'Number', type: 'number', min: 1, max: 99, value: p.jersey },
      { name: 'height', label: 'Height (cm)', type: 'number', min: 100, max: 230, value: p.height }, { name: 'weight', label: 'Weight (kg)', type: 'number', min: 30, max: 160, value: p.weight },
      { name: 'joined', label: 'Joined', type: 'date', value: p.joined },
      { name: 'status', label: 'Status', type: 'select', options: Object.entries(STATUS).map(([k, [l]]) => [k, l]), value: p.status },
      { section: 'Health' },
      { name: 'blood', label: 'Blood group', type: 'select', options: ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'], value: p.blood },
      { name: 'medical', label: 'Medical', type: 'textarea', rows: 2, span: true, value: p.medical },
      { section: 'Other' },
      { name: 'photo', label: p.photo ? 'Replace photo' : 'Photo', type: 'file', accept: 'image/*', span: true },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, span: true, value: p.notes },
    ],
    onSubmit: async (d, files) => {
      if (d.nin) { d.nin = d.nin.toUpperCase().replace(/\s+/g, ''); if (d.nin.length !== 14) throw new Error(`NIN must be 14 characters (got ${d.nin.length})`); }
      d.jersey = d.jersey ? Number(d.jersey) : null;
      const clash = d.jersey && db().players.find((x) => x.id !== p.id && x.status !== 'left' && x.jersey === d.jersey);
      if (clash) throw new Error(`#${d.jersey} is taken by ${fullName(clash)}`);
      d.height = d.height ? Number(d.height) : null; d.weight = d.weight ? Number(d.weight) : null;
      const photo = await readPhoto(files.photo);
      if (isNew) {
        const np = { id: Store.uid('p'), ...d, photo };
        db().players.push(np);
        save(`${fullName(np)} added`);
        location.hash = `#/player/${np.id}`;
      } else {
        Object.assign(p, d); if (photo) p.photo = photo;
        save('Saved');
      }
    },
  });
}

function commentForm({ pid, sessionId, matchId }) {
  const ps = squad();
  const s = sessionId && db().sessions.find((x) => x.id === sessionId);
  const m = matchId && db().matches.find((x) => x.id === matchId);
  openForm({
    title: pid ? fullName(player(pid)) : 'Comment', submitLabel: 'Add', narrow: true,
    bodyTop: s ? `<p class="hint" style="margin:0 0 12px">${esc(s.focus || 'Training')} · ${fmtShort(s.date)}</p>` : m ? `<p class="hint" style="margin:0 0 12px">${esc(gameTitle(m))} · ${fmtShort(m.date)}</p>` : '',
    fields: [
      ...(pid ? [] : [{ name: 'pid', label: 'Player', type: 'select', options: ps.map((p) => [p.id, fullName(p)]), required: true, span: true }]),
      { name: 'tag', label: 'Type', type: 'select', options: TAGS, value: 'Improvement' },
      { name: 'date', label: 'Date', type: 'date', value: s?.date || m?.date || today() },
      { name: 'text', label: 'Comment', type: 'textarea', rows: 4, span: true, required: true, placeholder: '' },
    ],
    onSubmit: (d) => {
      if (!d.text) throw new Error('Comment is empty');
      db().comments.push({ id: Store.uid('c'), pid: pid || d.pid, date: d.date, tag: d.tag, text: d.text, sessionId: sessionId || null, matchId: matchId || null, author: 'Coach' });
      save('Added');
    },
  });
}

function skillForm(pid) {
  const last = skillsOf(pid)[0] || {};
  openForm({
    title: `Rate ${fullName(player(pid))}`, submitLabel: 'Save',
    bodyTop: '<p class="hint" style="margin:0 0 12px">1–10. Last scores filled in.</p>',
    fields: [
      { name: 'date', label: 'Date', type: 'date', value: today(), required: true },
      { html: `<div class="skillgrid">${SKILLS.map(([k, l]) => field({ name: k, label: l, type: 'number', min: 1, max: 10, value: last[k] ?? 5, required: true })).join('')}</div>` },
      { name: 'note', label: 'Note', type: 'textarea', rows: 2, span: true, placeholder: '' },
    ],
    onSubmit: (d) => {
      const s = { id: Store.uid('s'), pid, date: d.date, note: d.note };
      for (const [k, l] of SKILLS) { const v = Number(d[k]); if (!(v >= 1 && v <= 10)) throw new Error(`${l}: 1–10`); s[k] = Math.round(v); }
      db().skills.push(s);
      ui.playerTab = 'skills';
      save('Rated');
    },
  });
}

function injuryForm(inj, pid) {
  const isNew = !inj;
  inj = inj || { pid, date: today(), severity: 'Minor', resolved: false };
  openForm({
    title: isNew ? 'Injury' : 'Edit injury', narrow: true,
    fields: [
      { name: 'pid', label: 'Player', type: 'select', options: squad().map((p) => [p.id, fullName(p)]), value: inj.pid, required: true, span: true },
      { name: 'type', label: 'Injury', value: inj.type, required: true, placeholder: 'Hamstring strain', span: true },
      { name: 'date', label: 'Date', type: 'date', value: inj.date, required: true },
      { name: 'severity', label: 'Severity', type: 'select', options: ['Minor', 'Moderate', 'Severe'], value: inj.severity },
      { name: 'expectedReturn', label: 'Expected back', type: 'date', value: inj.expectedReturn, span: true },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 3, span: true, value: inj.notes },
    ],
    extraFoot: isNew ? '' : `<button type="button" class="btn btn-danger" data-action="delete-injury" data-id="${inj.id}">${icon('trash')} Delete</button>`,
    onSubmit: (d) => {
      Object.assign(inj, d);
      if (isNew) { inj.id = Store.uid('i'); db().injuries.push(inj); }
      const p = player(inj.pid);
      if (p && !inj.resolved) p.status = 'injured';
      save(isNew ? `${fullName(p)} out injured` : 'Saved');
    },
  });
}

function sessionForm(s) {
  const isNew = !s;
  s = s || { date: today(), time: '17:30', venue: db().club.defaultVenue || '', attendance: {} };
  openForm({
    title: isNew ? 'New session' : 'Edit session', narrow: true,
    fields: [
      { name: 'date', label: 'Date', type: 'date', value: s.date, required: true }, { name: 'time', label: 'Time', type: 'time', value: s.time },
      { name: 'focus', label: 'Focus', value: s.focus, placeholder: 'Finishing', span: true },
      { name: 'venue', label: 'Venue', value: s.venue, span: true },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 3, span: true, value: s.notes },
    ],
    onSubmit: (d) => {
      Object.assign(s, d);
      if (isNew) { s.id = Store.uid('t'); db().sessions.push(s); save('Created'); location.hash = `#/session/${s.id}`; }
      else save('Saved');
    },
  });
}

function matchForm(m) {
  const isNew = !m;
  const next = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return iso(d); })();
  m = m || { mode: 'split', date: next, time: '18:00', duration: 60, venue: 'H', competition: 'Friendly', location: db().club.defaultVenue || '', status: 'upcoming', availability: {}, lineup: [], lineupB: [], bench: [], stats: {} };
  openForm({
    title: isNew ? 'New game' : 'Edit game', narrow: true,
    fields: [
      { name: 'mode', label: 'Game', type: 'select', options: [['split', 'Gold v Blue (own players)'], ['opponent', 'v another team']], value: m.mode || 'split', span: true },
      { name: 'opponent', label: 'Opponent', value: m.opponent, span: true, placeholder: '' },
      { name: 'venue', label: 'Venue', type: 'select', options: [['H', 'Home'], ['A', 'Away']], value: m.venue },
      { name: 'competition', label: 'Competition', type: 'select', options: ['Friendly', 'League', 'Cup', 'Tournament'], value: m.competition },
      { name: 'date', label: 'Date', type: 'date', value: m.date, required: true }, { name: 'time', label: 'Kick-off', type: 'time', value: m.time },
      { name: 'duration', label: 'Minutes', type: 'number', min: 10, max: 120, value: m.duration || 60 },
      { name: 'location', label: 'Turf', value: m.location },
    ],
    onSubmit: (d) => {
      if (d.mode === 'opponent' && !d.opponent) throw new Error('Add the opponent');
      d.duration = Number(d.duration) || 60;
      if (d.mode !== m.mode && !isNew) { m.lineupB = []; }
      Object.assign(m, d);
      if (isNew) { m.id = Store.uid('m'); db().matches.push(m); ui.nextTab = 'availability'; save('Game created'); location.hash = `#/match/${m.id}`; }
      else save('Saved');
    },
  });
  const modeSel = $('#f_mode');
  const toggle = () => ['opponent', 'venue', 'competition'].forEach((n) => { $(`#f_${n}`).closest('.fld').hidden = modeSel.value !== 'opponent'; });
  modeSel.addEventListener('change', toggle);
  toggle();
}

// ============ files ============
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCsv() {
  const cols = [['first', 'First name'], ['last', 'Last name'], ['jersey', 'Number'], ['position', 'Position'], ['position2', 'Second position'], ['foot', 'Foot'], ['dob', 'Date of birth'], ['age', 'Age'], ['gender', 'Gender'], ['phone', 'Phone'], ['email', 'Email'], ['address', 'Area'], ['nin', 'NIN'], ['nokName', 'Next of kin'], ['nokRel', 'Relationship'], ['nokPhone', 'Next of kin phone'], ['blood', 'Blood group'], ['medical', 'Medical'], ['joined', 'Joined'], ['status', 'Status'], ['apps', 'Apps'], ['goals', 'Goals'], ['assists', 'Assists'], ['att', 'Training %']];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = db().players.slice().sort(byJersey).map((p) => { const s = playerStats(p.id); const ex = { ...p, age: age(p.dob), apps: s.apps, goals: s.goals, assists: s.assists, att: attendance(p.id).rate }; return cols.map(([k]) => q(ex[k])).join(','); });
  download(`${db().club.name.replace(/\W+/g, '-').toLowerCase()}-squad-${today()}.csv`, '﻿' + [cols.map(([, l]) => q(l)).join(','), ...rows].join('\r\n'), 'text/csv');
}

// ============ events ============
const curMatch = () => db().matches.find((m) => m.id === location.hash.split('/')[2]);
const A = {
  'modal-close': closeModal,
  'modal-bg': (el, e) => { if (e.target === el) closeModal(); },
  theme: (el, e) => { e.preventDefault(); const r = document.documentElement; const dark = r.getAttribute('data-theme') === 'dark' || (!r.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches); const next = dark ? 'light' : 'dark'; r.setAttribute('data-theme', next); try { localStorage.setItem('cc-theme', next); } catch (_) {} render(); },
  tab: (el) => { const k = { player: 'playerTab', match: 'matchTab', matches: 'matchesTab' }[el.dataset.tab]; ui[k] = el.dataset.v; ui.sel = null; render(); },
  'filter-line': (el) => { ui.line = el.dataset.v; render(); },
  'new-player': () => playerForm(),
  'edit-player': (el) => playerForm(player(el.dataset.pid)),
  'delete-player': (el) => { const p = player(el.dataset.pid); openConfirm('Delete player?', `Removes ${fullName(p)} with their comments, ratings and injuries. To keep their history, set status to "Left club".`, 'Delete', () => { const id = p.id; const d = db(); d.players = d.players.filter((x) => x.id !== id); ['comments', 'skills', 'injuries'].forEach((k) => { d[k] = d[k].filter((x) => x.pid !== id); }); d.matches.forEach((m) => { m.lineup = (m.lineup || []).map((x) => (x === id ? null : x)); m.lineupB = (m.lineupB || []).map((x) => (x === id ? null : x)); m.bench = (m.bench || []).filter((x) => x !== id); if (m.stats) delete m.stats[id]; if (m.availability) delete m.availability[id]; if (m.motm === id) m.motm = null; }); location.hash = '#/players'; save(`${fullName(p)} deleted`); }); },
  'reveal-nin': (el) => { ui.revealNin[el.dataset.pid] = !ui.revealNin[el.dataset.pid]; render(); },
  'add-comment': (el) => commentForm({ pid: el.dataset.pid, sessionId: el.dataset.sid, matchId: el.dataset.mid }),
  'delete-comment': (el) => { const c = db().comments.find((x) => x.id === el.dataset.id); db().comments = db().comments.filter((x) => x !== c); save(); toast('Comment deleted', '', () => { db().comments.push(c); save(); }); },
  assess: (el) => skillForm(el.dataset.pid),
  'delete-skill': (el) => { const s = db().skills.find((x) => x.id === el.dataset.id); db().skills = db().skills.filter((x) => x !== s); save(); toast('Rating deleted', '', () => { db().skills.push(s); save(); }); },
  'new-injury': (el) => injuryForm(null, el.dataset.pid || squad()[0]?.id),
  'edit-injury': (el) => injuryForm(db().injuries.find((i) => i.id === el.dataset.id)),
  'delete-injury': (el) => { const i = db().injuries.find((x) => x.id === el.dataset.id); db().injuries = db().injuries.filter((x) => x !== i); const p = player(i.pid); if (p && p.status === 'injured' && !db().injuries.some((x) => x.pid === p.id && !x.resolved)) p.status = 'active'; closeModal(); save('Injury deleted'); },
  recover: (el) => { const i = db().injuries.find((x) => x.id === el.dataset.id); i.resolved = true; i.resolvedDate = today(); const p = player(i.pid); if (p && p.status === 'injured' && !db().injuries.some((x) => x.pid === p.id && !x.resolved)) p.status = 'active'; save(`${fullName(p)} fit`); },
  'new-session': () => sessionForm(),
  'edit-session': (el) => sessionForm(db().sessions.find((s) => s.id === el.dataset.id)),
  'delete-session': (el) => openConfirm('Delete session?', 'Register and teams are removed. Comments stay.', 'Delete', () => { db().sessions = db().sessions.filter((s) => s.id !== el.dataset.id); location.hash = '#/training'; save('Session deleted'); }),
  att: (el) => { const s = db().sessions.find((x) => x.id === el.dataset.sid); s.attendance = s.attendance || {}; const v = el.dataset.v; if (s.attendance[el.dataset.pid] === v) delete s.attendance[el.dataset.pid]; else s.attendance[el.dataset.pid] = v; save(); },
  'all-present': (el) => { const s = db().sessions.find((x) => x.id === el.dataset.sid); s.attendance = s.attendance || {}; let n = 0; squad().forEach((p) => { if (!s.attendance[p.id] && p.status !== 'injured') { s.attendance[p.id] = 'P'; n++; } }); save(`${n} marked present`); },
  split: (el) => { const s = db().sessions.find((x) => x.id === el.dataset.sid); const pids = squad().filter((p) => fit(p) && ['P', 'L'].includes(s.attendance?.[p.id])).map((p) => p.id); const n = Number($('#teamCount')?.value || 2); if (pids.length < n * 2) { toast(`Need ${n * 2}+ present`, 'bad'); return; } s.teams = splitTeams(pids, n); save(`${n} teams · ${pids.length} players`); },
  'new-match': () => matchForm(),
  'edit-match': (el) => matchForm(db().matches.find((m) => m.id === el.dataset.id)),
  'delete-match': (el) => openConfirm('Delete game?', 'Lineups, availability and stats are removed.', 'Delete', () => { db().matches = db().matches.filter((m) => m.id !== el.dataset.id); db().comments = db().comments.filter((c) => c.matchId !== el.dataset.id); location.hash = '#/matches'; save('Game deleted'); }),
  avail: (el) => { const m = db().matches.find((x) => x.id === el.dataset.mid); const v = el.dataset.v; if (m.availability[el.dataset.pid] === v) delete m.availability[el.dataset.pid]; else m.availability[el.dataset.pid] = v; save(); },
  'all-coming': (el) => { const m = db().matches.find((x) => x.id === el.dataset.mid); let n = 0; squad().forEach((p) => { if (fit(p) && !m.availability[p.id]) { m.availability[p.id] = 'yes'; n++; } }); save(`${n} marked in`); },
  pick: (el) => { const m = curMatch(); const pid = el.dataset.pid; const from = el.dataset.from; const sel = ui.sel && ui.sel.mid === m.id ? ui.sel : null;
    if (sel && sel.pid === pid) { ui.sel = null; render(); return; }
    if (sel && sel.from === 'slot' && from !== 'slot') { movePlayer(m, sel.pid, { kind: from === 'bench' ? 'bench' : 'pool' }); movePlayer(m, pid, { kind: 'slot', team: sel.team, i: sel.i }); ui.sel = null; render(); if (from === 'bench') toast('Subbed in'); return; }
    ui.sel = { mid: m.id, pid, from }; render(); },
  slot: (el) => { const m = curMatch(); const team = el.dataset.team; const i = +el.dataset.i; const L = lineupOf(m, team); const sel = ui.sel && ui.sel.mid === m.id ? ui.sel : null;
    if (sel) { if (sel.from === 'slot' && sel.team === team && sel.i === i) { ui.sel = null; render(); return; } movePlayer(m, sel.pid, { kind: 'slot', team, i }); ui.sel = null; render(); return; }
    if (L[i]) { ui.sel = { mid: m.id, pid: L[i], from: 'slot', team, i }; render(); } },
  'bench-drop': () => { const m = curMatch(); const sel = ui.sel; if (!sel || sel.from === 'bench') return; movePlayer(m, sel.pid, { kind: 'bench' }); ui.sel = null; render(); },
  'to-bench': () => { const m = curMatch(); movePlayer(m, ui.sel.pid, { kind: 'bench' }); ui.sel = null; render(); },
  'to-pool': () => { const m = curMatch(); movePlayer(m, ui.sel.pid, { kind: 'pool' }); ui.sel = null; render(); },
  'sel-cancel': () => { ui.sel = null; render(); },
  'auto-pick': () => { const m = curMatch(); const before = { lineup: (m.lineup || []).slice(), lineupB: (m.lineupB || []).slice(), bench: (m.bench || []).slice() }; autoPick(m); ui.sel = null; render(); toast(isSplit(m) ? 'Teams made' : 'Lineup set', '', () => { Object.assign(m, before); save(); }); },
  'clear-lineup': () => { const m = curMatch(); const before = { lineup: (m.lineup || []).slice(), lineupB: (m.lineupB || []).slice(), bench: (m.bench || []).slice() }; m.lineup = []; m.lineupB = []; m.bench = []; ui.sel = null; save(); toast('Cleared', '', () => { Object.assign(m, before); save(); }); },
  unplay: (el) => { const m = db().matches.find((x) => x.id === el.dataset.mid); m.status = 'upcoming'; save('Moved to fixtures'); },
  'export-csv': exportCsv,
  backup: () => { download(`${db().club.name.replace(/\W+/g, '-').toLowerCase()}-backup-${today()}.json`, JSON.stringify(db(), null, 1), 'application/json'); toast('Backup downloaded'); },
  'clear-sample': () => openConfirm('Clear sample data?', 'Removes all made-up players, sessions and games. Club settings stay.', 'Clear', () => { Store.clearAll(); location.hash = '#/players'; save('Cleared'); }),
  'load-sample': () => openConfirm('Load sample data?', 'Replaces everything saved. Back up first.', 'Load', () => { Store.loadSample(); location.hash = '#/dashboard'; save('Sample data loaded'); }),
  wipe: () => openConfirm('Delete all data?', 'Every player, session, game and injury on this device. Cannot be undone without a backup.', 'Delete all', () => { Store.clearAll(); location.hash = '#/dashboard'; save('Deleted'); }),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !A[el.dataset.action]) return;
  if (el.tagName === 'A' && el.dataset.action !== 'theme') return;
  A[el.dataset.action](el, e);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'squadSearch') { ui.search = e.target.value; $('#squadList').innerHTML = squadList(); }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'statusFilter') { ui.status = t.value; $('#squadList').innerHTML = squadList(); }
  if (['sideSize', 'shapeA', 'shapeB'].includes(t.id)) { const m = curMatch(); if (t.id === 'sideSize') m.sideSize = t.value ? Number(t.value) : null; else m[t.id] = t.value; syncLineup(m); ui.sel = null; save(); }
  if (t.id === 'restoreFile' && t.files[0]) {
    const fr = new FileReader();
    fr.onload = () => { try { const d = JSON.parse(fr.result); if (!Array.isArray(d.players) || !d.club) throw new Error(); openConfirm('Restore backup?', `${plural(d.players.length, 'player')} · ${plural((d.matches || []).length, 'game')}. Replaces current data.`, 'Restore', () => { Store.replace(d); save('Backup restored'); }); } catch (_) { toast('Not a backup file', 'bad'); } t.value = ''; };
    fr.readAsText(t.files[0]);
  }
});
document.addEventListener('submit', (e) => {
  if (e.target.id === 'clubForm') {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    Object.assign(db().club, { name: d.name.trim() || 'Community Club', short: d.short.trim().toUpperCase() || 'CC', season: d.season.trim(), defaultVenue: d.defaultVenue.trim() });
    save('Saved');
  }
  if (e.target.id === 'resultForm') {
    e.preventDefault();
    const m = db().matches.find((x) => x.id === e.target.dataset.mid);
    const fd = new FormData(e.target);
    m.ourScore = Number(fd.get('ourScore')); m.theirScore = Number(fd.get('theirScore')); m.motm = fd.get('motm') || null;
    const stats = {};
    for (const [k, v] of fd.entries()) {
      const mm = k.match(/^(min|goals|assists|yc|rc|rating)_(.+)$/);
      if (!mm || v === '') continue;
      (stats[mm[2]] = stats[mm[2]] || {})[mm[1]] = Number(v);
    }
    for (const [pid, s] of Object.entries(stats)) { if (s.rating != null && (s.rating < 1 || s.rating > 10)) { toast(`Ratings go from 1 to 10. Check ${fullName(player(pid))}.`, 'bad'); return; } }
    m.teamOfSub = {};
    for (const [k, v] of fd.entries()) { const mm = k.match(/^team_(.+)$/); if (mm && v) m.teamOfSub[mm[1]] = v; }
    m.stats = stats; m.status = 'played'; m.sideSize = sideSize(m);
    save('Result saved');
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if ($('#modal-root').innerHTML) closeModal(); else if (ui.sel) { ui.sel = null; render(); } } });

// drag & drop on desktop (tap-to-place works everywhere)
document.addEventListener('dragstart', (e) => { const el = e.target.closest('[data-drag]'); if (!el) return; ui.drag = el.dataset.drag; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ui.drag); } catch (_) {} });
document.addEventListener('dragover', (e) => { if (ui.drag && e.target.closest('[data-drop]')) e.preventDefault(); });
document.addEventListener('drop', (e) => {
  const z = e.target.closest('[data-drop]'); if (!ui.drag || !z) return;
  e.preventDefault();
  const m = curMatch(); const d = z.dataset.drop;
  if (d.startsWith('slot:')) { const [, team, i] = d.split(':'); movePlayer(m, ui.drag, { kind: 'slot', team, i: +i }); }
  else if (d === 'bench') movePlayer(m, ui.drag, { kind: 'bench' });
  else if (d === 'pool') movePlayer(m, ui.drag, { kind: 'pool' });
  ui.drag = null; ui.sel = null; render();
});
document.addEventListener('dragend', () => { ui.drag = null; });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());

// ============ start ============
Store.load();
// Fees were dropped; older saves used fixed 11-a-side formations
delete db().payments; ['monthlyFee', 'currency', 'feeStart'].forEach((k) => delete db().club[k]);
db().matches.forEach((m) => {
  if (!m.mode) m.mode = m.opponent ? 'opponent' : 'split';
  if (m.formation) {
    const shape = m.formation.replace(/^.*?(\d[\d-]*)$/, '$1');
    const k = shape.split('-').reduce((a, b) => a + +b, 1);
    if (SHAPES[k]?.includes('GK ' + shape)) { m.sideSize = m.sideSize || k; m.shapeA = m.shapeA || 'GK ' + shape; }
    delete m.formation;
  }
});
lastRoute = location.hash.split('/').slice(0, 3).join('/');
render();
})();
