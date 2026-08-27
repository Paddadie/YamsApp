// Écran de fin de partie : podium et tableau de classement.

import { game } from "../state";
import { showScreen } from "../navigation";
import { getVariantIcon } from "../variants";
import { clearSavedGame } from "../storage/savedGameRepo";
import { saveBestAndWorstScores } from "./hallOfFame";
import { renderTable, requireEl } from "../ui";
import type { Variant } from "../types";

const podiumSlots = [
  requireEl("podium-1"),
  requireEl("podium-2"),
  requireEl("podium-3"),
];
const rankingTable = requireEl<HTMLTableElement>("ranking-table");

interface Result {
  name: string;
  details: Record<Variant, number>;
  total: number;
}

export function initEndScreen(): void {
  requireEl("quit-btn").addEventListener("click", () => {
    saveBestAndWorstScores(game.players, game.variants);
    location.reload();
  });
}

export function showEndScreen(): void {
  const results: Result[] = game.players
    .map((player) => {
      const details = {} as Record<Variant, number>;
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
    slot.textContent = results[i]?.name ?? "";
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
