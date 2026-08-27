// Partie en cours : une seule entrée, lue au démarrage ("Reprendre la partie")
// et écrite après chaque saisie.

import type { SavedGame } from "../types";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson, removeKey, hasKey } from "./localStore";

export function isSavedGame(value: unknown): value is SavedGame {
  if (!value || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  return (
    Array.isArray(g.players) &&
    g.players.length > 0 &&
    g.players.every(isPlayerLike) &&
    Array.isArray(g.selectedVariants) &&
    g.selectedVariants.length > 0 &&
    typeof g.currentPlayerIndex === "number" &&
    g.currentPlayerIndex >= 0 &&
    g.currentPlayerIndex < g.players.length
  );
}

function isPlayerLike(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.name === "string" &&
    typeof p.color === "string" &&
    !!p.scores &&
    typeof p.scores === "object"
  );
}

export function getSavedGame(): SavedGame | null {
  return readJson(STORAGE_KEYS.savedGame, isSavedGame);
}

export function saveSavedGame(game: SavedGame): void {
  writeJson(STORAGE_KEYS.savedGame, game);
}

export function clearSavedGame(): void {
  removeKey(STORAGE_KEYS.savedGame);
}

export function hasSavedGame(): boolean {
  return hasKey(STORAGE_KEYS.savedGame) && getSavedGame() !== null;
}
