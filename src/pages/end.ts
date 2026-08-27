// Page de fin de partie : podium et classement, puis enregistrement au
// Hall of Fame quand l'utilisateur quitte.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { game, hydrateGame } from "../state";
import { getVariantIcon } from "../variants";
import { renderTable, requireEl } from "../ui";
import { getSavedGame, clearSavedGame } from "../storage/savedGameRepo";
import { clearDraft } from "../storage/draftRepo";
import { saveBestAndWorstScores } from "../hallOfFame";
import type { Variant } from "../types";

bootstrap();

const saved = getSavedGame();
if (!saved) {
  goTo("home");
  throw new Error("Aucune partie terminée à afficher : retour à l'accueil.");
}
hydrateGame(saved);
// Les données sont en mémoire : la partie n'est plus "en cours".
clearSavedGame();
clearDraft();

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

requireEl("quit-btn").addEventListener("click", () => {
  saveBestAndWorstScores(game.players, game.variants);
  goTo("home");
});

renderRanking();

function renderRanking(): void {
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
}
