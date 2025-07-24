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
