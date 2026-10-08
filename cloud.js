/* Talking to the online database: signing in (Supabase Auth) and calling the cc_* functions.
 * Plain fetch, no libraries. Copied from TM Bweyogerere, except the sign-in is remembered on this
 * phone (until Sign out) so coaches at the turf don't have to type a password every time. */
const Cloud = (() => {
  'use strict';
  const cfg = typeof CC_CONFIG === 'object' ? CC_CONFIG : {};
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('local');
  const KEEP = 'cc-session';
  let session = null, timer = null;

  const friendly = (e) => (e instanceof TypeError ? 'No internet. Check data or Wi-Fi and try again.' : e.message || 'Something went wrong.');

  async function call(path, { method = 'POST', body, auth = false } = {}) {
    const headers = { apikey: cfg.key, 'Content-Type': 'application/json' };
    if (auth) headers.Authorization = 'Bearer ' + session.access_token;
    const r = await fetch(cfg.url + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    let j = null; try { j = text ? JSON.parse(text) : null; } catch { j = null; }
    if (!r.ok) {
      const msg = (j && (j.error_description || j.msg || j.message)) || `The server said no (${r.status}).`;
      throw Object.assign(new Error(msg), { status: r.status, code: j && (j.error_code || j.code || j.error) });
    }
    return j;
  }

  function keep(j) {
    session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in - 60) * 1000, user: j.user };
    try { localStorage.setItem(KEEP, session.refresh_token); } catch { /* private mode: sign in again after a reload */ }
    clearTimeout(timer);
    timer = setTimeout(() => refresh().catch(() => {}), Math.max(15000, session.expires_at - Date.now()));
  }
  async function refresh() {
    if (!session || !session.refresh_token) throw new Error('Not signed in.');
    keep(await call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token } }));
  }
  async function fresh() {
    if (!session) throw new Error('Not signed in.');
    if (Date.now() > session.expires_at) await refresh();
  }

  return {
    on: !!(cfg.url && cfg.key) && !local,
    cfg,
    friendly,
    get email() { return session && session.user && session.user.email; },

    async signIn(email, password) {
      keep(await call('/auth/v1/token?grant_type=password', { body: { email: String(email).trim().toLowerCase(), password } }));
      return session.user;
    },
    // Invite and "forgot password" emails from Supabase come back as
    // <site>/#access_token=…&refresh_token=…&type=invite|recovery. Returns the type, or '' if none.
    async fromLink() {
      const h = new URLSearchParams(location.hash.replace(/^#/, ''));
      if (!h.get('access_token') && !h.get('error')) return '';
      history.replaceState(null, '', location.pathname + location.search + '#/dashboard');
      if (h.get('error')) throw new Error(h.get('error_description') || 'That link has expired. Ask for a new one.');
      session = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_at: Date.now() + 60000 };
      const user = await call('/auth/v1/user', { method: 'GET', auth: true });
      keep({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: Number(h.get('expires_in')) || 3600, user });
      return h.get('type') || 'magiclink';
    },
    // emails a "set a new password" link (Supabase sends it)
    async sendReset(email) {
      await call('/auth/v1/recover?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { body: { email: String(email).trim().toLowerCase() } });
    },
    async resume() {
      let rt = null; try { rt = localStorage.getItem(KEEP); } catch { rt = null; }
      if (!rt) return false;
      session = { refresh_token: rt, expires_at: 0 };
      try { await refresh(); return true; } catch (e) { if (e instanceof TypeError) throw e; this.forget(); return false; }
    },
    async signOut() {
      const s = session;
      this.forget();
      if (s && s.access_token) { session = s; try { await call('/auth/v1/logout', { auth: true }); } catch { /* signed out here anyway */ } session = null; }
    },
    forget() { clearTimeout(timer); session = null; try { localStorage.removeItem(KEEP); } catch { /* nothing kept */ } },
    async setPassword(password) { await fresh(); return call('/auth/v1/user', { method: 'PUT', body: { password }, auth: true }); },

    async rpc(fn, args = {}, retried = false) {
      await fresh();
      try { return await call('/rest/v1/rpc/' + fn, { body: args, auth: true }); }
      catch (e) {
        if (e.status === 401 && !retried) { await refresh(); return this.rpc(fn, args, true); }
        throw e;
      }
    },
  };
})();
