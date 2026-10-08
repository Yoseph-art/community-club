# Community Club Matchday

Squad, training, turf games (Orange v Black) and injuries for Community Club.
Plain HTML, CSS and JavaScript, with no build step and nothing to install. Set up the same way as TM Bweyogerere.

## Try it on this computer

```
node serve.mjs
```

Then open http://localhost:5070. Once `config.js` points at the database it signs in online;
`http://localhost:5070/?local` opens the one-device version instead.

## Online

- **App:** Cloudflare Worker `community-club` (Thomas's Cloudflare account), files from `~/CC-site`.
- **Records:** Supabase project `community-club` (Thomas's Supabase account). Setup: `supabase/schema.sql`, run in the SQL Editor.
- **Keep-alive:** Cloudflare Worker `cc-keepalive` asks the database "are you there?" every day at 09:23 Uganda time, so the free project is never paused.

Publish a change:

```
node tools/build_site.mjs
npx wrangler deploy --config ~/CC-site.wrangler.jsonc
```

`build_site.mjs` copies only the app's own files, adds the security headers, and refuses to build if anything that looks like a phone number or real email is in them.

## Accounts

All four people are admins: Thomas, Faisal, Ismail and Joseph. To add someone:

1. Supabase → Authentication → Users → **Add user → Send invitation**.
2. They tap the email link and choose their own password in the app.
3. An admin opens **Settings → Accounts → Give role**.

Sign-ups are switched off, so nobody else can make an account. "Forgot password?" on the sign-in screen emails a reset link.

## Files

| File | What it holds |
|---|---|
| `index.html`, `styles.css`, `theme.js` | Page shell and look |
| `app.js` | Screens, sign-in and accounts |
| `store.js` | Where records are kept: this device, or online (saves only what changed) |
| `config.js`, `cloud.js` | The Supabase address, sign-in and calls to the `cc_*` functions |
| `sample-data.js` | Made-up squad for trying the one-device version |
| `manifest.webmanifest`, `sw.js`, `icons/` | Install as an app; opens with weak signal |
| `supabase/schema.sql` | The online database: tables closed to the internet, `cc_*` functions check every call |
| `tools/` | Security headers, site build, keep-alive |
