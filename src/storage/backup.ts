// Sauvegarde / restauration complète des données locales dans un fichier JSON.
// Utile pour changer d'appareil ou avant de vider le cache du navigateur.

import type { GameRules, SavedGame, ScoreEntry } from "../types";
import type { PlayerStats } from "./playerStatsRepo";
import { isSavedGame } from "./savedGameRepo";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson, removeKey } from "./localStore";

const BACKUP_VERSION = 3;

export interface BackupData {
  version: number;
  exportedAt: string;
  knownNames: string[];
  playerStats: PlayerStats;
  rules: GameRules | null;
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
    playerStats: readJson<PlayerStats>(STORAGE_KEYS.playerStats) ?? {},
    rules: readJson<GameRules>(STORAGE_KEYS.rules),
    bestScores: readJson<ScoreEntry[]>(STORAGE_KEYS.bestScores) ?? [],
    worstScores: readJson<ScoreEntry[]>(STORAGE_KEYS.worstScores) ?? [],
    savedGame: readJson<SavedGame>(STORAGE_KEYS.savedGame),
  };
}

/** Vérifie qu'un objet quelconque a bien la forme d'une sauvegarde. */
export function isValidBackupData(data: unknown): data is BackupData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.knownNames) &&
    Array.isArray(d.bestScores) &&
    Array.isArray(d.worstScores) &&
    (d.savedGame == null || isSavedGame(d.savedGame))
  );
}

/** Remplace entièrement les données locales par celles de la sauvegarde. */
export function importAllData(data: BackupData): void {
  // Une sauvegarde peut être ancienne : on force une re-migration au prochain
  // lancement.
  removeKey(STORAGE_KEYS.schemaVersion);
  writeJson(STORAGE_KEYS.knownNames, data.knownNames);
  writeJson(STORAGE_KEYS.playerStats, data.playerStats ?? {});
  if (data.rules) writeJson(STORAGE_KEYS.rules, data.rules);
  else removeKey(STORAGE_KEYS.rules);
  writeJson(STORAGE_KEYS.bestScores, data.bestScores);
  writeJson(STORAGE_KEYS.worstScores, data.worstScores);
  if (data.savedGame && isSavedGame(data.savedGame)) {
    writeJson(STORAGE_KEYS.savedGame, data.savedGame);
  } else {
    removeKey(STORAGE_KEYS.savedGame);
  }
}

/* ---------- Plomberie fichier (téléchargement / lecture) ---------- */

export function downloadBackup(): void {
  const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yams-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export type ImportResult = "ok" | "invalid" | "error";

export async function importBackupFile(file: File): Promise<ImportResult> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return "error";
  }
  if (!isValidBackupData(data)) return "invalid";
  importAllData(data);
  return "ok";
}
