// Partie en cours : une seule entrée, lue au démarrage ("Reprendre la partie")
// et écrite à la pause.

import type { SavedGame } from "../types";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson, removeKey, hasKey } from "./localStore";

export function getSavedGame(): SavedGame | null {
  return readJson<SavedGame>(STORAGE_KEYS.savedGame);
}

export function saveSavedGame(game: SavedGame): void {
  writeJson(STORAGE_KEYS.savedGame, game);
}

export function clearSavedGame(): void {
  removeKey(STORAGE_KEYS.savedGame);
}

export function hasSavedGame(): boolean {
  return hasKey(STORAGE_KEYS.savedGame);
}
