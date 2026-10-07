// Logique du Hall of Fame : intégration des scores d'une partie terminée dans
// les tops "meilleurs" et "pires" (5 entrées chacun), et prévisualisation de
// cet impact pour l'écran de fin. Sans DOM.

import type { HallOfFameImpact, Player, ScoreEntry, Variant } from "./types";
import { FINAL_SCORE_LINE, type Grid } from "./scoring";
import { sameName } from "../../core/playerName";
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

// Une entrée par joueur et par variante (les parties de fin sont complètes).
// Si `grid` est fourni, on joint la feuille de score détaillée — inutile pour
// une simple prévisualisation.
function freshEntries(
  players: Player[],
  variants: Variant[],
  grid?: Grid,
): { entry: ScoreEntry; variant: Variant }[] {
  const date = new Date().toLocaleDateString("fr-FR");
  const entries: { entry: ScoreEntry; variant: Variant }[] = [];
  for (const player of players) {
    for (const variant of variants) {
      const sheet = player.scores?.[variant];
      const score = sheet?.[FINAL_SCORE_LINE];
      if (typeof score !== "number") continue;
      entries.push({
        variant,
        entry: {
          name: player.name,
          score,
          date,
          variant,
          // Le barème voyage avec la feuille : il en donne les libellés.
          ...(grid ? { sheet: { ...sheet }, lineOrder: grid.lineOrder, rules: grid.rules } : {}),
        },
      });
    }
  }
  return entries;
}

// À score égal, l'entrée déjà en place garde sa place (tri stable, anciennes
// en tête) : il faut BATTRE un score pour le déloger.
function mergeTop(
  existing: ScoreEntry[],
  fresh: ScoreEntry[],
  dir: "desc" | "asc",
): ScoreEntry[] {
  const sign = dir === "desc" ? -1 : 1;
  return [...existing, ...fresh]
    .sort((a, b) => sign * (a.score - b.score))
    .slice(0, TOP_COUNT);
}

interface HallOfFamePlan {
  best: ScoreEntry[];
  worst: ScoreEntry[];
  impact: HallOfFameImpact;
}

// LE calcul du Hall of Fame après une partie : les deux classements tels
// qu'ils seront enregistrés, et ce que la partie y a changé. Enregistrer et
// prévisualiser ne sont que deux usages de ce même calcul — ils ne peuvent
// donc pas se contredire. L'impact se lit par identité : une entrée de la
// partie est entrée au classement si elle figure dans la liste retenue.
function planHallOfFame(
  players: Player[],
  variants: Variant[],
  grid?: Grid,
): HallOfFamePlan {
  const fresh = freshEntries(players, variants, grid);
  const currentBest = getBestScores();
  const best = mergeTop(currentBest, fresh.map((f) => f.entry), "desc");
  const worst = mergeTop(
    getWorstScores(),
    fresh.filter((f) => f.variant === WORST_VARIANT).map((f) => f.entry),
    "asc",
  );

  const keysIn = (list: ScoreEntry[]): string[] => [
    ...new Set(
      fresh.filter((f) => list.includes(f.entry)).map((f) => key(f.entry.name, f.variant)),
    ),
  ];

  // Pas de « nouveau record » à la toute première partie : il n'y avait rien à
  // battre.
  const leader = best[0];
  const beaten =
    currentBest.length > 0 &&
    leader !== undefined &&
    fresh.some((f) => f.entry === leader) &&
    leader.score > currentBest[0].score;

  return {
    best,
    worst,
    impact: {
      best: keysIn(best),
      worst: keysIn(worst),
      newRecord:
        beaten && leader.variant
          ? { name: leader.name, score: leader.score, variant: leader.variant }
          : null,
    },
  };
}

export function saveBestAndWorstScores(
  players: Player[],
  variants: Variant[],
  grid: Grid,
): void {
  const { best, worst } = planHallOfFame(players, variants, grid);
  saveBestScores(best);
  saveWorstScores(worst);
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

// Ce que la partie changera au Hall of Fame, sans rien écrire (écran de fin).
export function previewHallOfFame(
  players: Player[],
  variants: Variant[],
): HallOfFameImpact {
  return planHallOfFame(players, variants).impact;
}

/* ---------- Administration des joueurs ---------- */
// Casse et espaces ignorés : d'anciennes entrées peuvent porter le nom tel
// qu'il avait été saisi.

const LISTS = [
  { get: getBestScores, save: saveBestScores },
  { get: getWorstScores, save: saveWorstScores },
];

export function renameInHallOfFame(from: string, to: string): void {
  for (const list of LISTS) {
    const entries = list.get();
    if (!entries.some((e) => sameName(e.name, from))) continue;
    list.save(entries.map((e) => (sameName(e.name, from) ? { ...e, name: to } : e)));
  }
}

export function removeFromHallOfFame(name: string): void {
  for (const list of LISTS) {
    const entries = list.get();
    const kept = entries.filter((e) => !sameName(e.name, name));
    if (kept.length !== entries.length) list.save(kept);
  }
}

// Entrées au nom de ce joueur, meilleurs et pires confondus.
export function hallOfFameCount(name: string): number {
  return LISTS.reduce(
    (n, list) => n + list.get().filter((e) => sameName(e.name, name)).length,
    0,
  );
}

export function hallOfFameNames(): string[] {
  return LISTS.flatMap((list) => list.get().map((e) => e.name));
}
