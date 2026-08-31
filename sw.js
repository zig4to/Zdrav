/* Predpomnilnik lupine aplikacije, da deluje tudi brez povezave.
   Podatki jedi so v Supabase; brez povezave aplikacija prikaze zadnje znane
   jedi iz IndexedDB predpomnilnika (glej js/db.js). Klici na Supabase (*.supabase.co)
   se NE predpomnijo — gredo naravnost na mrezo.
   Ob spremembi datotek povečaj VERSION. */
var VERSION = 'zdrav-v12';
var SHELL = [
  './', './index.html', './style.css', './icon.svg', './manifest.json',
  './js/theme.js', './js/config.js', './js/db.js', './js/app.js', './js/auth.js',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-192.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];
var EXTERNAL = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      return c.addAll(SHELL).then(function () {
        // Zunanji viri ne smejo blokirati namestitve, ce spodletijo.
        return Promise.all(EXTERNAL.map(function (u) {
          return c.add(u).catch(function () {});
        }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;

  var url = new URL(e.request.url);
  var sameOrigin = url.origin === location.origin;
  var isCdn = url.origin === 'https://cdn.jsdelivr.net';

  // Supabase (REST, Auth, Storage) in ostalo: naravnost na mrezo, brez predpomnilnika.
  if (!sameOrigin && !isCdn) return;

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
        return res;
      }).catch(function () { return hit; });
    })
  );
});
