// Sauvegarde / restauration complète des données locales dans un fichier JSON.
// Utile pour changer d'appareil ou avant de vider le cache du navigateur.

import type { SavedGame, ScoreEntry } from "../types";
import type { GamesPlayed } from "./playerStatsRepo";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson, removeKey } from "./localStore";

const BACKUP_VERSION = 2;

export interface BackupData {
  version: number;
  exportedAt: string;
  knownNames: string[];
  playerStats: GamesPlayed;
  bestScores: ScoreEntry[];
  worstScores: ScoreEntry[];
  savedGame: SavedGame | null;
}

/** Rassemble toutes les données locales en un objet exportable en JSON. */
export function exportAllData(): BackupData {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    knownNames: readJson<string[]>(STORAGE_KEYS.knownNames) ?? [],
    playerStats: readJson<GamesPlayed>(STORAGE_KEYS.playerStats) ?? {},
    bestScores: readJson<ScoreEntry[]>(STORAGE_KEYS.bestScores) ?? [],
    worstScores: readJson<ScoreEntry[]>(STORAGE_KEYS.worstScores) ?? [],
    savedGame: readJson<SavedGame>(STORAGE_KEYS.savedGame),
  };
}

/** Vérifie qu'un objet quelconque a bien la forme d'une sauvegarde valide. */
export function isValidBackupData(data: unknown): data is BackupData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.knownNames) &&
    Array.isArray(d.bestScores) &&
    Array.isArray(d.worstScores)
  );
}

/** Remplace entièrement les données locales par celles de la sauvegarde. */
export function importAllData(data: BackupData): void {
  writeJson(STORAGE_KEYS.knownNames, data.knownNames);
  writeJson(STORAGE_KEYS.playerStats, data.playerStats ?? {});
  writeJson(STORAGE_KEYS.bestScores, data.bestScores);
  writeJson(STORAGE_KEYS.worstScores, data.worstScores);
  if (data.savedGame) {
    writeJson(STORAGE_KEYS.savedGame, data.savedGame);
  } else {
    removeKey(STORAGE_KEYS.savedGame);
  }
}
