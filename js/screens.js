import { SAVED_GAME_KEY } from "./utils.js";

export const screensId = {
  home: "home-screen",
  hall: "hall-screen",
  players: "players-screen",
  game: "game-screen",
  end: "end-screen",
};

export let screens = {};

export function initNavigation() {
  screens = {
    home: document.getElementById(screensId.home),
    hall: document.getElementById(screensId.hall),
    players: document.getElementById(screensId.players),
    game: document.getElementById(screensId.game),
    end: document.getElementById(screensId.end),
  };

  showScreen("home");

  const hallBtn = document.getElementById("hall-btn");
  const backBtn = document.getElementById("back-to-home-btn");
  const resumeBtn = document.getElementById("resume-btn");

  if (resumeBtn) {
    resumeBtn.addEventListener("click", () => {
      const saved = JSON.parse(localStorage.getItem(SAVED_GAME_KEY));
      if (saved) {
        import("./scores.js").then((module) => {
          module.resumeGame(
            saved.players,
            saved.selectedVariants,
            saved.currentPlayerIndex
          );
          showScreen("game");
        });
      }
    });
  }

  if (hallBtn) {
    hallBtn.addEventListener("click", () => {
      showScreen("hall");
      import("./hallOfFame.js").then((module) => {
        if (module.showHallOfFame) {
          module.showHallOfFame();
        }
      });
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      showScreen("home");
    });
  }

  updateResumeButton();
  updateAppVersion();
}

export function updateResumeButton() {
  const resumeBtn = document.getElementById("resume-btn");
  const saved = localStorage.getItem(SAVED_GAME_KEY);

  if (saved) {
    resumeBtn.disabled = false;
    resumeBtn.style.opacity = 1;
    resumeBtn.style.pointerEvents = "auto";
  } else {
    resumeBtn.disabled = true;
    resumeBtn.style.opacity = 0;
    resumeBtn.style.pointerEvents = "none";
  }
}

export function showScreen(screenKey) {
  Object.values(screens).forEach((screen) => {
    screen.classList.remove("active");
    screen.style.display = "none";
  });

  const screenToShow = screens[screenKey];
  screenToShow.classList.add("active");

  if (screenKey === "game" || screenKey === "end") {
    screenToShow.style.display = "block";
  } else {
    screenToShow.style.display = "flex";
  }
}

function updateAppVersion() {
  fetch("version.json")
    .then((res) => res.json())
    .then((data) => {
      const versionEl = document.getElementById("app-version");
      if (versionEl) {
        versionEl.textContent = data.version;
      }
    })
    .catch(() => {
      const versionEl = document.getElementById("app-version");
      if (versionEl) {
        versionEl.textContent = "Version inconnue";
      }
    });
}
