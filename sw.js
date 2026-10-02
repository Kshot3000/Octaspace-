/* OctaSpace Host Console — service worker.
   Scope: the console shell ONLY. It precaches the console page and its
   static assets so the installed PWA opens instantly (and offline shows
   the shell with an honest "agent unreachable" state). Every other
   request — above all the calls to the host agent's API on the LAN —
   is left completely untouched and always goes to the network. */
"use strict";
var CACHE = "octa-console-shell-v1";
var SHELL = [
  "console.html",
  "css/style.css",
  "js/console.js",
  "js/app.js",
  "js/fx-bg.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png"
];
function isShell(url) {
  return SHELL.some(function (entry) {
    return url.pathname.endsWith("/" + entry);
  });
}
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!isShell(url)) return; // not console shell: don't intercept at all
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(e.request).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return resp;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
