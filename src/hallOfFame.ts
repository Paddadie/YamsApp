// Logique du Hall of Fame : intégration des scores d'une partie terminée dans
// les tops "meilleurs" et "pires" (5 entrées chacun). Sans DOM.

import type { Player, ScoreEntry, Variant } from "./types";
import {
  getBestScores,
  getWorstScores,
  saveBestScores,
  saveWorstScores,
} from "./storage/hallOfFameRepo";

export function saveBestAndWorstScores(
  players: Player[],
  variants: Variant[],
): void {
  const date = new Date().toLocaleDateString("fr-FR");

  const newScores: ScoreEntry[] = [];
  for (const player of players) {
    for (const variant of variants) {
      const score = player.scores?.[variant]?.["Score Final"];
      if (typeof score === "number") {
        newScores.push({ name: player.name, score, date });
      }
    }
  }

  const best = [...getBestScores(), ...newScores].sort((a, b) => b.score - a.score);
  saveBestScores(best.slice(0, 5));

  const worst = [...getWorstScores(), ...newScores].sort((a, b) => a.score - b.score);
  saveWorstScores(worst.slice(0, 5));
}
