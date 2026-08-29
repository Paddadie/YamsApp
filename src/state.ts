// Modèle de la partie en mémoire pour la page en cours.
// En MPA, chaque page réhydrate `game` depuis le stockage à son chargement
// (voir savedGameRepo) et le ré-enregistre après chaque modification.

import type { GameRules, Player, PlayerScores, SavedGame, Variant } from "./types";
import { DEFAULT_RULES, normalizeRules } from "./scoring";

// Palette construite, pas choisie teinte par teinte : dix teintes réparties
// tous les 36°, à deux niveaux de clarté qui alternent (OKLab L = 0,865 et
// 0,935), chroma poussé au maximum que le sRGB accepte à cette clarté. Ces
// couleurs servent de fond plein écran pendant le tour d'un joueur : elles
// doivent rester très claires (contraste ≥ 13:1 avec le texte noir) et
// régulières, sinon un joueur hérite d'un écran blanc et un autre d'un écran
// franchement teinté. L'ordre avance de 144° d'un joueur au suivant pour que
// les premiers de la table tombent sur des teintes très éloignées.
export const PLAYER_COLORS = [
  "#FCC1C7", // rose
  "#A5E4BB", // vert
  "#DAC8FC", // violet
  "#EDCF92", // miel
  "#9ADEFC", // cyan
  "#FEE3D6", // abricot
  "#A4FCF8", // menthe
  "#FEDFF5", // framboise
  "#E2F3B2", // olive
  "#E0EAFE", // bleu
];

interface GameState {
  players: Player[];
  variants: Variant[];
  currentPlayerIndex: number;
  rules: GameRules;
}

export const game: GameState = {
  players: [],
  variants: [],
  currentPlayerIndex: 0,
  rules: DEFAULT_RULES,
};

function emptyScores(variants: Variant[]): PlayerScores {
  const scores = {} as PlayerScores;
  for (const variant of variants) scores[variant] = {};
  return scores;
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

export function hydrateGame(saved: SavedGame): void {
  game.players = saved.players;
  game.variants = saved.selectedVariants;
  game.currentPlayerIndex = saved.currentPlayerIndex;
  game.rules = normalizeRules(saved.rules);
}

export function toSavedGame(): SavedGame {
  return {
    players: game.players,
    selectedVariants: game.variants,
    currentPlayerIndex: game.currentPlayerIndex,
    rules: game.rules,
  };
}
