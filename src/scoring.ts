// Règles de score du Yams : définition des sections et calculs.
// Aucun accès au DOM ici — uniquement des données et des fonctions
// (à l'exception des totaux, mémorisés dans l'objet `scores`).

import type { LineName, Player, Variant } from "./types";

type LineValues = number[];
type Section = Record<LineName, LineValues>;
type LineScores = Record<LineName, number>;

/* ---------- Définition des lignes ---------- */

// Section haute : lignes 1 à 6 (valeurs 0, n, 2n, … 5n), puis Bonus et Total.
export const UPPER_SECTION: Section = {};
for (let i = 1; i <= 6; i++) {
  UPPER_SECTION[i] = Array.from({ length: 6 }, (_, index) => index * i);
}
UPPER_SECTION.Bonus = [];
UPPER_SECTION["Total Haut"] = [];

export const LOWER_SECTION: Section = {
  "Brelan (Σ)": Array.from({ length: 31 }, (_, i) => i),
  "Full (25)": [0, 25],
  "Carré (40)": [0, 40],
  "Pte Suite (30)": [0, 30],
  "Gde Suite (40)": [0, 40],
  "Chance (Σ)": Array.from({ length: 31 }, (_, i) => i),
  "Yams (50)": [0, 50],
  "Total Bas": [],
};

export const TOTAL_SECTION: Section = {
  "Score Final": [],
};

export interface SectionDef {
  label: string; // sous-titre affiché ("" = pas de sous-titre)
  lines: Section;
}

export const SECTIONS: SectionDef[] = [
  { label: "Chiffres", lines: UPPER_SECTION },
  { label: "Combinaisons", lines: LOWER_SECTION },
  { label: "", lines: TOTAL_SECTION },
];

// Lignes réellement saisissables (celles qui ont une liste de valeurs).
export const upperScoringNames = Object.keys(UPPER_SECTION).filter(
  (k) => UPPER_SECTION[k].length > 0,
);
export const lowerScoringNames = Object.keys(LOWER_SECTION).filter(
  (k) => LOWER_SECTION[k].length > 0,
);
export const allScoringNames = [...upperScoringNames, ...lowerScoringNames];

/* ---------- Verrouillage des lignes (Montante / Descendante) ---------- */

export function isLineEnabled(
  lineName: LineName,
  variant: Variant,
  scores: LineScores,
): boolean {
  const montanteOrder = [
    ...lowerScoringNames.slice().reverse(),
    ...upperScoringNames.slice().reverse(),
  ];
  const descendanteOrder = [...upperScoringNames, ...lowerScoringNames];

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
): number | string {
  if (name === "Bonus") {
    const total = getUpperSum(scores);
    const filled = upperScoringNames.every((k) => scores[k] !== undefined);
    const value = total >= 63 ? 35 : filled ? 0 : `-${63 - total}`;
    if (typeof value === "number") scores["Bonus"] = value;
    return value;
  }
  if (name === "Total Haut") {
    const bonus = calculateSpecialScore("Bonus", scores);
    const value = getUpperSum(scores) + (typeof bonus === "number" ? bonus : 0);
    scores["Total Haut"] = value;
    return value;
  }
  if (name === "Total Bas") {
    const value = lowerScoringNames.reduce((sum, k) => sum + (scores[k] || 0), 0);
    scores["Total Bas"] = value;
    return value;
  }
  if (name === "Score Final") {
    const haut = calculateSpecialScore("Total Haut", scores);
    const bas = calculateSpecialScore("Total Bas", scores);
    const value = Number(haut) + Number(bas);
    scores["Score Final"] = value;
    return value;
  }
  return "";
}

export function updateCalculatedScores(scores: LineScores): void {
  calculateSpecialScore("Bonus", scores);
  calculateSpecialScore("Total Haut", scores);
  calculateSpecialScore("Total Bas", scores);
  calculateSpecialScore("Score Final", scores);
}

/* ---------- Fin de partie ---------- */

export function isGameFinished(players: Player[], variants: Variant[]): boolean {
  return players.every((player) =>
    variants.every((variant) =>
      allScoringNames.every((k) => player.scores[variant][k] !== undefined),
    ),
  );
}
