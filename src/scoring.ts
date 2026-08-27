// Règles de score du Yams : définition des sections et calculs.
// Aucun accès au DOM ici — uniquement des données et des fonctions
// (à l'exception des totaux, mémorisés dans l'objet `scores`).

import type { GameRules, LineName, LineMode, Player, Variant } from "./types";

type LineValues = number[];
type Section = Record<LineName, LineValues>;
type LineScores = Record<LineName, number>;

/* ---------- Section haute (non configurable) ---------- */

// Lignes 1 à 6 (valeurs 0, n, 2n, … 5n), puis Bonus et Total.
export const UPPER_SECTION: Section = {};
for (let i = 1; i <= 6; i++) {
  UPPER_SECTION[i] = Array.from({ length: 6 }, (_, index) => index * i);
}
UPPER_SECTION.Bonus = [];
UPPER_SECTION["Total Haut"] = [];

export const TOTAL_SECTION: Section = {
  "Score Final": [],
};

export const upperScoringNames = Object.keys(UPPER_SECTION).filter(
  (k) => UPPER_SECTION[k].length > 0,
);

/* ---------- Règles configurables ---------- */

// Somme des 5 dés : 0 à 30.
const SUM_VALUES: LineValues = Array.from({ length: 31 }, (_, i) => i);

export const DEFAULT_RULES: GameRules = {
  bonus: 35,
  brelan: { type: "sum" },
  full: { type: "fixed", points: 25 },
  carre: { type: "fixed", points: 40 },
  petiteSuite: { type: "fixed", points: 30 },
  grandeSuite: { type: "fixed", points: 40 },
  chance: true,
  yams: { type: "fixed", points: 50 },
};

function asMode(value: unknown, fallback: LineMode): LineMode {
  if (typeof value === "number") return { type: "fixed", points: value };
  if (value && typeof value === "object" && "type" in value) {
    const m = value as LineMode;
    if (m.type === "sum") return { type: "sum" };
    if (m.type === "fixed" && typeof m.points === "number") return m;
  }
  return fallback;
}

// Complète / répare un objet de règles quelconque (stockage, sauvegarde de
// partie, ancien format où full/suites/yams étaient de simples nombres).
export function normalizeRules(raw: unknown): GameRules {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, d: number): number =>
    typeof v === "number" && Number.isFinite(v) ? v : d;
  return {
    bonus: num(s.bonus, DEFAULT_RULES.bonus),
    brelan: asMode(s.brelan, DEFAULT_RULES.brelan),
    full: asMode(s.full, DEFAULT_RULES.full),
    carre: asMode(s.carre, DEFAULT_RULES.carre),
    petiteSuite: asMode(s.petiteSuite, DEFAULT_RULES.petiteSuite),
    grandeSuite: asMode(s.grandeSuite, DEFAULT_RULES.grandeSuite),
    chance: typeof s.chance === "boolean" ? s.chance : DEFAULT_RULES.chance,
    yams: asMode(s.yams, DEFAULT_RULES.yams),
  };
}

function modeLabel(base: string, mode: LineMode): string {
  return mode.type === "sum" ? `${base} (Σ)` : `${base} (${mode.points})`;
}

function modeValues(mode: LineMode): LineValues {
  return mode.type === "sum" ? SUM_VALUES : [0, mode.points];
}

// Construit la section "Combinaisons" à partir des règles d'une partie.
export function buildLowerSection(rules: GameRules): Section {
  const section: Section = {};
  section[modeLabel("Brelan", rules.brelan)] = modeValues(rules.brelan);
  section[modeLabel("Full", rules.full)] = modeValues(rules.full);
  section[modeLabel("Carré", rules.carre)] = modeValues(rules.carre);
  section[modeLabel("Pte Suite", rules.petiteSuite)] = modeValues(rules.petiteSuite);
  section[modeLabel("Gde Suite", rules.grandeSuite)] = modeValues(rules.grandeSuite);
  if (rules.chance) section["Chance (Σ)"] = SUM_VALUES;
  section[modeLabel("Yams", rules.yams)] = modeValues(rules.yams);
  section["Total Bas"] = [];
  return section;
}

/* ---------- Grille complète d'une partie ---------- */

export interface SectionDef {
  label: string; // sous-titre affiché ("" = pas de sous-titre)
  lines: Section;
}

export interface Grid {
  sections: SectionDef[];
  upperScoringNames: string[];
  lowerScoringNames: string[];
  allScoringNames: string[];
  bonusPoints: number;
}

const scoringNames = (section: Section): string[] =>
  Object.keys(section).filter((k) => section[k].length > 0);

export function buildGrid(rules: GameRules): Grid {
  const lower = buildLowerSection(rules);
  const lowerScoringNames = scoringNames(lower);
  return {
    sections: [
      { label: "Chiffres", lines: UPPER_SECTION },
      { label: "Combinaisons", lines: lower },
      { label: "", lines: TOTAL_SECTION },
    ],
    upperScoringNames,
    lowerScoringNames,
    allScoringNames: [...upperScoringNames, ...lowerScoringNames],
    bonusPoints: rules.bonus,
  };
}

/* ---------- Verrouillage des lignes (Montante / Descendante) ---------- */

export function isLineEnabled(
  lineName: LineName,
  variant: Variant,
  scores: LineScores,
  grid: Grid,
): boolean {
  const montanteOrder = [
    ...grid.lowerScoringNames.slice().reverse(),
    ...grid.upperScoringNames.slice().reverse(),
  ];
  const descendanteOrder = [...grid.upperScoringNames, ...grid.lowerScoringNames];

  const order = variant === "Montante" ? montanteOrder : descendanteOrder;

  if (!order.includes(lineName)) return true;

  const index = order.indexOf(lineName);
  if (index === 0) return true;

  return scores[order[index - 1]] !== undefined;
}

/* ---------- Calculs de totaux ---------- */

function getUpperSum(scores: LineScores): number {
  return upperScoringNames.reduce((sum, key) => sum + (scores[key] || 0), 0);
}

// Calcule (et mémorise dans `scores`) une ligne dérivée.
export function calculateSpecialScore(
  name: LineName,
  scores: LineScores,
  grid: Grid,
): number | string {
  if (name === "Bonus") {
    const total = getUpperSum(scores);
    const filled = upperScoringNames.every((k) => scores[k] !== undefined);
    const value =
      total >= 63 ? grid.bonusPoints : filled ? 0 : `-${63 - total}`;
    if (typeof value === "number") scores["Bonus"] = value;
    return value;
  }
  if (name === "Total Haut") {
    const bonus = calculateSpecialScore("Bonus", scores, grid);
    const value = getUpperSum(scores) + (typeof bonus === "number" ? bonus : 0);
    scores["Total Haut"] = value;
    return value;
  }
  if (name === "Total Bas") {
    const value = grid.lowerScoringNames.reduce(
      (sum, k) => sum + (scores[k] || 0),
      0,
    );
    scores["Total Bas"] = value;
    return value;
  }
  if (name === "Score Final") {
    const haut = calculateSpecialScore("Total Haut", scores, grid);
    const bas = calculateSpecialScore("Total Bas", scores, grid);
    const value = Number(haut) + Number(bas);
    scores["Score Final"] = value;
    return value;
  }
  return "";
}

export function updateCalculatedScores(scores: LineScores, grid: Grid): void {
  calculateSpecialScore("Bonus", scores, grid);
  calculateSpecialScore("Total Haut", scores, grid);
  calculateSpecialScore("Total Bas", scores, grid);
  calculateSpecialScore("Score Final", scores, grid);
}

/* ---------- Fin de partie ---------- */

export function isGameFinished(
  players: Player[],
  variants: Variant[],
  grid: Grid,
): boolean {
  return players.every((player) =>
    variants.every((variant) =>
      grid.allScoringNames.every((k) => player.scores[variant][k] !== undefined),
    ),
  );
}
