// Modèle de la partie en mémoire pour la page en cours.
// En MPA, chaque page réhydrate `game` depuis le stockage à son chargement
// (voir savedGameRepo) et le ré-enregistre après chaque modification.

import type { GameRules, Player, PlayerScores, SavedGame, Variant } from "./types";
import { DEFAULT_RULES, normalizeRules } from "./scoring";

export const PLAYER_COLORS = [
  "#FADADD",
  "#AEC6CF",
  "#BFD8B8",
  "#FFFACD",
  "#E6E6FA",
  "#FFDAB9",
  "#AAF0D1",
  "#D8B7DD",
  "#FFBCB3",
  "#C1D3D8",
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

export function createPlayers(names: string[], variants: Variant[]): Player[] {
  return names.map((name, i) => ({
    name,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
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
