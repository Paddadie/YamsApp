// Logique du Hall of Fame : intégration des scores d'une partie terminée dans
// les tops "meilleurs" et "pires" (5 entrées chacun), et prévisualisation de
// cet impact pour l'écran de fin. Sans DOM.

import type {
  HallOfFameImpact,
  LineName,
  LineScores,
  Player,
  ScoreEntry,
  Variant,
} from "./types";
import { FINAL_SCORE_LINE, type Grid } from "./scoring";
import {
  getBestScores,
  getWorstScores,
  saveBestScores,
  saveWorstScores,
} from "./storage/hallOfFameRepo";

const TOP_COUNT = 5;

// Les "pires scores" ne comptent que les parties classiques : les autres
// variantes produisent trop souvent des scores catastrophiques.
const WORST_VARIANT: Variant = "Classique";

interface FinalScore {
  name: string;
  variant: Variant;
  score: number;
  sheet?: LineScores;
  lineOrder?: LineName[];
}

// Un score final par joueur et par variante (les parties de fin sont complètes).
// Si `grid` est fourni, on joint aussi la feuille de score détaillée.
function collectFinalScores(
  players: Player[],
  variants: Variant[],
  grid?: Grid,
): FinalScore[] {
  const lineOrder = grid
    ? grid.sections.flatMap((s) => Object.keys(s.lines))
    : undefined;
  const scores: FinalScore[] = [];
  for (const player of players) {
    for (const variant of variants) {
      const sheet = player.scores?.[variant];
      const score = sheet?.[FINAL_SCORE_LINE];
      if (typeof score === "number") {
        scores.push({
          name: player.name,
          variant,
          score,
          sheet: grid ? { ...sheet } : undefined,
          lineOrder,
        });
      }
    }
  }
  return scores;
}

export function saveBestAndWorstScores(
  players: Player[],
  variants: Variant[],
  grid: Grid,
): void {
  const date = new Date().toLocaleDateString("fr-FR");
  const fresh: ScoreEntry[] = collectFinalScores(players, variants, grid).map(
    (s) => ({
      name: s.name,
      score: s.score,
      date,
      variant: s.variant,
      sheet: s.sheet,
      lineOrder: s.lineOrder,
    }),
  );

  saveBestScores(mergeTop(getBestScores(), fresh, "desc"));
  saveWorstScores(
    mergeTop(
      getWorstScores(),
      fresh.filter((e) => e.variant === WORST_VARIANT),
      "asc",
    ),
  );
}

function mergeTop(
  existing: ScoreEntry[],
  fresh: ScoreEntry[],
  dir: "desc" | "asc",
): ScoreEntry[] {
  const cmp =
    dir === "desc"
      ? (a: ScoreEntry, b: ScoreEntry) => b.score - a.score
      : (a: ScoreEntry, b: ScoreEntry) => a.score - b.score;
  return [...existing, ...fresh].sort(cmp).slice(0, TOP_COUNT);
}

/* ---------- Prévisualisation pour l'écran de fin ---------- */

// Le résultat ne contient que des données simples (aucune fonction) : l'écran
// de fin le range dans la partie sauvegardée pour le retrouver intact après un
// rafraîchissement. Voir HallOfFameImpact.
const key = (name: string, variant: Variant) => `${name}|${variant}`;

export function impactFor(
  impact: HallOfFameImpact,
  name: string,
  variant: Variant,
): { inBest: boolean; inWorst: boolean } {
  const k = key(name, variant);
  return { inBest: impact.best.includes(k), inWorst: impact.worst.includes(k) };
}

// Une partie mémorisée peut venir d'une autre version : on ne se fie à
// `hofImpact` que s'il a bien la forme attendue, sinon on recalcule.
export function isHallOfFameImpact(value: unknown): value is HallOfFameImpact {
  if (!value || typeof value !== "object") return false;
  const i = value as Record<string, unknown>;
  const isKeyList = (v: unknown): boolean =>
    Array.isArray(v) && v.every((k) => typeof k === "string");
  if (!isKeyList(i.best) || !isKeyList(i.worst)) return false;
  if (i.newRecord === null) return true;
  const record = i.newRecord as Record<string, unknown> | null;
  return (
    !!record &&
    typeof record === "object" &&
    typeof record.name === "string" &&
    typeof record.score === "number" &&
    typeof record.variant === "string"
  );
}

export function previewHallOfFame(
  players: Player[],
  variants: Variant[],
): HallOfFameImpact {
  const fresh = collectFinalScores(players, variants);
  const currentBest = getBestScores();
  const currentWorst = getWorstScores();

  const best = topAfterMerge(currentBest, fresh, "desc");
  const worst = topAfterMerge(
    currentWorst,
    fresh.filter((f) => f.variant === WORST_VARIANT),
    "asc",
  );

  const impact = new Map<string, { inBest: boolean; inWorst: boolean }>();
  for (const s of fresh) {
    const k = key(s.name, s.variant);
    const prev = impact.get(k) ?? { inBest: false, inWorst: false };
    impact.set(k, {
      inBest: prev.inBest || best.survivors.has(s),
      inWorst: prev.inWorst || worst.survivors.has(s),
    });
  }

  const previousRecord = currentBest[0]?.score;
  const newRecord =
    best.leader &&
    previousRecord !== undefined &&
    best.leader.score > previousRecord
      ? best.leader
      : null;

  return {
    best: [...impact].filter(([, i]) => i.inBest).map(([k]) => k),
    worst: [...impact].filter(([, i]) => i.inWorst).map(([k]) => k),
    newRecord: newRecord
      ? {
          name: newRecord.name,
          score: newRecord.score,
          variant: newRecord.variant,
        }
      : null,
  };
}

// Reproduit exactement `[...existing, ...fresh].sort().slice(0, 5)` et indique
// quels scores "fresh" y survivent + lequel finit en tête.
function topAfterMerge(
  existing: ScoreEntry[],
  fresh: FinalScore[],
  dir: "desc" | "asc",
): { survivors: Set<FinalScore>; leader: FinalScore | undefined } {
  interface Row {
    score: number;
    fresh?: FinalScore;
  }
  const rows: Row[] = [
    ...existing.map((e): Row => ({ score: e.score })),
    ...fresh.map((f): Row => ({ score: f.score, fresh: f })),
  ];
  const sign = dir === "desc" ? -1 : 1;
  rows.sort((a, b) => sign * (a.score - b.score));

  const top = rows.slice(0, TOP_COUNT);
  const survivors = new Set<FinalScore>();
  for (const row of top) {
    if (row.fresh) survivors.add(row.fresh);
  }
  return { survivors, leader: top[0]?.fresh };
}
