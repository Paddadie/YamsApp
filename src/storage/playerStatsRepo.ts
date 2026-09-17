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

const EMPTY_STAT: PlayerStat = {
  games: 0,
  classiqueGames: 0,
  classiquePoints: 0,
  classiqueBest: 0,
};

// Un joueur = une entrée, quelle que soit la casse : les écritures cherchent la
// clé existante au lieu d'en créer une seconde (« Jean » et « jean »).
function keyFor(stats: PlayerStats, name: string): string | undefined {
  return Object.keys(stats).find((k) => sameName(k, name));
}

function mergeStat(a: PlayerStat, b: PlayerStat): PlayerStat {
  return {
    games: a.games + b.games,
    classiqueGames: a.classiqueGames + b.classiqueGames,
    classiquePoints: a.classiquePoints + b.classiquePoints,
    classiqueBest: Math.max(a.classiqueBest, b.classiqueBest),
  };
}

// Fusionne les entrées qui ne diffèrent que par la casse ou les espaces,
// héritées des versions qui écrivaient la clé telle qu'elle était saisie. La
// première forme rencontrée fait foi. Appelée par la migration.
export function dedupePlayerStats(stats: PlayerStats): PlayerStats {
  const merged: PlayerStats = {};
  for (const [name, stat] of Object.entries(stats)) {
    const key = keyFor(merged, name) ?? name.trim();
    merged[key] = merged[key] ? mergeStat(merged[key], stat) : stat;
  }
  return merged;
}

// Appelé à l'arrivée sur l'écran de fin (pas au clic sur « Quitter ») : une
// partie terminée ne doit pas être perdue si l'appli est fermée là.
// `classiqueScore` : le score final classique du joueur, ou null si la partie
// ne comportait pas la variante Classique.
export function recordGameResult(
  results: { name: string; classiqueScore: number | null }[],
): void {
  const stats = getPlayerStats();
  for (const { name, classiqueScore } of results) {
    const key = keyFor(stats, name) ?? name;
    const s = stats[key] ?? EMPTY_STAT;
    stats[key] = {
      games: s.games + 1,
      classiqueGames: s.classiqueGames + (classiqueScore !== null ? 1 : 0),
      classiquePoints: s.classiquePoints + (classiqueScore ?? 0),
      classiqueBest: Math.max(s.classiqueBest, classiqueScore ?? 0),
    };
  }
  writeJson(STORAGE_KEYS.playerStats, stats);
}

// Retire du lot toutes les entrées portant ce nom (casse / espaces ignorés :
// d'anciennes données peuvent contenir des clés dépareillées) et renvoie leur
// fusion, ou `undefined` si le joueur n'y figure pas.
function takeStat(stats: PlayerStats, name: string): PlayerStat | undefined {
  let taken: PlayerStat | undefined;
  for (const key of Object.keys(stats)) {
    if (!sameName(key, name)) continue;
    taken = taken ? mergeStat(taken, stats[key]) : stats[key];
    delete stats[key];
  }
  return taken;
}

export function removePlayerStats(name: string): void {
  const stats = getPlayerStats();
  if (!takeStat(stats, name)) return;
  writeJson(STORAGE_KEYS.playerStats, stats);
}

// Déplace les stats sous un autre nom (renommage). Fusionne si le nom cible
// existe déjà. La source est retirée AVANT de chercher la cible : sans ça, une
// simple correction de casse (« jean » → « Jean ») se fusionnerait avec
// elle-même.
export function renamePlayerStats(oldName: string, newName: string): void {
  if (newName === oldName) return;
  const stats = getPlayerStats();
  const from = takeStat(stats, oldName);
  if (!from) return;
  const into = takeStat(stats, newName);
  stats[newName] = into ? mergeStat(into, from) : from;
  writeJson(STORAGE_KEYS.playerStats, stats);
}
