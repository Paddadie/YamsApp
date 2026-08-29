import { describe, expect, it } from "vitest";
import {
  BONUS_MAX,
  BONUS_THRESHOLD,
  DEFAULT_RULES,
  FINAL_SCORE_LINE,
  LINE_POINTS_MAX,
  buildGrid,
  computeDerived,
  isGameFinished,
  isLineEnabled,
  normalizeRules,
  writeDerived,
} from "./scoring";
import type { GameRules, LineName, Player, Variant } from "./types";

const grid = buildGrid(DEFAULT_RULES);

// Remplit les six lignes de la section chiffres pour atteindre exactement
// `total`. La ligne « n » n'accepte que les multiples de n jusqu'à 5n : on
// descend des grosses faces vers les petites, la ligne « 1 » absorbant le reste.
function upperScores(total: number): Record<LineName, number> {
  const scores: Record<LineName, number> = {};
  let left = total;
  for (const name of [...grid.upperScoringNames].reverse()) {
    const face = Number(name);
    const value = Math.min(left - (left % face), face * 5);
    scores[name] = value;
    left -= value;
  }
  if (left !== 0) throw new Error(`Total ${total} non atteignable (reste ${left})`);
  return scores;
}

describe("normalizeRules", () => {
  it("complète un objet vide avec les valeurs par défaut", () => {
    expect(normalizeRules({})).toEqual(DEFAULT_RULES);
  });

  it("répare une entrée illisible plutôt que de planter", () => {
    expect(normalizeRules(null)).toEqual(DEFAULT_RULES);
    expect(normalizeRules("n'importe quoi")).toEqual(DEFAULT_RULES);
  });

  it("accepte l'ancien format où une combinaison était un simple nombre", () => {
    expect(normalizeRules({ full: 25 }).full).toEqual({
      type: "fixed",
      points: 25,
    });
  });

  it("borne les valeurs absurdes au lieu de les accepter", () => {
    const rules = normalizeRules({ bonus: 1e9, yams: { type: "fixed", points: -50 } });
    expect(rules.bonus).toBe(BONUS_MAX);
    expect(rules.yams).toEqual({ type: "fixed", points: 0 });

    expect(normalizeRules({ carre: { type: "fixed", points: 99999 } }).carre).toEqual(
      { type: "fixed", points: LINE_POINTS_MAX },
    );
  });

  it("conserve le mode « somme des dés »", () => {
    expect(normalizeRules({ brelan: { type: "sum" } }).brelan).toEqual({
      type: "sum",
    });
  });
});

describe("buildGrid", () => {
  it("nomme les lignes d'après le mode choisi", () => {
    expect(grid.lowerScoringNames).toContain("Brelan (Σ)");
    expect(grid.lowerScoringNames).toContain("Full (25)");
  });

  it("retire la ligne Chance quand la règle est désactivée", () => {
    const sansChance = buildGrid({ ...DEFAULT_RULES, chance: false });
    expect(grid.lowerScoringNames).toContain("Chance (Σ)");
    expect(sansChance.lowerScoringNames).not.toContain("Chance (Σ)");
  });

  it("ne compte que les lignes saisissables, pas les totaux", () => {
    expect(grid.upperScoringNames).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(grid.allScoringNames).not.toContain(FINAL_SCORE_LINE);
  });
});

describe("computeDerived", () => {
  it("n'accorde pas le bonus sous le seuil", () => {
    const d = computeDerived(upperScores(BONUS_THRESHOLD - 1), grid);
    expect(d.bonus).toBe(0);
    expect(d.totalHaut).toBe(BONUS_THRESHOLD - 1);
  });

  it("accorde le bonus dès le seuil atteint", () => {
    const d = computeDerived(upperScores(BONUS_THRESHOLD), grid);
    expect(d.bonus).toBe(DEFAULT_RULES.bonus);
    expect(d.totalHaut).toBe(BONUS_THRESHOLD + DEFAULT_RULES.bonus);
  });

  it("affiche le reste à faire tant que la section n'est pas bouclée", () => {
    // Trois lignes seulement : 30 + 25 + 5 = 60, soit 3 points sous le seuil.
    const d = computeDerived({ "6": 30, "5": 25, "1": 5 }, grid);
    expect(d.upperFilled).toBe(false);
    expect(d.bonusHint).toBe("-3");
  });

  it("n'affiche plus de repère une fois le bonus joué", () => {
    // Six cases saisies mais sous le seuil : le bonus est définitivement perdu.
    const scores: Record<LineName, number> = {};
    for (const name of grid.upperScoringNames) scores[name] = 0;
    const d = computeDerived(scores, grid);
    expect(d.upperFilled).toBe(true);
    expect(d.bonusHint).toBeNull();
    expect(d.bonus).toBe(0);
  });

  it("ne modifie pas les scores reçus", () => {
    const scores = upperScores(BONUS_THRESHOLD);
    const copy = { ...scores };
    computeDerived(scores, grid);
    expect(scores).toEqual(copy);
  });
});

describe("writeDerived", () => {
  it("recopie les totaux dans les scores pour la persistance", () => {
    const scores: Record<LineName, number> = {
      ...upperScores(BONUS_THRESHOLD),
      "Full (25)": 25,
    };
    const d = writeDerived(scores, grid);
    expect(scores[FINAL_SCORE_LINE]).toBe(d.scoreFinal);
    expect(d.scoreFinal).toBe(BONUS_THRESHOLD + DEFAULT_RULES.bonus + 25);
  });
});

describe("isLineEnabled", () => {
  const first = grid.upperScoringNames[0];
  const second = grid.upperScoringNames[1];

  it("laisse tout ouvert en Classique, quel que soit l'état de la feuille", () => {
    expect(isLineEnabled(second, "Classique", {}, grid)).toBe(true);
  });

  it("laisse tout ouvert en One Shot", () => {
    expect(isLineEnabled(second, "One Shot", {}, grid)).toBe(true);
  });

  it("en Descendante, n'ouvre une ligne qu'après la précédente", () => {
    expect(isLineEnabled(first, "Descendante", {}, grid)).toBe(true);
    expect(isLineEnabled(second, "Descendante", {}, grid)).toBe(false);
    expect(isLineEnabled(second, "Descendante", { [first]: 0 }, grid)).toBe(true);
  });

  it("en Montante, part de la dernière ligne de la section basse", () => {
    const lower = grid.lowerScoringNames;
    const last = lower[lower.length - 1];
    const beforeLast = lower[lower.length - 2];
    expect(isLineEnabled(last, "Montante", {}, grid)).toBe(true);
    expect(isLineEnabled(beforeLast, "Montante", {}, grid)).toBe(false);
    expect(isLineEnabled(beforeLast, "Montante", { [last]: 0 }, grid)).toBe(true);
  });

  it("accepte un 0 comme valeur saisie (et non comme case vide)", () => {
    expect(isLineEnabled(second, "Descendante", { [first]: 0 }, grid)).toBe(true);
  });
});

describe("isGameFinished", () => {
  const variants: Variant[] = ["Classique"];

  function player(filled: boolean): Player {
    const scores: Record<LineName, number> = {};
    if (filled) for (const name of grid.allScoringNames) scores[name] = 0;
    return { name: "A", color: "#fff", scores: { Classique: scores } as never };
  }

  it("est fausse tant qu'une case reste vide", () => {
    expect(isGameFinished([player(false)], variants, grid)).toBe(false);
  });

  it("est vraie quand toutes les lignes saisissables sont remplies", () => {
    expect(isGameFinished([player(true)], variants, grid)).toBe(true);
  });

  it("attend que TOUS les joueurs aient fini", () => {
    expect(isGameFinished([player(true), player(false)], variants, grid)).toBe(
      false,
    );
  });
});

describe("règles personnalisées", () => {
  it("propage un bonus personnalisé jusqu'au score final", () => {
    const rules: GameRules = { ...DEFAULT_RULES, bonus: 50 };
    const custom = buildGrid(rules);
    const d = computeDerived(upperScores(BONUS_THRESHOLD), custom);
    expect(d.bonus).toBe(50);
    expect(d.scoreFinal).toBe(BONUS_THRESHOLD + 50);
  });
});
