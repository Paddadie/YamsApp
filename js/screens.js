export const screensId = {
  home: "home-screen",
  hall: "hall-screen",
  players: "players-screen",
  game: "game-screen",
  end: "end-screen",
};

export const screens = {
  home: document.getElementById(screensId.home),
  hall: document.getElementById(screensId.hall),
  players: document.getElementById(screensId.players),
  game: document.getElementById(screensId.game),
  end: document.getElementById(screensId.end),
};

export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.style.display = "none");
  if (screenId == screensId.home || screenId == screensId.hall) {
    document.getElementById(screenId).style.display = "flex";
  } else {
  document.getElementById(screenId).style.display = "block";
  }
}

export function initNavigation() {
  const hallBtn = document.getElementById("hall-btn");
  const backToHomeBtn = document.getElementById("back-to-home-btn");

  hallBtn.addEventListener("click", () => {
    showScreen(screensId.hall);
    import('./hallOfFame.js').then(module => {
      module.showHallOfFame();
    });
  });

  backToHomeBtn.addEventListener("click", () => {
    showScreen(screensId.home);
  });

  showScreen(screensId.home);
}
