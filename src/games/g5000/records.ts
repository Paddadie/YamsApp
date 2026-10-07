// Records du 5000. Aucun accès au DOM — tout ici est testable.
//
// Pas de Hall of Fame à la Yams : tout le monde finit à l'objectif, un
// « meilleur score » n'aurait aucun sens. On retient à la place des exploits,
// quatre dont on est fier et quatre dont on rit, arrêtés avec Paul.
//
// Deux temps :
//   pendant la partie, `noteTurn` consigne ce qui s'est passé dans
//     `game.stats` — certains exploits (mains pleines, pot perdu) n'existent
//     qu'au moment du tour ;
//   à la fin, `mergeRecords` confronte la partie aux records et dit lesquels
//     tombent. Une partie abandonnée ne compte donc pas, comme au Yams.
//
// Un record doit être BATTU pour changer de main : à égalité, le premier à
// l'avoir établi le garde.
//
// Chaque objectif (3 000, 5 000, 10 000…) a ses propres records : une partie
// ne se mesure qu'aux parties jouées au même objectif. Seules les victoires se
// comptent tous objectifs confondus.

import type { Move } from "./engine";
import { compareNames, sameName } from "../../core/playerName";
import type { G5000Game, G5000GameStats, GameFeat } from "./types";
import { DEFAULT_RULES } from "./rules";

/* ---------- Pendant la partie ---------- */

export function emptyStats(players: number): G5000GameStats {
  return {
    turns: Array(players).fill(0),
    closedRun: Array(players).fill(0),
    longestClosedRun: Array(players).fill(0),
  };
}

// Ce que l'écran sait d'un tour qui vient de finir, au-delà des points.
export interface TurnReport {
  player: number;
  wasOpen: boolean; // le joueur était-il entré en jeu avant ce tour ?
  scored: boolean; // a-t-il marqué ?
  banked: number; // points banqués (0 si bust)
  // Pot accumulé puis perdu sur un bust. Connu de la calculette, et de la
  // saisie rapide quand le joueur a tapé son pot avant d'appuyer sur « Bust ».
  lost: number;
  hotStreak: number; // mains pleines enchaînées pendant ce tour
  moves: Move[]; // mouvements provoqués (redescentes)
}

const beats = (feat: GameFeat | undefined, value: number): boolean =>
  value > 0 && (feat === undefined || value > feat.value);

export function noteTurn(stats: G5000GameStats, report: TurnReport): void {
  const p = report.player;
  stats.turns[p]++;

  // Entrée en jeu : on compte les tours ratés d'affilée tant que le joueur
  // n'est pas entré ; le tour qui le fait entrer clôt la série.
  if (!report.wasOpen) {
    if (report.scored) stats.closedRun[p] = 0;
    else {
      stats.closedRun[p]++;
      stats.longestClosedRun[p] = Math.max(stats.longestClosedRun[p], stats.closedRun[p]);
    }
  }

  if (report.scored && beats(stats.biggestBank, report.banked)) {
    stats.biggestBank = { player: p, value: report.banked };
  }
  if (!report.scored && beats(stats.biggestBust, report.lost)) {
    stats.biggestBust = { player: p, value: report.lost };
  }
  if (beats(stats.longestHotStreak, report.hotStreak)) {
    stats.longestHotStreak = { player: p, value: report.hotStreak };
  }

  for (const move of report.moves) {
    if (move.kind !== "tie" && move.kind !== "penalty") continue;
    const drop = move.from - move.to;
    // Un joueur retombé à zéro repart en quête de son entrée en jeu.
    if (move.to === 0) stats.closedRun[move.player] = 0;
    if (beats(stats.biggestFall, drop)) {
      stats.biggestFall = { player: move.player, value: drop, by: move.by };
    }
  }
}

/* ---------- Les records conservés ---------- */

export interface RecordEntry {
  name: string;
  value: number;
  date: string;
  by?: string; // celui qui a provoqué une chute
  names?: string[]; // la tablée, pour la partie la plus longue
}

// Les records d'UN objectif. Une victoire en 9 tours à 3 000 ne dit rien d'une
// partie à 10 000 : chaque objectif a sa propre table.
export interface RecordTable {
  fastestWin?: RecordEntry; // le moins de tours — le seul record à la baisse
  biggestBank?: RecordEntry;
  longestHotStreak?: RecordEntry;
  biggestBust?: RecordEntry;
  biggestFall?: RecordEntry;
  slowestOpening?: RecordEntry;
  longestGame?: RecordEntry;
}

export interface G5000Records {
  // Une table par objectif, indexée par sa valeur (« 5000 »).
  targets: Record<string, RecordTable>;
  // Les victoires, elles, se comptent tous objectifs confondus : une victoire
  // reste une victoire.
  wins: Record<string, number>;
}

export type EntryKey = keyof RecordTable;
export type RecordKey = EntryKey | "mostWins";

const ENTRY_KEYS: EntryKey[] = [
  "fastestWin",
  "biggestBank",
  "longestHotStreak",
  "biggestBust",
  "biggestFall",
  "slowestOpening",
  "longestGame",
];

// Objectif sous lequel ranger les records d'avant la séparation par objectif :
// ils ne disent pas sous lequel ils ont été établis, et la plupart des parties
// se jouent à celui par défaut.
const LEGACY_TARGET = String(DEFAULT_RULES.target);

// La table d'un objectif (vide s'il n'a encore aucun record).
export function recordsAt(records: G5000Records, target: number): RecordTable {
  return records.targets[String(target)] ?? {};
}

// Les objectifs qui ont au moins un record, du plus petit au plus grand.
export function recordTargets(records: G5000Records): number[] {
  return Object.entries(records.targets)
    .filter(([, table]) => ENTRY_KEYS.some((key) => table[key]))
    .map(([target]) => Number(target))
    .sort((a, b) => a - b);
}

// Lecture tolérante : un champ abîmé retombe sur « pas de record » au lieu de
// faire tomber tous les autres.
export function normalizeRecords(raw: unknown): G5000Records {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const targets: Record<string, RecordTable> = {};
  if (s.targets && typeof s.targets === "object") {
    for (const [target, table] of Object.entries(s.targets as Record<string, unknown>)) {
      if (Number.isFinite(Number(target))) targets[target] = normalizeTable(table);
    }
  }
  // Ancien format : les records à la racine, sans objectif.
  const legacy = normalizeTable(s);
  if (ENTRY_KEYS.some((key) => legacy[key])) {
    targets[LEGACY_TARGET] = { ...legacy, ...targets[LEGACY_TARGET] };
  }

  const wins: Record<string, number> = {};
  if (s.wins && typeof s.wins === "object") {
    for (const [name, n] of Object.entries(s.wins as Record<string, unknown>)) {
      if (typeof n === "number" && Number.isFinite(n) && n > 0) wins[name] = n;
    }
  }
  return { targets, wins };
}

function normalizeTable(raw: unknown): RecordTable {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const table: RecordTable = {};
  for (const key of ENTRY_KEYS) {
    const entry = normalizeEntry(s[key]);
    if (entry) table[key] = entry;
  }
  return table;
}

function normalizeEntry(v: unknown): RecordEntry | undefined {
  if (!v || typeof v !== "object") return undefined;
  const e = v as Record<string, unknown>;
  if (typeof e.name !== "string" || typeof e.value !== "number") return undefined;
  return {
    name: e.name,
    value: e.value,
    date: typeof e.date === "string" ? e.date : "",
    ...(typeof e.by === "string" ? { by: e.by } : {}),
    ...(Array.isArray(e.names) && e.names.every((n) => typeof n === "string")
      ? { names: e.names as string[] }
      : {}),
  };
}

// Le classement des victoires, du plus victorieux au moins. À égalité, l'ordre
// alphabétique tranche : il faut bien un nom en tête de la carte « plus grand
// nombre de victoires », et la liste doit dire le même.
export function winsRanking(records: G5000Records): [string, number][] {
  return Object.entries(records.wins).sort(
    ([a, x], [b, y]) => y - x || compareNames(a, b),
  );
}

// Le détenteur du plus grand nombre de victoires.
export function mostWins(records: G5000Records): { name: string; value: number } | null {
  const [first] = winsRanking(records);
  return first ? { name: first[0], value: first[1] } : null;
}

/* ---------- Fin de partie ---------- */

export interface MergeResult {
  records: G5000Records;
  broken: RecordKey[];
}

// Confronte une partie terminée aux records DE SON OBJECTIF. Fonction pure : ne
// touche ni à `records` ni à `game`, renvoie une copie et la liste des records
// tombés.
export function mergeRecords(
  records: G5000Records,
  game: G5000Game,
  winners: number[],
  date: string,
): MergeResult {
  const target = String(game.rules.target);
  const table: RecordTable = { ...records.targets[target] };
  const next: G5000Records = {
    targets: { ...records.targets, [target]: table },
    wins: { ...records.wins },
  };
  const broken: RecordKey[] = [];
  const stats = game.stats;
  const nameOf = (i: number): string => game.players[i].name;

  const higher = (key: Exclude<EntryKey, "fastestWin">, candidate: RecordEntry | null) => {
    if (!candidate || candidate.value <= 0) return;
    const current = table[key];
    if (current && candidate.value <= current.value) return;
    table[key] = candidate;
    broken.push(key);
  };

  const feat = (f: GameFeat | undefined): RecordEntry | null =>
    f
      ? {
          name: nameOf(f.player),
          value: f.value,
          date,
          ...(f.by !== undefined ? { by: nameOf(f.by) } : {}),
        }
      : null;

  // Victoires : un point pour chaque vainqueur, victoire partagée comprise.
  const leaderBefore = mostWins(records);
  for (const w of winners) {
    const name = nameOf(w);
    next.wins[name] = (next.wins[name] ?? 0) + 1;
  }
  const leaderAfter = mostWins(next);
  if (
    leaderAfter &&
    winners.some((w) => nameOf(w) === leaderAfter.name) &&
    (!leaderBefore || leaderAfter.value > leaderBefore.value)
  ) {
    broken.push("mostWins");
  }

  if (stats) {
    // Victoire la plus rapide : le moins de tours joués par un vainqueur.
    for (const w of winners) {
      const turns = stats.turns[w];
      if (turns <= 0) continue;
      const current = table.fastestWin;
      if (current && turns >= current.value) continue;
      table.fastestWin = { name: nameOf(w), value: turns, date };
      if (!broken.includes("fastestWin")) broken.push("fastestWin");
    }

    higher("biggestBank", feat(stats.biggestBank));
    higher("longestHotStreak", feat(stats.longestHotStreak));
    higher("biggestBust", feat(stats.biggestBust));
    higher("biggestFall", feat(stats.biggestFall));

    const slowest = stats.longestClosedRun.reduce(
      (best, run, i) => (run > best.run ? { run, i } : best),
      { run: 0, i: -1 },
    );
    if (slowest.i >= 0) {
      higher("slowestOpening", { name: nameOf(slowest.i), value: slowest.run, date });
    }

    // Partie la plus longue : en tours de table, c'est-à-dire le plus grand
    // nombre de tours joués par un même joueur.
    const rounds = Math.max(0, ...stats.turns);
    higher("longestGame", {
      name: game.players.map((p) => p.name).join(", "),
      names: game.players.map((p) => p.name),
      value: rounds,
      date,
    });
  }

  return { records: next, broken };
}

/* ---------- Administration des joueurs ---------- */

// Applique `change` à chaque table d'objectif ; les tables vidées disparaissent.
function eachTable(
  records: G5000Records,
  change: (table: RecordTable) => RecordTable,
): Record<string, RecordTable> {
  const targets: Record<string, RecordTable> = {};
  for (const [target, table] of Object.entries(records.targets)) {
    const changed = change(table);
    if (ENTRY_KEYS.some((key) => changed[key])) targets[target] = changed;
  }
  return targets;
}

// Renommage : le record suit le joueur, quel que soit l'objectif. Fusionne les
// victoires si le nom cible existe déjà, comme les autres compteurs de
// l'application.
export function renameInRecords(
  records: G5000Records,
  oldName: string,
  newName: string,
): G5000Records {
  const swap = (n: string): string => (sameName(n, oldName) ? newName : n);
  const targets = eachTable(records, (table) => {
    const next: RecordTable = {};
    for (const key of ENTRY_KEYS) {
      const e = table[key];
      if (!e) continue;
      next[key] = {
        ...e,
        name: e.names ? e.names.map(swap).join(", ") : swap(e.name),
        ...(e.by ? { by: swap(e.by) } : {}),
        ...(e.names ? { names: e.names.map(swap) } : {}),
      };
    }
    return next;
  });
  const wins: Record<string, number> = {};
  for (const [name, n] of Object.entries(records.wins)) {
    const key = swap(name);
    wins[key] = (wins[key] ?? 0) + n;
  }
  return { targets, wins };
}

// Tous les noms que les records portent : détenteurs, auteurs de chutes,
// tablées, vainqueurs — tous objectifs confondus.
export function recordNames(records: G5000Records): string[] {
  const names: string[] = Object.keys(records.wins);
  for (const table of Object.values(records.targets)) {
    for (const key of ENTRY_KEYS) {
      const e = table[key];
      if (!e) continue;
      names.push(...(e.names ?? [e.name]));
      if (e.by) names.push(e.by);
    }
  }
  return names;
}

// Records détenus par ce joueur, tous objectifs confondus (la partie la plus
// longue compte pour chacun de sa tablée), victoires non comprises.
export function recordsHeldBy(records: G5000Records, name: string): number {
  let held = 0;
  for (const table of Object.values(records.targets)) {
    for (const key of ENTRY_KEYS) {
      const e = table[key];
      if (e && (e.names ?? [e.name]).some((n) => sameName(n, name))) held++;
    }
  }
  return held;
}

// Suppression d'un joueur : ses records disparaissent avec lui. Une chute qu'il
// a seulement provoquée reste au joueur qui l'a subie, sans nom d'auteur ; la
// partie la plus longue reste, sans lui dans la tablée.
export function removeFromRecords(records: G5000Records, name: string): G5000Records {
  const targets = eachTable(records, (table) => {
    const next: RecordTable = {};
    for (const key of ENTRY_KEYS) {
      const e = table[key];
      if (!e) continue;
      if (e.names) {
        const names = e.names.filter((n) => !sameName(n, name));
        if (names.length) next[key] = { ...e, names, name: names.join(", ") };
        continue;
      }
      if (sameName(e.name, name)) continue;
      if (e.by && sameName(e.by, name)) {
        const { by: _by, ...rest } = e;
        next[key] = rest;
        continue;
      }
      next[key] = e;
    }
    return next;
  });
  const wins: Record<string, number> = {};
  for (const [n, count] of Object.entries(records.wins)) {
    if (!sameName(n, name)) wins[n] = count;
  }
  return { targets, wins };
}

/* ---------- Effacement à la main (Paramètres) ---------- */

// Efface un record d'un objectif : la prochaine partie terminée à cet objectif
// pourra l'établir à nouveau.
export function clearRecord(
  records: G5000Records,
  target: number,
  key: EntryKey,
): G5000Records {
  const targets = eachTable(records, (table) => table);
  const table = { ...recordsAt(records, target) };
  delete table[key];
  if (ENTRY_KEYS.some((k) => table[k])) targets[String(target)] = table;
  else delete targets[String(target)];
  return { targets, wins: { ...records.wins } };
}

// Remet à zéro les victoires d'un joueur, sans toucher aux autres records.
export function clearWins(records: G5000Records, name: string): G5000Records {
  const wins: Record<string, number> = {};
  for (const [n, count] of Object.entries(records.wins)) {
    if (!sameName(n, name)) wins[n] = count;
  }
  return { ...records, wins };
}
