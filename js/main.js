import { initNavigation } from "./screens.js";
import { initPlayers } from "./players.js";
import { initGame } from "./scores.js";
import { initHallOfFame } from "./hallOfFame.js";

// Méthode appelé au chargement du DOM et qui appel l'ensemble des scripts qui permettent de faire tourner l'application
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initPlayers();
  initGame();
  initHallOfFame();
  registerServiceWorker();
});

// Script d'enregistrement du service worker
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("sw.js")
        .then((reg) => {
          console.log("✅ Service Worker enregistré", reg);

          if (reg.waiting) {
            reg.waiting.postMessage("SKIP_WAITING");
            window.location.reload();
          }

          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                newWorker.postMessage("SKIP_WAITING");
                window.location.reload();
              }
            });
          });
        })
        .catch((err) => console.log("❌ Échec enregistrement SW", err));
    });
  }
}
