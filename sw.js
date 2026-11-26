/* Offline support WITHOUT ever needing a version bump.
   - Online: every load asks the server for the newest file (so uploads show up right away).
   - Offline / very slow connection: falls back to the last saved copy.
   You can upload a new index.html any time; you never need to edit this file again. */
const CACHE = 'gbt-cache';   /* constant on purpose - do not change */
const CORE = ['./', './index.html', './manifest.webmanifest?v=3', './icon-192.png?v=3', './icon-512.png?v=3', './apple-touch-icon.png?v=3'];
const SLOW_MS = 5000;        /* after this long with no answer, use the saved copy */

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => { }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            /* only this site's own files */
  if (url.pathname.endsWith('/sw.js')) return;           /* always let the browser fetch the worker itself */
  const isPage = req.mode === 'navigate';
  const key = isPage ? './index.html' : req;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = () => isPage
      ? cache.match('./index.html').then(r => r || cache.match('./'))
      : cache.match(req);

    /* network first, bypassing the browser's own HTTP cache (revalidates, cheap 304 if unchanged) */
    const net = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    });
    net.catch(() => { });

    try {
      const res = await Promise.race([
        net,
        new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), SLOW_MS))
      ]);
      return res;
    } catch (err) {
      const hit = await saved();
      if (hit) { e.waitUntil(net.catch(() => { })); return hit; }
      try { return await net; } catch (e2) { }
      return new Response('You are offline and this page was not saved yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
