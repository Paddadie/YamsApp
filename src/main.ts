import "./style.css";
import { initUpdatePrompt } from "./pwa/updatePrompt";
import { initNavigation } from "./navigation";
import { initHome } from "./screens/home";
import { initPlayers } from "./screens/players";
import { initGame } from "./screens/game";
import { initEndScreen } from "./screens/endScreen";
import { initHallOfFame } from "./screens/hallOfFame";

initUpdatePrompt();

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initHome();
  initPlayers();
  initGame();
  initEndScreen();
  initHallOfFame();
});
