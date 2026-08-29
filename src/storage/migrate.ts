// Migration des données stockées par d'anciennes versions vers le format
// courant. Exécutée une fois par version (marqueur `schemaVersion`), puis plus
// rien : les lancements suivants ne font qu'une lecture.
//
// Non destructive : les clés localStorage n'ont jamais changé, donc rien n'est
// perdu. On ne supprime que sur du JSON illisible ; sinon on complète / répare
// la forme, ou on laisse tel quel (le guard de lecture renverra null).

import { STORAGE_KEYS } from "./keys";
import { writeJson } from "./localStore";
import { normalizeRules } from "../scoring";
import { getPlayerStats } from "./playerStatsRepo";
import { isSavedGame } from "./savedGameRepo";
import type { ScoreEntry } from "../types";

// v2 : le tableau des pires scores ne garde que les parties classiques.
// v3 : stats joueurs → { games, classiqueGames, classiquePoints }.
// v4 : ajout de `classiqueBest` aux stats joueurs.
const SCHEMA_VERSION = 4;

export function migrateStorage(): void {
  const done = Number(localStorage.getItem(STORAGE_KEYS.schemaVersion));
  if (Number.isFinite(done) && done >= SCHEMA_VERSION) return;

  migrateRules();
  migratePlayerStats();
  migrateSavedGame();
  migrateScoreList(STORAGE_KEYS.bestScores);
  migrateScoreList(STORAGE_KEYS.worstScores, true);
  migrateKnownNames();

  localStorage.setItem(STORAGE_KEYS.schemaVersion, String(SCHEMA_VERSION));
}

// Lit et parse une clé. `undefined` si absente ou illisible (dans ce cas la
// clé — des octets corrompus — est retirée, c'est la seule suppression).
function parse(key: string): unknown | undefined {
  const raw = localStorage.getItem(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(key);
    return undefined;
  }
}

// Règles : ancien format (full/suites/yams = nombres, pas de `bonus`), valeurs
// hors bornes… → forme canonique.
function migrateRules(): void {
  const raw = parse(STORAGE_KEYS.rules);
  if (raw !== undefined) writeJson(STORAGE_KEYS.rules, normalizeRules(raw));
}

// Stats joueurs : anciens formats (`{ [nom]: nombreDeParties }`, `{ games,
// points }`) → forme canonique. L'ancien cumul `points` (toutes variantes)
// n'est pas repris : la moyenne classique repart des prochaines parties.
function migratePlayerStats(): void {
  if (localStorage.getItem(STORAGE_KEYS.playerStats) !== null) {
    writeJson(STORAGE_KEYS.playerStats, getPlayerStats());
  }
}

// Partie en cours : ajoute le champ `rules` (absent avant les paramètres).
// Si la forme est inattendue, on laisse la valeur en place (getSavedGame la
// filtrera) plutôt que de risquer de perdre une partie légitime.
function migrateSavedGame(): void {
  const raw = parse(STORAGE_KEYS.savedGame);
  if (raw === undefined || !isSavedGame(raw)) return;
  writeJson(STORAGE_KEYS.savedGame, {
    ...raw,
    rules: normalizeRules((raw as { rules?: unknown }).rules),
  });
}

// Hall of Fame : complète les champs manquants, jette les entrées sans score
// exploitable (évite qu'une seule entrée cassée fasse rejeter toute la liste
// à la lecture). `onlyClassique` : jette aussi les entrées explicitement
// non classiques (les entrées sans variante — anciennes — sont conservées).
function migrateScoreList(key: string, onlyClassique = false): void {
  const raw = parse(key);
  if (!Array.isArray(raw)) return;

  const clean: ScoreEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.name !== "string") continue;
    if (
      onlyClassique &&
      typeof e.variant === "string" &&
      e.variant !== "Classique"
    ) {
      continue;
    }
    const score =
      typeof e.score === "number" ? e.score : Number(e.score);
    if (!Number.isFinite(score)) continue;
    clean.push({
      name: e.name,
      score,
      date: typeof e.date === "string" ? e.date : "",
      ...(typeof e.variant === "string" ? { variant: e.variant as never } : {}),
      ...(e.sheet && typeof e.sheet === "object"
        ? { sheet: e.sheet as never }
        : {}),
      ...(Array.isArray(e.lineOrder) ? { lineOrder: e.lineOrder as never } : {}),
    });
  }
  writeJson(key, clean);
}

// Joueurs connus : retire les doublons de casse/espaces accumulés par les
// anciennes versions (« Jean », « jean », « Jean  »).
function migrateKnownNames(): void {
  const raw = parse(STORAGE_KEYS.knownNames);
  if (!Array.isArray(raw)) return;

  const seen = new Set<string>();
  const clean: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const name = value.trim();
    const fold = name.toLowerCase();
    if (!name || seen.has(fold)) continue;
    seen.add(fold);
    clean.push(name);
  }
  clean.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  writeJson(STORAGE_KEYS.knownNames, clean);
}
