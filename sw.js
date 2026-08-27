let CACHE_NAME = "default-cache-name";
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/js/main.js",
  "/js/navigation.js",
  "/js/home.js",
  "/js/players.js",
  "/js/game.js",
  "/js/endScreen.js",
  "/js/hallOfFame.js",
  "/js/scoring.js",
  "/js/state.js",
  "/js/storage.js",
  "/js/ui.js",
  "/js/variants.js",
  "/manifest.json",
  "/assets/de.png",
  "/assets/podium.png",
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
