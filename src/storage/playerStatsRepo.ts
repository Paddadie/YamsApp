// Statistiques par joueur sur ce téléphone.
//  - `games` : toutes variantes confondues (sert au tri des joueurs connus).
//  - `classiqueGames` / `classiquePoints` : uniquement les parties classiques,
//    pour une moyenne pertinente (les autres variantes produisent trop souvent
//    des scores catastrophiques).

import { sameName } from "../playerName";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./localStore";

export interface PlayerStat {
  games: number;
  classiqueGames: number;
  classiquePoints: number;
  classiqueBest: number; // meilleur score final classique (0 = jamais)
}
export type PlayerStats = Record<string, PlayerStat>;

// Lecture tolérante : accepte l'ancien format `{ [nom]: nombreDeParties }` et
// les formats intermédiaires (`{ games, points }`, sans `classiqueBest`).
export function getPlayerStats(): PlayerStats {
  const raw = readJson<Record<string, unknown>>(STORAGE_KEYS.playerStats) ?? {};
  const stats: PlayerStats = {};
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      stats[name] = {
        games: value,
        classiqueGames: 0,
        classiquePoints: 0,
        classiqueBest: 0,
      };
    } else if (value && typeof value === "object") {
      const s = value as Record<string, unknown>;
      stats[name] = {
        games: typeof s.games === "number" ? s.games : 0,
        classiqueGames:
          typeof s.classiqueGames === "number" ? s.classiqueGames : 0,
        classiquePoints:
          typeof s.classiquePoints === "number" ? s.classiquePoints : 0,
        classiqueBest:
          typeof s.classiqueBest === "number" ? s.classiqueBest : 0,
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
      classiqueBest: 0,
    };
    stats[name] = {
      games: s.games + 1,
      classiqueGames: s.classiqueGames + (classiqueScore !== null ? 1 : 0),
      classiquePoints: s.classiquePoints + (classiqueScore ?? 0),
      classiqueBest: Math.max(s.classiqueBest, classiqueScore ?? 0),
    };
  }
  writeJson(STORAGE_KEYS.playerStats, stats);
}

// Supprime toute entrée correspondant à ce nom (casse / espaces ignorés :
// d'anciennes données peuvent contenir des clés dépareillées).
export function removePlayerStats(name: string): void {
  const stats = getPlayerStats();
  let changed = false;
  for (const existing of Object.keys(stats)) {
    if (sameName(existing, name)) {
      delete stats[existing];
      changed = true;
    }
  }
  if (changed) writeJson(STORAGE_KEYS.playerStats, stats);
}

// Déplace les stats sous un autre nom (renommage). Fusionne si le nom cible
// existe déjà.
export function renamePlayerStats(oldName: string, newName: string): void {
  if (newName === oldName) return;
  const stats = getPlayerStats();
  const from = stats[oldName];
  if (!from) return;
  const into = stats[newName];
  stats[newName] = into
    ? {
        games: into.games + from.games,
        classiqueGames: into.classiqueGames + from.classiqueGames,
        classiquePoints: into.classiquePoints + from.classiquePoints,
        classiqueBest: Math.max(into.classiqueBest, from.classiqueBest),
      }
    : from;
  delete stats[oldName];
  writeJson(STORAGE_KEYS.playerStats, stats);
}
