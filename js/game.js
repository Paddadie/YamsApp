// Écran de jeu : grille de score du joueur courant, navigation entre joueurs,
// sauvegarde / reprise de la partie.

import { game } from "./state.js";
import { showScreen, updateResumeButton } from "./navigation.js";
import { getVariantIcon } from "./variants.js";
import { saveSavedGame } from "./storage.js";
import {
  SECTIONS,
  isLineEnabled,
  updateCalculatedScores,
  calculateSpecialScore,
  isGameFinished,
} from "./scoring.js";
import { showEndScreen } from "./endScreen.js";

const scoreTablesContainer = document.getElementById("score-tables");
const currentPlayerName = document.getElementById("current-player-name");
const prevPlayerBtn = document.getElementById("prev-player-btn");
const nextPlayerBtn = document.getElementById("next-player-btn");

let autoAdvanceTimeout;

export function initGame() {
  prevPlayerBtn.addEventListener("click", () => changePlayer(-1));
  nextPlayerBtn.addEventListener("click", () => changePlayer(1));

  document.getElementById("pause-btn").addEventListener("click", () => {
    saveGame();
    showScreen("home");
    updateResumeButton();
  });
}

export function startGame() {
  game.currentPlayerIndex = 0;
  scoreTablesContainer.innerHTML = "";
  displayCurrentPlayer();
}

export function resumeGame(saved) {
  game.players = saved.players;
  game.variants = saved.selectedVariants;
  game.currentPlayerIndex = saved.currentPlayerIndex;
  displayCurrentPlayer();
}

export function saveGame() {
  saveSavedGame({
    players: game.players,
    selectedVariants: game.variants,
    currentPlayerIndex: game.currentPlayerIndex,
  });
}

function changePlayer(delta) {
  const count = game.players.length;
  game.currentPlayerIndex = (game.currentPlayerIndex + delta + count) % count;
  displayCurrentPlayer();
}

function displayCurrentPlayer() {
  const player = game.players[game.currentPlayerIndex];
  currentPlayerName.textContent = player.name;
  scoreTablesContainer.innerHTML = "";

  const table = document.createElement("table");
  table.className = "score-table";

  const headerRow = document.createElement("tr");
  headerRow.innerHTML =
    "<th></th>" +
    game.variants
      .map((v) => `<th title="${v}">${getVariantIcon(v)}</th>`)
      .join("");
  table.appendChild(headerRow);

  for (const section of SECTIONS) {
    for (const lineName in section) {
      const values = section[lineName];
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = lineName;
      row.appendChild(nameCell);

      for (const variant of game.variants) {
        const cell = document.createElement("td");
        const scores = player.scores[variant];

        if (values.length > 0) {
          fillScoreCell(cell, lineName, variant, values, scores);
        } else {
          cell.textContent = calculateSpecialScore(lineName, scores);
        }

        row.appendChild(cell);
      }

      table.appendChild(row);

      if (lineName === "Total Haut" || lineName === "Total Bas") {
        table.appendChild(buildSpacerRow());
      }
    }
  }

  const wrapper = document.createElement("div");
  wrapper.className = "score-wrapper";
  wrapper.style.backgroundColor = player.color;
  wrapper.appendChild(table);
  scoreTablesContainer.appendChild(wrapper);
}

function fillScoreCell(cell, lineName, variant, values, scores) {
  const select = document.createElement("select");
  select.className = "score-select";
  select.innerHTML =
    `<option value="">--</option>` +
    values.map((v) => `<option value="${v}">${v}</option>`).join("");
  select.value = scores[lineName] !== undefined ? scores[lineName] : "";

  const enabled =
    variant === "Montante" || variant === "Descendante"
      ? isLineEnabled(lineName, variant, scores)
      : true;

  select.disabled = !enabled;
  select.setAttribute("aria-disabled", !enabled);
  if (!enabled) {
    cell.classList.add("disabled-cell");
    select.title = "Remplissez d’abord la ligne précédente.";
  }

  select.addEventListener("change", () => {
    if (select.value === "") {
      delete scores[lineName];
    } else {
      const num = parseInt(select.value, 10);
      scores[lineName] = isNaN(num) ? undefined : num;
    }

    updateCalculatedScores(scores);

    clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = setTimeout(() => {
      if (isGameFinished(game.players, game.variants)) {
        showEndScreen();
      } else {
        nextPlayerBtn.click();
      }
    }, 800);

    displayCurrentPlayer();
  });

  cell.appendChild(select);
}

function buildSpacerRow() {
  const spacerRow = document.createElement("tr");
  spacerRow.className = "spacer-row";
  const spacerCell = document.createElement("td");
  spacerCell.colSpan = game.variants.length + 1;
  spacerRow.appendChild(spacerCell);
  return spacerRow;
}
