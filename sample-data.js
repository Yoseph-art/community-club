/* Sample squad so the app opens in a working state.
 * Every person here is invented. Settings → "Clear sample data" removes it all. */
function makeSampleData(base) {
  let seed = 20261007;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = (v) => Math.round(v * 10) / 10;

  const db = base;
  db.isSample = true;
  db.club.defaultVenue = 'Kisasi Turf';

  // first, last, position, jersey, second position
  const roster = [
    ['Ivan', 'Ssemakula', 'GK', 1, ''], ['Brian', 'Okello', 'GK', 13, ''],
    ['Ronald', 'Wasswa', 'RB', 2, 'RM'], ['Denis', 'Ochieng', 'LB', 3, 'LM'],
    ['Joseph', 'Mugisha', 'CB', 4, 'DM'], ['Allan', 'Kato', 'CB', 5, ''],
    ['Patrick', 'Byaruhanga', 'CB', 15, 'RB'], ['Moses', 'Lubega', 'LB', 12, ''],
    ['Jonathan', 'Ayebare', 'RB', 22, ''], ['Arthur', 'Kizza', 'CB', 23, ''],
    ['Emmanuel', 'Tumusiime', 'DM', 6, 'CM'], ['Isaac', 'Nsubuga', 'CM', 8, 'AM'],
    ['Hassan', 'Mutebi', 'CM', 16, 'DM'], ['Samuel', 'Opio', 'AM', 10, 'CM'],
    ['Paul', 'Nakibinge', 'CM', 14, ''], ['Frank', 'Kiggundu', 'RM', 7, 'RW'],
    ['Andrew', 'Atuhaire', 'LM', 11, 'LW'], ['Ezra', 'Kasozi', 'RW', 17, 'ST'],
    ['Daniel', 'Mukasa', 'LW', 19, 'RW'], ['Shafik', 'Ssenyonga', 'ST', 9, ''],
    ['Collins', 'Odongo', 'ST', 18, 'RW'], ['Peter', 'Lwanga', 'ST', 20, 'AM'],
  ];
  const areas = ['Kisasi', 'Ntinda', 'Kyanja', 'Bukoto', 'Kiwatule', 'Najjera', 'Kira', 'Naalya'];
  const kinFirst = ['Grace', 'Sarah', 'Florence', 'Robert', 'James', 'Agnes', 'Esther', 'Charles', 'Ruth', 'Margaret'];
  const kinRel = ['Mother', 'Father', 'Brother', 'Sister', 'Spouse', 'Uncle'];
  const letters = 'ABCDEFGHJKLMNPRTUVWXYZ';
  const phone = () => `+256 7${ri(0, 8)}${ri(0, 9)} ${String(ri(100, 999))} ${String(ri(100, 999))}`;

  const talent = {}, commit = {};
  db.players = roster.map(([first, last, position, jersey, position2], i) => {
    const id = 'p' + String(i + 1).padStart(2, '0');
    const y = ri(1992, 2007);
    const dob = iso(new Date(y, ri(0, 11), ri(1, 28)));
    talent[id] = 5 + rnd() * 3.2;
    commit[id] = 0.55 + rnd() * 0.42;
    let nin = 'CM' + String(y).slice(2) + String(ri(100000, 999999));
    for (let k = 0; k < 4; k++) nin += letters[ri(0, letters.length - 1)];
    return {
      id, first, last, dob, gender: 'Male', phone: phone(),
      email: `${first}.${last}@example.com`.toLowerCase(),
      address: pick(areas) + ', Kampala', nin,
      nokName: pick(kinFirst) + ' ' + last, nokRel: pick(kinRel), nokPhone: phone(),
      position, position2, foot: rnd() < 0.7 ? 'Right' : rnd() < 0.85 ? 'Left' : 'Both',
      jersey, height: ri(166, 191), weight: ri(61, 86),
      joined: iso(addDays(today, -ri(60, 1100))), status: 'active',
      blood: pick(['O+', 'O+', 'A+', 'B+', 'AB+', 'O-']),
      medical: rnd() < 0.12 ? 'Mild asthma, carries an inhaler' : '',
      photo: null, notes: '',
    };
  });
  const P = (last) => db.players.find((p) => p.last === last).id;

  // Skill assessments: two rounds
  const skillKeys = ['pace', 'passing', 'shooting', 'dribbling', 'defending', 'fitness', 'discipline'];
  const bias = {
    GK: { shooting: -2, dribbling: -1.5, pace: -1, defending: 1 },
    DEF: { defending: 1.5, shooting: -1.5, dribbling: -0.5 },
    MID: { passing: 1.2, fitness: 0.6 },
    FWD: { shooting: 1.5, pace: 1, defending: -1.5 },
  };
  const lineOf = { GK: 'GK', RB: 'DEF', CB: 'DEF', LB: 'DEF', DM: 'MID', CM: 'MID', AM: 'MID', RM: 'MID', LM: 'MID', RW: 'FWD', LW: 'FWD', ST: 'FWD' };
  db.skills = [];
  [[-62, 0], [-18, 0.35]].forEach(([d, grow], round) => {
    db.players.forEach((p) => {
      const s = { id: 's' + round + p.id, pid: p.id, date: iso(addDays(today, d)), note: '' };
      skillKeys.forEach((k) => {
        const b = (bias[lineOf[p.position]] || {})[k] || 0;
        s[k] = clamp(Math.round(talent[p.id] + b + (rnd() - 0.5) * 2 + grow * rnd()), 1, 10);
      });
      if (round === 1) s.note = pick(['Steady progress since August.', 'Sharper first touch.', 'Needs more work on weak foot.', 'Good leadership in drills.', '']);
      db.skills.push(s);
    });
  });

  // Training: Tuesday and Thursday evenings, last 8 weeks + next week
  const focuses = ['Passing and possession', 'Finishing', 'Defensive shape', 'Fitness and conditioning', 'Set pieces', 'Small-sided games', 'Pressing triggers', '1v1 defending', 'Build-up from the back'];
  db.sessions = [];
  for (let d = -56; d <= 7; d++) {
    const day = addDays(today, d);
    if (day.getDay() !== 2 && day.getDay() !== 4) continue;
    const s = { id: 't' + iso(day).replace(/-/g, ''), date: iso(day), time: '17:30', venue: 'Kisasi Turf', focus: pick(focuses), notes: '', attendance: {} };
    if (d <= 0) {
      db.players.forEach((p) => {
        const r = rnd();
        s.attendance[p.id] = r < commit[p.id] ? 'P' : r < commit[p.id] + 0.07 ? 'L' : r < commit[p.id] + 0.16 ? 'E' : 'A';
      });
    }
    db.sessions.push(s);
  }
  // One player has drifted away: 3 absences in a row
  db.sessions.filter((s) => s.date <= iso(today)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
    .forEach((s) => { s.attendance[P('Lwanga')] = 'A'; });

  // Coach comments
  const notes = [
    ['Improvement', 'Scanning before receiving is much better. Keep checking the shoulder.'],
    ['Strength', 'Excellent work rate in the pressing drill, set the tone for the group.'],
    ['Concern', 'Arrived late and missed the warm-up. Talked about timekeeping.'],
    ['Improvement', 'Weak-foot passing improving. Still hesitates under pressure.'],
    ['Strength', 'Clinical in the finishing session, 7 from 10 on target.'],
    ['General', 'Asked for extra work on crossing. Pair with the wingers on Thursday.'],
    ['Improvement', 'Communication from the back has improved. Organising the line well.'],
    ['Concern', 'Looked tired in the second half of the session. Check sleep and diet.'],
    ['Strength', 'Composed on the ball when building from the back.'],
    ['Improvement', 'Better body shape when defending 1v1. Not diving in as often.'],
  ];
  db.comments = [];
  const past = db.sessions.filter((s) => s.date <= iso(today));
  for (let i = 0; i < 34; i++) {
    const s = pick(past);
    const present = Object.keys(s.attendance).filter((k) => s.attendance[k] !== 'A' && s.attendance[k] !== 'E');
    if (!present.length) continue;
    const [tag, text] = pick(notes);
    db.comments.push({ id: 'c' + i, pid: pick(present), date: s.date, sessionId: s.id, tag, text, author: 'Coach' });
  }

  // Turf games: our players split into two sides (Wed and Sat evenings), plus the odd friendly vs another team
  const SH = { 2: '2', 3: 'GK 2', 4: 'GK 2-1', 5: 'GK 2-1-1', 6: 'GK 2-2-1', 7: 'GK 2-3-1', 8: 'GK 3-3-1', 9: 'GK 3-3-2', 10: 'GK 4-3-2', 11: 'GK 4-3-3' };
  const rank = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
  const pos = (pid) => db.players.find((p) => p.id === pid).position;
  const byLine = (a, b) => rank[lineOf[pos(a)]] - rank[lineOf[pos(b)]];
  const fwdW = (pid) => ({ FWD: 5, MID: 2.2, DEF: 0.6, GK: 0.05 }[lineOf[pos(pid)]]);
  const weighted = (ids) => { const tot = ids.reduce((a, id) => a + fwdW(id), 0); let r = rnd() * tot; for (const id of ids) { r -= fwdW(id); if (r <= 0) return id; } return ids[0]; };
  const ids = db.players.map((p) => p.id);
  const playGoals = (m, team, goals) => { for (let g = 0; g < goals; g++) { const sc = weighted(team); m.stats[sc].goals++; if (rnd() < 0.6) { const o = team.filter((x) => x !== sc); if (o.length) m.stats[o[ri(0, o.length - 1)]].assists++; } } };
  db.matches = [];
  let firstUpcoming = true;
  for (let d = -42; d <= 10; d++) {
    const day = addDays(today, d);
    const friendly = d === -17 || d === 9;
    if (!friendly && day.getDay() !== 3 && day.getDay() !== 6) continue;
    const played = d < 0;
    const m = {
      id: 'm' + iso(day).replace(/-/g, ''), date: iso(day), time: friendly ? '16:00' : '18:30', duration: friendly ? 70 : 60,
      mode: friendly ? 'opponent' : 'split', opponent: friendly ? (played ? 'Kyanja FC' : 'Ntinda Rangers') : '', venue: 'H', competition: 'Friendly',
      location: 'Kisasi Turf', status: played ? 'played' : 'upcoming', ourScore: null, theirScore: null,
      availability: {}, lineup: [], lineupB: [], bench: [], stats: {}, motm: null, notes: '', teamOfSub: {},
    };
    if (played) {
      const coming = ids.filter((id) => rnd() < commit[id] * (friendly ? 0.95 : 0.8));
      coming.forEach((id) => { m.availability[id] = 'yes'; });
      ids.filter((id) => !coming.includes(id)).forEach((id) => { m.availability[id] = 'no'; });
      const order = coming.slice().sort((a, b) => talent[b] - talent[a]);
      if (friendly) {
        const k = Math.min(9, order.length);
        m.sideSize = k; m.shapeA = SH[k];
        m.lineup = order.slice(0, k).sort(byLine); m.bench = order.slice(k);
        m.lineup.forEach((id) => { m.stats[id] = { min: 70, goals: 0, assists: 0, yc: 0, rc: 0, rating: 0 }; });
        m.bench.forEach((id) => { m.stats[id] = { min: ri(15, 35), goals: 0, assists: 0, yc: 0, rc: 0, rating: 0 }; });
        m.ourScore = ri(0, 5); m.theirScore = ri(0, 4);
        playGoals(m, Object.keys(m.stats), m.ourScore);
      } else {
        const k = Math.max(2, Math.min(11, Math.floor(order.length / 2)));
        m.sideSize = k; m.shapeA = SH[k]; m.shapeB = SH[k];
        const A = [], B = [];
        order.slice(0, 2 * k).forEach((id, i) => ((i % 4 === 0 || i % 4 === 3) ? A : B).push(id));
        m.lineup = A.slice().sort(byLine); m.lineupB = B.slice().sort(byLine); m.bench = order.slice(2 * k);
        [...A, ...B].forEach((id) => { m.stats[id] = { min: 60, goals: 0, assists: 0, yc: 0, rc: 0, rating: 0 }; });
        m.bench.forEach((id) => { const t = rnd() < 0.5 ? 'A' : 'B'; m.teamOfSub[id] = t; (t === 'A' ? A : B).push(id); m.stats[id] = { min: ri(15, 30), goals: 0, assists: 0, yc: 0, rc: 0, rating: 0 }; });
        m.ourScore = ri(1, 8); m.theirScore = ri(1, 8);
        playGoals(m, A, m.ourScore); playGoals(m, B, m.theirScore);
      }
      Object.entries(m.stats).forEach(([pid, st]) => {
        if (rnd() < 0.05) st.yc = 1;
        const won = friendly ? m.ourScore - m.theirScore : (m.lineup.includes(pid) || m.teamOfSub[pid] === 'A' ? 1 : -1) * (m.ourScore - m.theirScore);
        st.rating = r1(clamp(5.6 + (talent[pid] - 6.5) * 0.45 + Math.sign(won) * 0.35 + st.goals * 0.6 + st.assists * 0.35 + (rnd() - 0.5) * 1.4, 3.8, 9.6));
      });
      m.motm = Object.keys(m.stats).sort((a, b) => m.stats[b].rating - m.stats[a].rating)[0];
    } else if (friendly || firstUpcoming) {
      if (!friendly) firstUpcoming = false;
      db.players.forEach((p) => { const r = rnd(); if (r < commit[p.id] * 0.62) m.availability[p.id] = 'yes'; else if (r < commit[p.id] * 0.62 + 0.08) m.availability[p.id] = 'maybe'; else if (r < commit[p.id] * 0.62 + 0.18) m.availability[p.id] = 'no'; });
    }
    db.matches.push(m);
  }

  // Injuries
  const kato = db.players.find((p) => p.last === 'Kato');
  kato.status = 'injured';
  db.injuries = [
    { id: 'i1', pid: kato.id, date: iso(addDays(today, -9)), type: 'Hamstring strain', severity: 'Moderate', expectedReturn: iso(addDays(today, 12)), resolved: false, resolvedDate: '', notes: 'Pulled up chasing a long ball in training. Rest, then light jogging from next week.' },
    { id: 'i2', pid: P('Ochieng'), date: iso(addDays(today, -40)), type: 'Ankle sprain', severity: 'Minor', expectedReturn: iso(addDays(today, -30)), resolved: true, resolvedDate: iso(addDays(today, -29)), notes: '' },
  ];
  return db;
}
