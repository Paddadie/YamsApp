const CACHE_NAME = "v3.3.0";
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/js/main.js",
  "/js/screens.js",
  "/js/players.js",
  "/js/scores.js",
  "/js/hallOfFame.js",
  "/js/storage.js",
  "/js/utils.js",
  "/manifest.json",
  "/assets/de.png",
  "/assets/podium.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then((reg) => {
    if (reg.waiting) {
      reg.waiting.postMessage("SKIP_WAITING");
    }
  });
}

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
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
