// Navigation entre écrans + câblage des boutons transverses
// (reprendre une partie, ouvrir le Hall of Fame, revenir à l'accueil, version).

import { hasSavedGame, getSavedGame } from "./storage.js";
import { resumeGame } from "./game.js";
import { showHallOfFame } from "./hallOfFame.js";

const SCREEN_IDS = {
  home: "home-screen",
  hall: "hall-screen",
  players: "players-screen",
  game: "game-screen",
  end: "end-screen",
};

const screens = {};

export function initNavigation() {
  for (const [key, id] of Object.entries(SCREEN_IDS)) {
    screens[key] = document.getElementById(id);
  }

  showScreen("home");

  document.getElementById("resume-btn").addEventListener("click", () => {
    const saved = getSavedGame();
    if (!saved) return;
    resumeGame(saved);
    showScreen("game");
  });

  document.getElementById("hall-btn").addEventListener("click", () => {
    showScreen("hall");
    showHallOfFame();
  });

  document.getElementById("back-to-home-btn").addEventListener("click", () => {
    showScreen("home");
  });

  updateResumeButton();
  updateAppVersion();
}

export function showScreen(screenKey) {
  for (const screen of Object.values(screens)) {
    screen.classList.remove("active");
  }
  screens[screenKey].classList.add("active");
}

export function updateResumeButton() {
  const resumeBtn = document.getElementById("resume-btn");
  const enabled = hasSavedGame();
  resumeBtn.disabled = !enabled;
  resumeBtn.classList.toggle("hidden", !enabled);
}

function updateAppVersion() {
  const versionEl = document.getElementById("app-version");
  fetch("version.json")
    .then((res) => res.json())
    .then((data) => {
      versionEl.textContent = data.version;
    })
    .catch(() => {
      versionEl.textContent = "Version inconnue";
    });
}
