// Statistiques par joueur sur ce téléphone : nombre de parties terminées et
// cumul des scores (pour la moyenne). Sert au tri des joueurs connus et à
// l'écran Statistiques du Hall of Fame.

import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./localStore";

export interface PlayerStat {
  games: number;
  points: number; // somme des totaux de partie (0 = inconnu, ancien format)
}
export type PlayerStats = Record<string, PlayerStat>;

// Lecture tolérante : accepte l'ancien format `{ [nom]: nombreDeParties }`.
export function getPlayerStats(): PlayerStats {
  const raw = readJson<Record<string, unknown>>(STORAGE_KEYS.playerStats) ?? {};
  const stats: PlayerStats = {};
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      stats[name] = { games: value, points: 0 };
    } else if (value && typeof value === "object") {
      const s = value as Record<string, unknown>;
      stats[name] = {
        games: typeof s.games === "number" ? s.games : 0,
        points: typeof s.points === "number" ? s.points : 0,
      };
    }
  }
  return stats;
}

// Appelé quand une partie se termine (écran de fin → « Quitter »).
export function recordGameResult(
  results: { name: string; total: number }[],
): void {
  const stats = getPlayerStats();
  for (const { name, total } of results) {
    const s = stats[name] ?? { games: 0, points: 0 };
    stats[name] = { games: s.games + 1, points: s.points + total };
  }
  writeJson(STORAGE_KEYS.playerStats, stats);
}
