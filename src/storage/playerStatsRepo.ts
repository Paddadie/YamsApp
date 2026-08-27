// Statistiques par joueur sur ce téléphone.
//  - `games` : toutes variantes confondues (sert au tri des joueurs connus).
//  - `classiqueGames` / `classiquePoints` : uniquement les parties classiques,
//    pour une moyenne pertinente (les autres variantes produisent trop souvent
//    des scores catastrophiques).

import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./localStore";

export interface PlayerStat {
  games: number;
  classiqueGames: number;
  classiquePoints: number;
}
export type PlayerStats = Record<string, PlayerStat>;

// Lecture tolérante : accepte l'ancien format `{ [nom]: nombreDeParties }` et
// le format intermédiaire `{ games, points }`.
export function getPlayerStats(): PlayerStats {
  const raw = readJson<Record<string, unknown>>(STORAGE_KEYS.playerStats) ?? {};
  const stats: PlayerStats = {};
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      stats[name] = { games: value, classiqueGames: 0, classiquePoints: 0 };
    } else if (value && typeof value === "object") {
      const s = value as Record<string, unknown>;
      stats[name] = {
        games: typeof s.games === "number" ? s.games : 0,
        classiqueGames:
          typeof s.classiqueGames === "number" ? s.classiqueGames : 0,
        classiquePoints:
          typeof s.classiquePoints === "number" ? s.classiquePoints : 0,
      };
    }
  }
  return stats;
}

// Appelé quand une partie se termine (écran de fin → « Quitter »).
// `classiqueScore` : le score final classique du joueur, ou null si la partie
// ne comportait pas la variante Classique.
export function recordGameResult(
  results: { name: string; classiqueScore: number | null }[],
): void {
  const stats = getPlayerStats();
  for (const { name, classiqueScore } of results) {
    const s = stats[name] ?? {
      games: 0,
      classiqueGames: 0,
      classiquePoints: 0,
    };
    stats[name] = {
      games: s.games + 1,
      classiqueGames: s.classiqueGames + (classiqueScore !== null ? 1 : 0),
      classiquePoints: s.classiquePoints + (classiqueScore ?? 0),
    };
  }
  writeJson(STORAGE_KEYS.playerStats, stats);
}
