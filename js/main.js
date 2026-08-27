import { initNavigation } from "./navigation.js";
import { initHome } from "./home.js";
import { initPlayers } from "./players.js";
import { initGame } from "./game.js";
import { initEndScreen } from "./endScreen.js";

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initHome();
  initPlayers();
  initGame();
  initEndScreen();
});
