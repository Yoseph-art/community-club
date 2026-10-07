/* Data layer.
 * Today everything is kept in this browser (localStorage).
 * When we move to Supabase, only this file changes: load() reads the tables,
 * save() writes the changed rows. The rest of the app talks to Store.db only. */
const Store = (() => {
  const KEY = 'cc-football-v1';
  let db = null;

  const empty = () => ({
    club: { name: 'Community Club', short: 'CC', season: '2026', defaultVenue: '' },
    players: [], sessions: [], matches: [], comments: [], skills: [], injuries: [],
    isSample: false,
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { db = Object.assign(empty(), JSON.parse(raw)); return db; }
    } catch (e) { console.warn('Could not read saved data', e); }
    db = typeof makeSampleData === 'function' ? makeSampleData(empty()) : empty();
    save();
    return db;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { console.warn('Could not save', e); return false; }
  }

  const uid = (prefix) => prefix + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);

  return {
    load, save, uid, empty,
    get db() { return db; },
    replace(next) { db = Object.assign(empty(), next); save(); },
    clearAll() { const club = db.club; db = empty(); db.club = club; save(); },
    loadSample() { db = makeSampleData(empty()); save(); },
  };
})();
