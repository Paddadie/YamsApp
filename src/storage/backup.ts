// Sauvegarde / restauration complète des données locales dans un fichier JSON.
// Utile pour changer d'appareil ou avant de vider le cache du navigateur.

import type { GameRules, SavedGame, ScoreEntry } from "../types";
import type { PlayerStats } from "./playerStatsRepo";
import type { Prefs } from "./prefsRepo";
import { isSavedGame } from "./savedGameRepo";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson, removeKey } from "./localStore";

// 4 : ajout des préférences d'affichage. Un fichier plus ancien reste
// lisible, ses préférences retombent simplement sur les valeurs par défaut.
const BACKUP_VERSION = 4;

export interface BackupData {
  version: number;
  exportedAt: string;
  knownNames: string[];
  playerStats: PlayerStats;
  rules: GameRules | null;
  prefs: Prefs | null;
  bestScores: ScoreEntry[];
  worstScores: ScoreEntry[];
  savedGame: SavedGame | null;
}

// Rassemble toutes les données locales en un objet exportable en JSON.
export function exportAllData(): BackupData {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    knownNames: readJson<string[]>(STORAGE_KEYS.knownNames) ?? [],
    playerStats: readJson<PlayerStats>(STORAGE_KEYS.playerStats) ?? {},
    rules: readJson<GameRules>(STORAGE_KEYS.rules),
    prefs: readJson<Prefs>(STORAGE_KEYS.prefs),
    bestScores: readJson<ScoreEntry[]>(STORAGE_KEYS.bestScores) ?? [],
    worstScores: readJson<ScoreEntry[]>(STORAGE_KEYS.worstScores) ?? [],
    savedGame: readJson<SavedGame>(STORAGE_KEYS.savedGame),
  };
}

// Vérifie qu'un objet quelconque a bien la forme d'une sauvegarde.
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

// Remplace entièrement les données locales par celles de la sauvegarde.
export function importAllData(data: BackupData): void {
  // Une sauvegarde peut être ancienne : on force une re-migration au prochain
  // lancement.
  removeKey(STORAGE_KEYS.schemaVersion);
  writeJson(STORAGE_KEYS.knownNames, data.knownNames);
  writeJson(STORAGE_KEYS.playerStats, data.playerStats ?? {});
  if (data.rules) writeJson(STORAGE_KEYS.rules, data.rules);
  else removeKey(STORAGE_KEYS.rules);
  // Absentes d'une sauvegarde d'avant la version 4 : on efface plutôt que de
  // garder celles de l'appareil, comme pour tout le reste de l'import.
  if (data.prefs) writeJson(STORAGE_KEYS.prefs, data.prefs);
  else removeKey(STORAGE_KEYS.prefs);
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
  // Ancre posée dans le document et URL libérée au tour suivant : Safari iOS
  // ignore un clic sur une ancre hors document, et annule le téléchargement si
  // l'URL du blob est révoquée dans la foulée.
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url));
}

// Lecture SANS écriture : l'écran des paramètres valide d'abord le fichier,
// montre ce qu'il contient, puis n'appelle importAllData() qu'après
// confirmation — l'import écrase toutes les données locales.
export type ReadResult =
  | { ok: true; data: BackupData }
  | { ok: false; reason: "invalid" | "unreadable" };

export async function readBackupFile(file: File): Promise<ReadResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (!isValidBackupData(parsed)) return { ok: false, reason: "invalid" };
  return { ok: true, data: parsed };
}
