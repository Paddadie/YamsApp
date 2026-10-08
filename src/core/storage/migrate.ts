// Migration des données stockées par d'anciennes versions vers le format
// courant. Exécutée une fois par version (marqueur `schemaVersion`), puis plus
// rien : les lancements suivants ne font qu'une lecture.
//
// Les clés localStorage n'ont jamais changé : rien n'est perdu au passage
// d'une version à l'autre. On complète / répare la forme, ou on laisse tel quel
// (le guard de lecture renverra null). Les seules suppressions sont délibérées
// et documentées à l'endroit où elles se font : du JSON illisible, et les
// entrées de pires scores devenues hors sujet (cf. migrateScoreList).
//
// Ce module vit dans `core/` mais connaît les jeux : migrer, c'est par nature
// connaître tous les formats de l'application. Les imports vers `games/` sont
// donc volontaires et non une entorse à la règle de dépendance. Tant qu'il n'y
// a que deux jeux, ils restent écrits en clair ici ; si un troisième rend ce
// fichier pénible, chaque jeu déclarera sa propre migration et celle-ci se
// contentera de les enchaîner.

import { compareNames, foldName } from "../playerName";
import { isoFromFrench } from "../dates";
import { STORAGE_KEYS } from "./keys";
import { writeJson } from "./localStore";
import { dedupePlayerGames, type PlayerGames } from "./playerGamesRepo";
import { normalizeRules } from "../../games/yams/scoring";
import {
  dedupePlayerStats,
  getPlayerStats,
} from "../../games/yams/storage/playerStatsRepo";
import { isSavedGame } from "../../games/yams/storage/savedGameRepo";
import {
  convertSheet,
  lineIdOf,
  rulesFromLabels,
} from "../../games/yams/legacyLines";
import type {
  LineName,
  LineScores,
  Player,
  ScoreEntry,
  Variant,
} from "../../games/yams/types";

// v2 : le tableau des pires scores ne garde que les parties classiques.
// v3 : stats joueurs → { games, classiqueGames, classiquePoints }.
// v4 : ajout de `classiqueBest` aux stats joueurs.
// v5 : fusion des clés de stats qui ne différaient que par la casse.
// v6 : le nombre de parties jouées quitte les stats du Yams pour une clé
//      commune à tous les jeux (`app-player-games`).
// v7 : les lignes des feuilles du Yams (partie en cours, Hall of Fame) sont
//      rangées sous un identifiant stable (« full ») et non plus sous leur
//      libellé (« Full (25) ») ; les entrées du Hall of Fame gardent leur
//      barème.
// v8 : les dates (palmarès du Yams, records du 5000, dernière victoire) passent
//      de `jj/mm/aaaa` à l'ISO (`aaaa-mm-jj`), cf. core/dates.ts.
const SCHEMA_VERSION = 8;

export function migrateStorage(): void {
  const done = Number(localStorage.getItem(STORAGE_KEYS.schemaVersion));
  if (Number.isFinite(done) && done >= SCHEMA_VERSION) return;

  migrateRules();
  // AVANT migratePlayerStats, qui réécrit les stats sans le champ `games`.
  migratePlayerGames();
  migratePlayerStats();
  migrateSavedGame();
  migrateScoreList(STORAGE_KEYS.bestScores);
  migrateScoreList(STORAGE_KEYS.worstScores, true);
  migrateKnownNames();
  migrateDraft();
  // APRÈS migrateScoreList, qui réécrit les listes du palmarès.
  migrateDates();

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

// Le nombre de parties jouées était un champ des stats du Yams ; il devient une
// donnée commune, alimentée par tous les jeux. On lit le brut et non
// getPlayerStats(), qui ne renvoie plus ce champ.
//
// Ne s'exécute que si la clé commune n'existe pas encore : une deuxième passe
// (réinstallation, import de sauvegarde ancienne) ne doit pas écraser un
// compteur déjà alimenté par des parties de 5000.
function migratePlayerGames(): void {
  if (localStorage.getItem(STORAGE_KEYS.playerGames) !== null) return;
  const raw = parse(STORAGE_KEYS.playerStats);
  if (!raw || typeof raw !== "object") return;

  const games: PlayerGames = {};
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    // Tout premier format : la valeur ÉTAIT le nombre de parties.
    if (typeof value === "number" && Number.isFinite(value)) {
      games[name] = value;
    } else if (value && typeof value === "object") {
      const n = (value as Record<string, unknown>).games;
      if (typeof n === "number" && Number.isFinite(n)) games[name] = n;
    }
  }
  writeJson(STORAGE_KEYS.playerGames, dedupePlayerGames(games));
}

// Stats joueurs : anciens formats (`{ [nom]: nombreDeParties }`, `{ games,
// points }`) → forme canonique. L'ancien cumul `points` (toutes variantes)
// n'est pas repris : la moyenne classique repart des prochaines parties. Le
// champ `games` n'est plus recopié — il vit désormais sous sa propre clé.
// Les clés en double (« Jean » / « jean ») sont fusionnées, comme les noms
// connus le sont déjà plus bas.
function migratePlayerStats(): void {
  if (localStorage.getItem(STORAGE_KEYS.playerStats) !== null) {
    writeJson(STORAGE_KEYS.playerStats, dedupePlayerStats(getPlayerStats()));
  }
}

// Brouillon d'avant-partie : il ne portait que des variantes de Yams, il porte
// maintenant le jeu visé et range ses réglages dans `config`. Un brouillon sans
// `gameId` est donc un brouillon de Yams, et ses variantes passent dans
// `config` — laissées à la racine, le Yams ne les verrait pas et lancerait une
// partie sans variante, aussitôt rejetée. L'ancien champ reste en place.
function migrateDraft(): void {
  const raw = parse(STORAGE_KEYS.draft);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const draft = raw as Record<string, unknown>;
  if (typeof draft.gameId === "string") return;
  writeJson(STORAGE_KEYS.draft, {
    ...draft,
    gameId: "yams",
    config: { variants: Array.isArray(draft.variants) ? draft.variants : [] },
  });
}

// Partie en cours : ajoute le champ `rules` (absent avant les paramètres) et
// range les cases sous leur identifiant (v7).
// Si la forme est inattendue, on laisse la valeur en place (getSavedGame la
// filtrera) plutôt que de risquer de perdre une partie légitime.
function migrateSavedGame(): void {
  const raw = parse(STORAGE_KEYS.savedGame);
  if (raw === undefined || !isSavedGame(raw)) return;
  writeJson(STORAGE_KEYS.savedGame, {
    ...raw,
    rules: normalizeRules((raw as { rules?: unknown }).rules),
    players: raw.players.map(
      (player): Player => ({
        ...player,
        scores: Object.fromEntries(
          Object.entries(player.scores).map(([variant, sheet]) => [
            variant,
            sheet && typeof sheet === "object" ? convertSheet(sheet) : sheet,
          ]),
        ) as Player["scores"],
      }),
    ),
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
      // Forme vérifiée, pas le contenu : une variante inconnue ou une feuille
      // incomplète s'affichent quand même, elles ne cassent rien.
      ...(typeof e.variant === "string" ? { variant: e.variant as Variant } : {}),
      ...sheetOf(e),
    });
  }
  writeJson(key, clean);
}

// Feuille détaillée d'une entrée du Hall of Fame, lignes rangées sous leur
// identifiant (v7). Le barème est repris s'il est là, sinon retrouvé dans les
// anciens libellés : c'est lui qui redonne « Full (30) » à l'affichage.
function sheetOf(e: Record<string, unknown>): Partial<ScoreEntry> {
  if (!e.sheet || typeof e.sheet !== "object") return {};
  const legacySheet = e.sheet as LineScores;
  const legacyOrder = Array.isArray(e.lineOrder) ? (e.lineOrder as LineName[]) : undefined;
  return {
    sheet: convertSheet(legacySheet),
    ...(legacyOrder ? { lineOrder: legacyOrder.map(lineIdOf) } : {}),
    rules: e.rules
      ? normalizeRules(e.rules)
      : rulesFromLabels(legacyOrder ?? Object.keys(legacySheet), legacySheet),
  };
}

// Dates : `jj/mm/aaaa` → ISO, partout où une donnée porte un champ `date`
// (entrées du palmarès, records du 5000 par objectif, dernière victoire). Une
// date illisible reste telle quelle ; `formatDate` lit les deux formats.
const DATED_KEYS = [
  STORAGE_KEYS.bestScores,
  STORAGE_KEYS.worstScores,
  STORAGE_KEYS.g5000Records,
  STORAGE_KEYS.lastWin,
];

function migrateDates(): void {
  for (const key of DATED_KEYS) {
    const raw = parse(key);
    if (raw === undefined) continue;
    let changed = false;
    const walk = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      const obj = value as Record<string, unknown>;
      for (const [field, inner] of Object.entries(obj)) {
        if (field === "date" && typeof inner === "string") {
          const iso = isoFromFrench(inner);
          if (iso !== inner) {
            obj[field] = iso;
            changed = true;
          }
        } else {
          walk(inner);
        }
      }
    };
    walk(raw);
    if (changed) writeJson(key, raw);
  }
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
    if (!name || seen.has(foldName(name))) continue;
    seen.add(foldName(name));
    clean.push(name);
  }
  clean.sort(compareNames);
  writeJson(STORAGE_KEYS.knownNames, clean);
}
