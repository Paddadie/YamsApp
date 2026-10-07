// Joueurs d'une nouvelle partie de Yams : une feuille vide par variante jouée.
//
// Il n'y a pas d'état de partie en mémoire à part : les écrans travaillent
// directement sur la partie sauvegardée (savedGameRepo), comme ceux du 5000, et
// la réécrivent après chaque modification.

import type { LineScores, Player, PlayerScores, Variant } from "./types";
import { PLAYER_COLORS } from "../../core/playerColors";

// Une partie ne porte que les variantes jouées, pas les quatre (cf.
// PlayerScores).
function emptyScores(variants: Variant[]): PlayerScores {
  const scores: PlayerScores = {};
  for (const variant of variants) scores[variant] = {};
  return scores;
}

// La feuille d'un joueur pour une variante de la partie. Chaque variante jouée
// a la sienne dès le lancement : en demander une autre est une erreur de
// programmation, qu'on préfère voir tout de suite plutôt qu'écrire dans le
// vide.
export function sheetOf(player: Player, variant: Variant): LineScores {
  const sheet = player.scores[variant];
  if (!sheet) throw new Error(`${player.name} n'a pas de feuille ${variant}`);
  return sheet;
}

// `colors` : couleur déjà attribuée à chaque joueur sur l'écran de sélection
// (elle suit le joueur, pas sa place dans l'ordre de passage). À défaut, on
// retombe sur l'ordre de passage.
export function createPlayers(
  names: string[],
  variants: Variant[],
  colors?: string[],
): Player[] {
  return names.map((name, i) => ({
    name,
    color: colors?.[i] ?? PLAYER_COLORS[i % PLAYER_COLORS.length],
    scores: emptyScores(variants),
  }));
}
