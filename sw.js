/* Offline support: open the app once with signal and it keeps working with none.
   Upload this file next to index.html. Change VERSION whenever you upload a new index.html
   so phones pick up the new copy. */
const VERSION = 'gbt-v11';
const CORE = ['./', './index.html', './manifest.webmanifest?v=3', './icon-192.png?v=3', './icon-512.png?v=3', './apple-touch-icon.png?v=3'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Show the saved copy straight away, and refresh it in the background for next time. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            /* only this site's own files */
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    const net = fetch(req).then(res => { if (res && res.ok) cache.put(req.mode === 'navigate' ? './index.html' : req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') { const home = await cache.match('./index.html') || await cache.match('./'); if (home) return home; }
    return new Response('You are offline and this page was not saved yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});
