// Feuilles de score d'avant la v7 : leurs lignes étaient rangées sous leur
// LIBELLÉ affiché (« Full (25) », « Score Final »), et non sous un identifiant
// stable (« full », « scoreFinal »). Ce module les convertit ; seule la
// migration s'en sert. Sans DOM, testé.

import {
  DERIVED_LABELS,
  LINE_BASE_LABELS,
  normalizeRules,
} from "./scoring";
import type { GameRules, LineName, LineScores } from "./types";

const ID_BY_BASE = new Map(Object.entries(LINE_BASE_LABELS).map(([id, base]) => [base, id]));
const ID_BY_DERIVED = new Map(Object.entries(DERIVED_LABELS).map(([id, label]) => [label, id]));

// « Full (25) » → « full », « Score Final » → « scoreFinal ». Un chiffre, un
// identifiant déjà converti ou une clé inconnue restent tels quels : la
// conversion peut repasser sans rien abîmer.
export function lineIdOf(key: string): LineName {
  const derived = ID_BY_DERIVED.get(key);
  if (derived) return derived;
  return ID_BY_BASE.get(key.replace(/ \([^)]*\)$/, "")) ?? key;
}

export function convertSheet(sheet: LineScores): LineScores {
  const converted: LineScores = {};
  for (const [key, value] of Object.entries(sheet)) converted[lineIdOf(key)] = value;
  return converted;
}

// Le barème d'une ancienne feuille, retrouvé dans ses libellés : « Full (30) »
// = 30 points fixes, « Brelan (Σ) » = somme des dés, pas de ligne Chance =
// Chance désactivée. Le bonus se lit dans la feuille quand il a été obtenu. Il
// ne sert qu'à réafficher les libellés de la feuille telle qu'elle a été jouée.
export function rulesFromLabels(labels: string[], sheet: LineScores): GameRules {
  const raw: Record<string, unknown> = {
    chance: labels.some((label) => lineIdOf(label) === "chance"),
  };
  for (const label of labels) {
    const id = lineIdOf(label);
    const mode = / \((Σ\d?|\d+)\)$/.exec(label)?.[1];
    if (!mode || id === "chance" || !(id in LINE_BASE_LABELS)) continue;
    raw[id] =
      mode === "Σ"
        ? { type: "sum" }
        : mode.startsWith("Σ")
          ? { type: "dice" }
          : { type: "fixed", points: Number(mode) };
  }
  const bonus = sheet[DERIVED_LABELS.bonus] ?? sheet.bonus;
  if (typeof bonus === "number" && bonus > 0) raw.bonus = bonus;
  return normalizeRules(raw);
}
