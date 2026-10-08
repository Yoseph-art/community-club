// Offline support: the app shell is cached so it opens with a weak signal at the turf.
// Network first (so updates arrive straight away), cache as the fallback. Records never go in this
// cache: online they come from the database and stay in memory.
const CACHE = 'cc-shell-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'theme.js', 'config.js', 'cloud.js', 'store.js', 'sample-data.js', 'app.js',
  'icons/icon-64.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
