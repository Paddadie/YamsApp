// Nombre de parties terminées par joueur, TOUS JEUX CONFONDUS.
//
// Séparé des statistiques d'un jeu (playerStatsRepo du Yams) parce que ce
// compteur-là est commun : il sert à trier les joueurs connus dans l'écran de
// sélection, et quelqu'un qui n'a joué qu'au 5000 doit remonter dans la liste
// quand on lance une partie de Yams.
//
// Une entrée par joueur, casse et espaces ignorés — même règle que
// knownPlayersRepo et playerStatsRepo, sinon « Jean » et « jean » comptent deux
// fois et un renommage laisse un joueur fantôme.

import { sameName } from "../playerName";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./localStore";

export type PlayerGames = Record<string, number>;

const isCountMap = (v: unknown): v is PlayerGames =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.values(v).every((n) => typeof n === "number" && Number.isFinite(n));

export function getPlayerGames(): PlayerGames {
  return readJson(STORAGE_KEYS.playerGames, isCountMap) ?? {};
}

function keyFor(games: PlayerGames, name: string): string | undefined {
  return Object.keys(games).find((k) => sameName(k, name));
}

export function gamesPlayed(games: PlayerGames, name: string): number {
  const key = keyFor(games, name);
  return key === undefined ? 0 : games[key];
}

// Appelé une fois par partie terminée, quel que soit le jeu.
export function recordGamesPlayed(names: string[]): void {
  const games = getPlayerGames();
  for (const name of names) {
    const key = keyFor(games, name) ?? name;
    games[key] = (games[key] ?? 0) + 1;
  }
  writeJson(STORAGE_KEYS.playerGames, games);
}

export function removePlayerGames(name: string): void {
  const games = getPlayerGames();
  let changed = false;
  for (const key of Object.keys(games)) {
    if (!sameName(key, name)) continue;
    delete games[key];
    changed = true;
  }
  if (changed) writeJson(STORAGE_KEYS.playerGames, games);
}

// Fusionne si le nom cible existe déjà. La source est retirée AVANT de chercher
// la cible : sans ça, une simple correction de casse (« jean » → « Jean ») se
// fusionnerait avec elle-même.
export function renamePlayerGames(oldName: string, newName: string): void {
  if (oldName === newName) return;
  const games = getPlayerGames();

  let moved = 0;
  let found = false;
  for (const key of Object.keys(games)) {
    if (!sameName(key, oldName)) continue;
    moved += games[key];
    delete games[key];
    found = true;
  }
  if (!found) return;

  for (const key of Object.keys(games)) {
    if (!sameName(key, newName)) continue;
    moved += games[key];
    delete games[key];
  }
  games[newName] = moved;
  writeJson(STORAGE_KEYS.playerGames, games);
}

// Rassemble les compteurs d'entrées qui ne diffèrent que par la casse ou les
// espaces. Utilisée par la migration qui extrait ce compteur des stats Yams.
export function dedupePlayerGames(games: PlayerGames): PlayerGames {
  const merged: PlayerGames = {};
  for (const [name, count] of Object.entries(games)) {
    const key = keyFor(merged, name) ?? name.trim();
    merged[key] = (merged[key] ?? 0) + count;
  }
  return merged;
}
