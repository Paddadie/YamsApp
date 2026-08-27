// Navigation entre écrans + câblage des boutons transverses
// (reprendre une partie, ouvrir le Hall of Fame, revenir à l'accueil, version).

import { hasSavedGame, getSavedGame } from "./storage/savedGameRepo";
import { resumeGame } from "./screens/game";
import { showHallOfFame } from "./screens/hallOfFame";
import { requireEl } from "./ui";

type ScreenKey = "home" | "hall" | "players" | "game" | "end";

const SCREEN_IDS: Record<ScreenKey, string> = {
  home: "home-screen",
  hall: "hall-screen",
  players: "players-screen",
  game: "game-screen",
  end: "end-screen",
};

const screens = {} as Record<ScreenKey, HTMLElement>;

export function initNavigation(): void {
  for (const key of Object.keys(SCREEN_IDS) as ScreenKey[]) {
    screens[key] = requireEl(SCREEN_IDS[key]);
  }

  showScreen("home");

  requireEl("resume-btn").addEventListener("click", () => {
    const saved = getSavedGame();
    if (!saved) return;
    resumeGame(saved);
    showScreen("game");
  });

  requireEl("hall-btn").addEventListener("click", () => {
    showScreen("hall");
    showHallOfFame();
  });

  requireEl("back-to-home-btn").addEventListener("click", () => {
    showScreen("home");
  });

  updateResumeButton();
  updateAppVersion();
}

export function showScreen(screenKey: ScreenKey): void {
  for (const screen of Object.values(screens)) {
    screen.classList.remove("active");
  }
  screens[screenKey].classList.add("active");
}

export function updateResumeButton(): void {
  const resumeBtn = requireEl<HTMLButtonElement>("resume-btn");
  const enabled = hasSavedGame();
  resumeBtn.disabled = !enabled;
  resumeBtn.classList.toggle("hidden", !enabled);
}

function updateAppVersion(): void {
  const versionEl = document.getElementById("app-version");
  if (versionEl) versionEl.textContent = `v${__APP_VERSION__}`;
}
