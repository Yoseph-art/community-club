/* Data layer. The rest of the app only uses Store.db and Store.save().
 *  - On this device (no database set in config.js): everything lives in localStorage.
 *  - Online (Supabase): signing in loads every record; each change is saved within a second,
 *    sending only the records that changed (one row per player, session, game ...). Nothing is
 *    kept on the phone except the sign-in, so a lost phone is fixed by switching the account off.
 *    Same approach as TM Bweyogerere (store-cloud.js / records.js there). */
const Store = (() => {
  'use strict';
  const KEY = 'cc-football-v1';
  const LISTS = ['players', 'sessions', 'matches', 'comments', 'skills', 'injuries'];
  const cloud = Cloud.on;
  let db = null, me = null, base = new Map(), saving = Promise.resolve(), failing = false, retryT = null, laterT = null, lastPull = 0;

  const empty = () => ({
    club: { name: 'Muyenga Community Club', short: 'MCC', season: '2026', defaultVenue: '' },
    players: [], sessions: [], matches: [], comments: [], skills: [], injuries: [],
    isSample: false,
  });
  const uid = (prefix) => prefix + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);
  const notify = (msg, kind) => window.dispatchEvent(new CustomEvent('cc-store', { detail: { msg, kind } }));

  // ---------- rows: {c, id, d} <-> the one big object
  function rowsOf(data) {
    const out = new Map();
    LISTS.forEach((c) => (data[c] || []).forEach((r) => { if (r && r.id) out.set(c + '\u0001' + r.id, { c, id: String(r.id), d: r }); }));
    out.set('club\u0001club', { c: 'club', id: 'club', d: data.club });
    return out;
  }
  function fromRows(rows) {
    const data = empty();
    rows.forEach(({ c, id, d }) => { if (c === 'club') data.club = Object.assign(data.club, d); else if (LISTS.includes(c)) data[c].push(d); });
    return data;
  }
  function apply(res) {
    db = fromRows(res.records || []);
    base = new Map();
    rowsOf(db).forEach((r, k) => base.set(k, JSON.stringify(r.d)));
    lastPull = Date.now();
  }

  async function push() {
    if (!db || !me) return;
    const now = rowsOf(db), changes = [], keys = [];
    now.forEach((r, k) => { const s = JSON.stringify(r.d); if (base.get(k) !== s) { changes.push({ c: r.c, id: r.id, d: r.d }); keys.push([k, s]); } });
    base.forEach((s, k) => { if (!now.has(k)) { const i = k.indexOf('\u0001'); changes.push({ c: k.slice(0, i), id: k.slice(i + 1), d: null }); keys.push([k, null]); } });
    if (!changes.length) return;
    try {
      for (let i = 0; i < changes.length; i += 300) {
        const part = changes.slice(i, i + 300);
        const note = part.length === 1 ? `${part[0].d ? 'Saved' : 'Deleted'} ${part[0].c} ${part[0].id}` : '';
        await Cloud.rpc('cc_save', { p: { changes: part, note } });
        keys.slice(i, i + 300).forEach(([k, s]) => (s === null ? base.delete(k) : base.set(k, s)));
      }
      if (failing) { failing = false; notify('Saved · back online'); }
    } catch (e) {
      if (!failing) notify(`Not saved yet · ${Cloud.friendly(e)} Retrying.`, 'bad');
      failing = true;
      clearTimeout(retryT); retryT = setTimeout(() => Store.saveNow(), 20000);
    }
  }

  // after Supabase accepts the password: is this account allowed in, and as what?
  async function admit() {
    const m = await Cloud.rpc('cc_me');
    if (m.status === 'ok') { me = { id: m.id, name: m.name, email: m.email, role: m.role, mustChange: !!m.mustChange }; apply(await Cloud.rpc('cc_load')); return { ok: true }; }
    if (m.status === 'first') return { first: true, email: m.email };
    await Cloud.signOut();
    if (m.status === 'off') return { error: 'This account is switched off. Ask Thomas or another admin.' };
    return { error: 'You are set up. An admin now needs to give you a role in Settings → Accounts. Then sign in again.' };
  }

  const Store = {
    cloud,
    uid, empty,
    get db() { return db; },
    get me() { return me; },
    get isAdmin() { return !cloud || (me && me.role === 'admin'); },
    get pending() { return !!laterT || failing; },

    // ---------- one device
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) { db = Object.assign(empty(), JSON.parse(raw)); return db; }
      } catch (e) { console.warn('Could not read saved data', e); }
      db = typeof makeSampleData === 'function' ? makeSampleData(empty()) : empty();
      Store.save();
      return db;
    },
    save() {
      if (!cloud) {
        try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { console.warn('Could not save', e); return false; }
      }
      clearTimeout(laterT);
      laterT = setTimeout(() => { laterT = null; Store.saveNow(); }, 700);
      return true;
    },
    saveNow() { saving = saving.then(push, push); return saving; },

    // ---------- online
    async resume() { if (!(await Cloud.resume())) return false; return admit(); },
    async login(email, password) {
      try { await Cloud.signIn(email, password); }
      catch (e) {
        if (e.status === 400) return { error: 'Email or password is not right.' };
        if (e.status === 429) return { error: 'Too many tries. Wait a few minutes.' };
        return { error: Cloud.friendly(e) };
      }
      try { return await admit(); } catch (e) { await Cloud.signOut(); return { error: Cloud.friendly(e) }; }
    },
    admitLink() { return admit(); },
    async passwordSet() { if (me && me.mustChange) { await Cloud.rpc('cc_password_changed'); me.mustChange = false; } },
    async claimAdmin(name) { await Cloud.rpc('cc_claim_admin', { p_name: name }); return admit(); },
    async changeOwnPassword(pw) { await Cloud.setPassword(pw); await Cloud.rpc('cc_password_changed'); if (me) me.mustChange = false; },
    async signOut() { await Store.saveNow(); db = null; me = null; base = new Map(); await Cloud.signOut(); },
    // fetch what others changed (unsaved changes go first)
    async pull() { await Store.saveNow(); apply(await Cloud.rpc('cc_load')); },
    get lastPull() { return lastPull; },
    accounts() { return Cloud.rpc('cc_accounts'); },
    setAccount(userId, p) { return Cloud.rpc('cc_account_set', { p_user: userId, p }); },
    resetPassword(userId, pw) { return Cloud.rpc('cc_reset_password', { p_user: userId, p_password: pw }); },
    auditLog() { return Cloud.rpc('cc_audit_log'); },

    // ---------- whole-data actions (both modes)
    async replace(next) {
      if (cloud) { await Store.saveNow(); await Cloud.rpc('cc_wipe'); base = new Map(); }
      db = Object.assign(empty(), next);
      delete db.payments;
      Store.save(); if (cloud) await Store.saveNow();
    },
    async clearAll() {
      const club = db.club;
      if (cloud) { await Store.saveNow(); await Cloud.rpc('cc_wipe'); base = new Map(); }
      db = empty(); db.club = club;
      Store.save(); if (cloud) await Store.saveNow();
    },
    loadSample() { db = makeSampleData(empty()); Store.save(); },
  };
  return Store;
})();
