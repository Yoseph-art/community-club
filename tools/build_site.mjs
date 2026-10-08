// Packages only the app's own files for Cloudflare (a Worker serving static files), with the
// security headers. Same as TM Bweyogerere.
//   node tools/build_site.mjs                              -> writes ~/CC-site (outside OneDrive)
//   npx wrangler deploy --config ~/CC-site.wrangler.jsonc  -> publishes it
// Tools, the database setup and notes never go online. As a last check it refuses to build if
// anything that looks like a phone number or a real email address is in the files.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dbUrl, securityHeaders } from './headers.mjs';

const rootUrl = new URL('..', import.meta.url);
const root = fileURLToPath(rootUrl);
const out = process.argv[2] || join(homedir(), 'CC-site');
const SITE = ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'theme.js', 'config.js', 'cloud.js', 'store.js', 'sample-data.js', 'app.js', 'icons'];
const DB = dbUrl(rootUrl);
if (!DB) throw new Error('config.js has no database address yet');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
SITE.forEach((f) => cpSync(join(root, f), join(out, f), { recursive: true, filter: (p) => !/\.ps1$/.test(p) }));

const h = { ...securityHeaders(DB), 'Strict-Transport-Security': 'max-age=31536000', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-cache' };
writeFileSync(join(out, '_headers'), '/*\n' + Object.entries(h).map(([k, v]) => `  ${k}: ${v}`).join('\n') + '\n');

// last check: no personal data in what goes online (sample-data.js only has made-up example.com addresses)
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); });
walk(out);
const bad = [];
files.filter((f) => /\.(html|js|css|webmanifest)$/.test(f)).forEach((f) => {
  const s = readFileSync(f, 'utf8');
  const hits = [...s.matchAll(/\b0[37]\d{8}\b|\+256\d{9}\b|[\w.+-]+@(?!example\.com)[\w-]+\.[a-z]{2,}/gi)].map((m) => m[0]);
  if (hits.length) bad.push(`${f.slice(out.length + 1)}: ${hits.slice(0, 3).join(', ')}`);
});
if (bad.length) { console.error('Refusing to build: these look like personal details:\n  ' + bad.join('\n  ')); rmSync(out, { recursive: true, force: true }); process.exit(1); }

const cfg = out.replace(/[\\/]+$/, '') + '.wrangler.jsonc';
writeFileSync(cfg, JSON.stringify({
  name: 'community-club', account_id: '72b9828fc50eb8beac260fb076f5b266', // Thomas (Dt2600@outlook.com)
  compatibility_date: '2026-10-01',
  workers_dev: true, preview_urls: false,
  assets: { directory: './' + out.replace(/[\\/]+$/, '').split(/[\\/]/).pop() },
}, null, 2));
console.log(`Built ${files.length} files in ${out} (database: ${DB})\nPublish: npx wrangler deploy --config "${cfg}"`);
