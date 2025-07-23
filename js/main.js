import { initNavigation } from './screens.js';
import { initPlayers } from './players.js';
import { initGame } from './scores.js';
import { initHallOfFame } from './hallOfFame.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initPlayers();
  initGame();
  initHallOfFame();
});