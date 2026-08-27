// Écran de fin de partie : podium et tableau de classement.

import { game } from "./state.js";
import { showScreen } from "./navigation.js";
import { getVariantIcon } from "./variants.js";
import { clearSavedGame } from "./storage.js";
import { saveBestAndWorstScores } from "./hallOfFame.js";
import { renderTable } from "./ui.js";

const podiumSlots = [
  document.getElementById("podium-1"),
  document.getElementById("podium-2"),
  document.getElementById("podium-3"),
];
const rankingTable = document.getElementById("ranking-table");

export function initEndScreen() {
  document.getElementById("quit-btn").addEventListener("click", () => {
    saveBestAndWorstScores(game.players, game.variants);
    location.reload();
  });
}

export function showEndScreen() {
  const results = game.players
    .map((player) => {
      const details = {};
      let total = 0;
      for (const variant of game.variants) {
        const score = player.scores[variant]["Score Final"] || 0;
        details[variant] = score;
        total += score;
      }
      return { name: player.name, details, total };
    })
    .sort((a, b) => b.total - a.total);

  podiumSlots.forEach((slot, i) => {
    slot.textContent = results[i]?.name || "";
  });

  const headers = ["🥇", "Joueur", ...game.variants.map(getVariantIcon), "Total"];
  const rows = results.map((r, i) => [
    `${i + 1}.`,
    r.name,
    ...game.variants.map((v) => r.details[v]),
    { strong: r.total },
  ]);
  renderTable(rankingTable, headers, rows);

  clearSavedGame();
  showScreen("end");
}
