// Page de jeu : grille de score du joueur courant, navigation entre joueurs,
// sauvegarde continue de la partie.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { game, hydrateGame, toSavedGame } from "../state";
import { getVariantIcon, getVariantColor } from "../variants";
import { requireEl } from "../ui";
import { getSavedGame, saveSavedGame } from "../storage/savedGameRepo";
import {
  SECTIONS,
  isLineEnabled,
  updateCalculatedScores,
  calculateSpecialScore,
  isGameFinished,
} from "../scoring";
import type { LineName, Variant } from "../types";

type LineScores = Record<LineName, number>;

bootstrap();

const saved = getSavedGame();
if (!saved) {
  goTo("home");
  throw new Error("Aucune partie en cours : retour à l'accueil.");
}
hydrateGame(saved);

const gameScreen = requireEl("game-screen");
const scoreTablesContainer = requireEl("score-tables");
const currentPlayerName = requireEl("current-player-name");
const prevPlayerBtn = requireEl("prev-player-btn");
const nextPlayerBtn = requireEl("next-player-btn");

let autoAdvanceTimeout: ReturnType<typeof setTimeout> | undefined;

prevPlayerBtn.addEventListener("click", () => changePlayer(-1));
nextPlayerBtn.addEventListener("click", () => changePlayer(1));

requireEl("pause-btn").addEventListener("click", () => {
  persist();
  goTo("home");
});

displayCurrentPlayer();

function persist(): void {
  saveSavedGame(toSavedGame());
}

function changePlayer(delta: number): void {
  const count = game.players.length;
  game.currentPlayerIndex = (game.currentPlayerIndex + delta + count) % count;
  persist();
  displayCurrentPlayer();
}

function displayCurrentPlayer(): void {
  const player = game.players[game.currentPlayerIndex];
  currentPlayerName.textContent = player.name;
  // Toute la page prend la couleur du joueur courant.
  gameScreen.style.backgroundColor = player.color;
  scoreTablesContainer.innerHTML = "";

  const table = document.createElement("table");
  table.className = "score-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.appendChild(document.createElement("th")); // coin vide
  for (const variant of game.variants) {
    const th = document.createElement("th");
    th.title = variant;
    const icon = document.createElement("span");
    icon.className = "variant-icon";
    icon.style.setProperty("--vc", getVariantColor(variant));
    icon.textContent = getVariantIcon(variant);
    th.appendChild(icon);
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  let dataRowIndex = 0;
  let sectionIndex = 0;

  for (const { label, lines } of SECTIONS) {
    if (label) tbody.appendChild(buildSectionHead(label, sectionIndex > 0));
    sectionIndex++;

    for (const lineName in lines) {
      const values = lines[lineName];
      const isComputed = values.length === 0;
      const row = document.createElement("tr");
      if (isComputed) row.classList.add("computed");
      if (lineName === "Score Final") row.classList.add("final");
      if (!isComputed && dataRowIndex++ % 2 === 1) row.classList.add("alt");

      const nameCell = document.createElement("td");
      nameCell.textContent = lineName;
      row.appendChild(nameCell);

      for (const variant of game.variants) {
        const cell = document.createElement("td");
        const scores = player.scores[variant];

        if (isComputed) {
          cell.textContent = String(calculateSpecialScore(lineName, scores));
        } else {
          fillScoreCell(cell, lineName, variant, values, scores);
        }

        row.appendChild(cell);
      }

      tbody.appendChild(row);
    }
  }

  table.appendChild(tbody);

  const wrapper = document.createElement("div");
  wrapper.className = "score-wrapper";
  wrapper.appendChild(table);
  scoreTablesContainer.appendChild(wrapper);
}

function buildSectionHead(label: string, major: boolean): HTMLTableRowElement {
  const row = document.createElement("tr");
  row.className = major ? "section-head section-head--major" : "section-head";
  const cell = document.createElement("td");
  cell.colSpan = game.variants.length + 1;
  cell.textContent = label;
  row.appendChild(cell);
  return row;
}

function fillScoreCell(
  cell: HTMLTableCellElement,
  lineName: LineName,
  variant: Variant,
  values: number[],
  scores: LineScores,
): void {
  const current = scores[lineName];

  const select = document.createElement("select");
  select.className =
    current !== undefined ? "score-select is-filled" : "score-select is-empty";
  select.innerHTML =
    `<option value="">–</option>` +
    values.map((v) => `<option value="${v}">${v}</option>`).join("");
  select.value = current !== undefined ? String(current) : "";

  const enabled =
    variant === "Montante" || variant === "Descendante"
      ? isLineEnabled(lineName, variant, scores)
      : true;
  select.disabled = !enabled;
  if (!enabled) select.title = "Remplissez d’abord la ligne précédente.";

  select.addEventListener("change", () => {
    if (select.value === "") {
      delete scores[lineName];
    } else {
      const num = parseInt(select.value, 10);
      if (isNaN(num)) delete scores[lineName];
      else scores[lineName] = num;
    }

    updateCalculatedScores(scores);
    persist();

    clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = setTimeout(() => {
      if (isGameFinished(game.players, game.variants)) {
        persist();
        goTo("end");
      } else {
        nextPlayerBtn.click();
      }
    }, 800);

    displayCurrentPlayer();
  });

  cell.appendChild(select);
}
