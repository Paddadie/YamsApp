let CACHE_NAME = "yams-app-cache-name";
const ASSETS = [
  "/",
  "/assets/de.png",
  "/assets/podium.png",
  "/js/main.js",
  "/js/screens.js",
  "/js/players.js",
  "/js/scores.js",
  "/js/hallOfFame.js",
  "/js/storage.js",
  "/js/utils.js",
  "/index.html",
  "/style.css",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    fetch("version.json")
      .then((res) => res.json())
      .then((data) => {
        CACHE_NAME = data.version;
        return caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS));
      })
  );
  self.skipWaiting();
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    fetch("version.json")
      .then((res) => res.json())
      .then((data) => {
        const currentVersion = data.version;
        return caches.keys().then((keys) => {
          return Promise.all(
            keys
              .filter((key) => key !== currentVersion)
              .map((key) => caches.delete(key))
          );
        });
      })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
