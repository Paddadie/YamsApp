// Sauvegarde / restauration complète des données locales dans un fichier JSON.
// Utile pour changer d'appareil ou avant de vider le cache du navigateur.
//
// Depuis la v5, le fichier ne nomme plus les données une par une : il transporte
// un dictionnaire `data` indexé par clé localStorage. Les clés communes sont
// listées ici, celles de chaque jeu viennent du registre — ajouter un jeu suffit
// donc à le faire sauvegarder, sans rouvrir ce fichier.
//
// Les fichiers d'avant la v5 restent lisibles : leurs champs nommés sont
// reconvertis en clés à la lecture (cf. legacyToData).

import { GAMES } from "../../games/registry";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson, removeKey } from "./localStore";

// 4 : ajout des préférences d'affichage.
// 5 : dictionnaire `data` indexé par clé, extensible aux jeux du registre.
const BACKUP_VERSION = 5;

// Données qui n'appartiennent à aucun jeu en particulier.
const COMMON_KEYS: string[] = [
  STORAGE_KEYS.knownNames,
  STORAGE_KEYS.playerGames,
  STORAGE_KEYS.lastRoster,
];

// Le marqueur de version de schéma n'est volontairement PAS sauvegardé : à
// l'import on le retire, pour que la migration repasse sur des données qui
// peuvent venir d'une version plus ancienne.
function allKeys(): string[] {
  return [...COMMON_KEYS, ...GAMES.flatMap((game) => game.storageKeys)];
}

// Contrôles de forme déclarés par les jeux, rassemblés par clé.
function guardFor(key: string): ((value: unknown) => boolean) | undefined {
  for (const game of GAMES) {
    const guard = game.guards?.[key];
    if (guard) return guard;
  }
  return undefined;
}

// Une donnée absente est légitime (fichier ancien, appareil neuf) ; une donnée
// présente mais de forme inattendue ne l'est pas.
function passesGuards(data: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const guard = guardFor(key);
    if (guard && !guard(value)) return false;
  }
  return true;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

export function exportAllData(): BackupData {
  const data: Record<string, unknown> = {};
  for (const key of allKeys()) {
    const value = readJson<unknown>(key);
    if (value !== null) data[key] = value;
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/* ---------- Lecture, y compris des anciens fichiers ---------- */

// Fichiers d'avant la v5 : un champ par donnée. Les noms sont figés ici, ils ne
// bougeront plus — c'est un format mort, on se contente de le lire.
const LEGACY_FIELDS: Record<string, string> = {
  knownNames: STORAGE_KEYS.knownNames,
  playerStats: STORAGE_KEYS.playerStats,
  rules: STORAGE_KEYS.rules,
  prefs: STORAGE_KEYS.prefs,
  bestScores: STORAGE_KEYS.bestScores,
  worstScores: STORAGE_KEYS.worstScores,
  savedGame: STORAGE_KEYS.savedGame,
};

function legacyToData(raw: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [field, key] of Object.entries(LEGACY_FIELDS)) {
    const value = raw[field];
    if (value !== undefined && value !== null) data[key] = value;
  }
  return data;
}

// Vérifie qu'un objet quelconque a bien la forme d'une sauvegarde, et le ramène
// au format courant. `null` si ce n'en est pas une.
export function parseBackup(value: unknown): BackupData | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const version = typeof raw.version === "number" ? raw.version : 0;
  const exportedAt = typeof raw.exportedAt === "string" ? raw.exportedAt : "";

  let data: Record<string, unknown>;
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    data = raw.data as Record<string, unknown>;
  } else if (Array.isArray(raw.knownNames)) {
    // Un fichier ancien se reconnaît à sa liste de noms connus : c'est la seule
    // donnée qu'ils ont tous, quelle que soit leur version.
    data = legacyToData(raw);
  } else {
    return null;
  }

  return passesGuards(data) ? { version, exportedAt, data } : null;
}

/* ---------- Ce qu'on annonce avant d'écraser ---------- */

// Chiffres du récapitulatif de confirmation. Volontairement générique : un jeu
// ajouté plus tard est compté sans qu'on touche à cette fonction.
export interface BackupSummary {
  players: number;
  scores: number;
  savedGames: number;
}

const lengthOf = (value: unknown): number =>
  Array.isArray(value) ? value.length : 0;

export function summarize(backup: BackupData): BackupSummary {
  const names = backup.data[STORAGE_KEYS.knownNames];
  let scores = 0;
  let savedGames = 0;
  for (const game of GAMES) {
    for (const key of game.storageKeys) {
      const value = backup.data[key];
      if (value === undefined || value === null) continue;
      if (key === game.savedGameKey) savedGames++;
      else if (Array.isArray(value)) scores += value.length;
    }
  }
  return { players: lengthOf(names), scores, savedGames };
}

/* ---------- Écriture ---------- */

// Remplace entièrement les données locales par celles de la sauvegarde : toute
// clé connue absente du fichier est effacée, sinon on mélangerait deux
// appareils.
//
// Tout ou rien : si une écriture échoue en route (stockage plein), les données
// d'avant sont remises en place et l'erreur remonte. Sans ça, l'appareil
// garderait un mélange des deux — une moitié écrasée, l'autre pas.
export function importAllData(backup: BackupData): void {
  const keys = [STORAGE_KEYS.schemaVersion, ...allKeys()];
  const before = new Map(keys.map((key) => [key, localStorage.getItem(key)]));
  try {
    // Une sauvegarde peut être ancienne : on force une re-migration au
    // prochain lancement.
    removeKey(STORAGE_KEYS.schemaVersion);
    for (const key of allKeys()) {
      const value = backup.data[key];
      const guard = guardFor(key);
      if (value === undefined || value === null || (guard && !guard(value))) {
        removeKey(key);
      } else {
        writeJson(key, value);
      }
    }
  } catch (error) {
    // Tout retirer d'abord : la place libérée garantit que l'ancien contenu,
    // qui tenait, tiendra de nouveau.
    for (const key of keys) removeKey(key);
    for (const [key, raw] of before) {
      if (raw !== null) localStorage.setItem(key, raw);
    }
    throw error;
  }
}

/* ---------- Plomberie fichier (téléchargement / lecture) ---------- */

// Renvoie le nom du fichier, que l'écran annonce.
export function downloadBackup(): string {
  const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const name = `cornet-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  a.download = name;
  // Ancre posée dans le document et URL libérée au tour suivant : Safari iOS
  // ignore un clic sur une ancre hors document, et annule le téléchargement si
  // l'URL du blob est révoquée dans la foulée.
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url));
  return name;
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
  const backup = parseBackup(parsed);
  if (!backup) return { ok: false, reason: "invalid" };
  return { ok: true, data: backup };
}
