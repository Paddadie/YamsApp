// Nombre de parties terminées par joueur sur ce téléphone. Sert à trier la
// liste des joueurs connus (les plus fréquents en premier).

import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./localStore";

export type GamesPlayed = Record<string, number>;

export function getGamesPlayed(): GamesPlayed {
  return readJson<GamesPlayed>(STORAGE_KEYS.playerStats) ?? {};
}

// Appelé quand une partie se termine (écran de fin → « Quitter »).
export function recordGamesPlayed(names: string[]): void {
  const stats = getGamesPlayed();
  for (const name of names) {
    stats[name] = (stats[name] ?? 0) + 1;
  }
  writeJson(STORAGE_KEYS.playerStats, stats);
}
