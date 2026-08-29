// Règles de score du Yams : définition des sections et calculs.
// Aucun accès au DOM ici — uniquement des données et des fonctions
// (à l'exception des totaux, mémorisés dans l'objet `scores`).

import type { GameRules, LineName, LineMode, Player, Variant } from "./types";

type LineValues = number[];
type Section = Record<LineName, LineValues>;
type LineScores = Record<LineName, number>;

// Lignes calculées, jamais saisies : leur libellé sert de clé dans `scores`,
// et plusieurs écrans les reconnaissent par ce nom. Une seule définition ici
// évite que la grille et les écrans divergent silencieusement.
export const BONUS_LINE = "Bonus";
export const UPPER_TOTAL_LINE = "Total Haut";
export const LOWER_TOTAL_LINE = "Total Bas";
export const FINAL_SCORE_LINE = "Score Final";

// Dans l'ordre où elles apparaissent dans la grille.
export const DERIVED_LINES: LineName[] = [
  BONUS_LINE,
  UPPER_TOTAL_LINE,
  LOWER_TOTAL_LINE,
  FINAL_SCORE_LINE,
];

/* ---------- Section haute (non configurable) ---------- */

// Lignes 1 à 6 (valeurs 0, n, 2n, … 5n), puis Bonus et Total.
const UPPER_SECTION: Section = {};
for (let i = 1; i <= 6; i++) {
  UPPER_SECTION[i] = Array.from({ length: 6 }, (_, index) => index * i);
}
UPPER_SECTION[BONUS_LINE] = [];
UPPER_SECTION[UPPER_TOTAL_LINE] = [];

const TOTAL_SECTION: Section = {
  [FINAL_SCORE_LINE]: [],
};

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

// Bornes des valeurs réglables. Larges pour ne brider aucune règle maison
// courante (Yams à 100, grosses suites, etc.), mais assez pour écarter les
// valeurs absurdes (négatives, 1e9…).
export const LINE_POINTS_MIN = 0;
export const LINE_POINTS_MAX = 150;
export const BONUS_MIN = 0;
export const BONUS_MAX = 100;
export const BONUS_THRESHOLD = 63;

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Math.round(n)));

function asMode(value: unknown, fallback: LineMode): LineMode {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { type: "fixed", points: clamp(value, LINE_POINTS_MIN, LINE_POINTS_MAX) };
  }
  if (value && typeof value === "object" && "type" in value) {
    const m = value as LineMode;
    if (m.type === "sum") return { type: "sum" };
    if (m.type === "fixed" && typeof m.points === "number" && Number.isFinite(m.points)) {
      return { type: "fixed", points: clamp(m.points, LINE_POINTS_MIN, LINE_POINTS_MAX) };
    }
  }
  return fallback;
}

// Complète / répare / borne un objet de règles quelconque (stockage, sauvegarde
// de partie, ancien format où full/suites/yams étaient de simples nombres).
export function normalizeRules(raw: unknown): GameRules {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bonus =
    typeof s.bonus === "number" && Number.isFinite(s.bonus)
      ? clamp(s.bonus, BONUS_MIN, BONUS_MAX)
      : DEFAULT_RULES.bonus;
  return {
    bonus,
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

function buildLowerSection(rules: GameRules): Section {
  const section: Section = {};
  section[modeLabel("Brelan", rules.brelan)] = modeValues(rules.brelan);
  section[modeLabel("Full", rules.full)] = modeValues(rules.full);
  section[modeLabel("Carré", rules.carre)] = modeValues(rules.carre);
  section[modeLabel("Pte Suite", rules.petiteSuite)] = modeValues(rules.petiteSuite);
  section[modeLabel("Gde Suite", rules.grandeSuite)] = modeValues(rules.grandeSuite);
  if (rules.chance) section["Chance (Σ)"] = SUM_VALUES;
  section[modeLabel("Yams", rules.yams)] = modeValues(rules.yams);
  section[LOWER_TOTAL_LINE] = [];
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

// La section haute ne dépend pas des règles : calculée une seule fois.
const upperScoringNames = scoringNames(UPPER_SECTION);

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

// Seules la Montante et la Descendante imposent un ordre de remplissage ;
// partout ailleurs toutes les lignes restent ouvertes.
function isLockedVariant(variant: Variant): boolean {
  return variant === "Montante" || variant === "Descendante";
}

// Ordre imposé de remplissage. Descendante : haut puis bas, dans l'ordre de la
// grille. Montante : exactement l'inverse.
function fillOrder(variant: Variant, grid: Grid): LineName[] {
  const descending = [...grid.upperScoringNames, ...grid.lowerScoringNames];
  return variant === "Montante" ? descending.reverse() : descending;
}

export function isLineEnabled(
  lineName: LineName,
  variant: Variant,
  scores: LineScores,
  grid: Grid,
): boolean {
  if (!isLockedVariant(variant)) return true;

  const order = fillOrder(variant, grid);
  const index = order.indexOf(lineName);

  // Ligne hors de l'ordre imposé (une ligne calculée) ou toute première : libre.
  if (index <= 0) return true;

  return scores[order[index - 1]] !== undefined;
}

/* ---------- Valeurs dérivées (bonus, totaux, score final) ---------- */

const sumLines = (scores: LineScores, names: string[]): number =>
  names.reduce((total, key) => total + (scores[key] || 0), 0);

export interface Derived {
  upperSum: number; // total de la section chiffres, hors bonus (course au seuil)
  upperFilled: boolean; // les six cases de la section chiffres sont saisies
  bonus: number; // points de bonus acquis (0 tant que le seuil n'est pas atteint)
  // Repère "-N" tant que la section chiffres n'est pas bouclée sous le seuil,
  // sinon null (on affiche alors `bonus`).
  bonusHint: string | null;
  totalHaut: number;
  totalBas: number;
  scoreFinal: number;
}

// Calcul pur : ne modifie pas `scores`.
export function computeDerived(scores: LineScores, grid: Grid): Derived {
  const upperSum = sumLines(scores, grid.upperScoringNames);
  const upperFilled = grid.upperScoringNames.every((k) => scores[k] !== undefined);
  const reached = upperSum >= BONUS_THRESHOLD;

  const bonus = reached ? grid.bonusPoints : 0;
  const bonusHint = reached || upperFilled ? null : `-${BONUS_THRESHOLD - upperSum}`;
  const totalHaut = upperSum + bonus;
  const totalBas = sumLines(scores, grid.lowerScoringNames);

  return {
    upperSum,
    upperFilled,
    bonus,
    bonusHint,
    totalHaut,
    totalBas,
    scoreFinal: totalHaut + totalBas,
  };
}

// Recopie les valeurs dérivées dans `scores` (pour la persistance et le Hall
// of Fame, qui lisent scores["Score Final"]).
export function writeDerived(scores: LineScores, grid: Grid): Derived {
  const d = computeDerived(scores, grid);
  scores[BONUS_LINE] = d.bonus;
  scores[UPPER_TOTAL_LINE] = d.totalHaut;
  scores[LOWER_TOTAL_LINE] = d.totalBas;
  scores[FINAL_SCORE_LINE] = d.scoreFinal;
  return d;
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
