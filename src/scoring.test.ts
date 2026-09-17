import { describe, expect, it } from "vitest";
import {
  BONUS_MAX,
  BONUS_THRESHOLD,
  DEFAULT_RULES,
  FINAL_SCORE_LINE,
  LINE_POINTS_MAX,
  bonusPlan,
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

describe("bonusPlan", () => {
  // `filled` : nombre de DÉS obtenus par chiffre (3 de 2 = 6 points).
  const scores = (filled: Record<number, number>): Record<LineName, number> =>
    Object.fromEntries(
      Object.entries(filled).map(([face, dice]) => [face, dice * Number(face)]),
    );

  // "2x1 2x3 4x4" : lecture compacte du plan renvoyé.
  const plan = (filled: Record<number, number>): string | null => {
    const result = bonusPlan(scores(filled), grid);
    return result && result.steps.map((s) => `${s.dice}x${s.line}`).join(" ");
  };

  it("se tait tant qu'il reste plus de quatre chiffres à jouer", () => {
    expect(bonusPlan(scores({ 6: 3 }), grid)).toBeNull();
  });

  it("apparaît dès qu'il ne reste que quatre chiffres", () => {
    expect(bonusPlan(scores({ 5: 3, 6: 3 }), grid)).not.toBeNull();
  });

  it("se tait quand le bonus est déjà acquis", () => {
    expect(bonusPlan(scores({ 4: 5, 5: 5, 6: 5 }), grid)).toBeNull();
  });

  // Le cas qui justifie la fonctionnalité : sur un reste épars, la combinaison
  // la plus probable n'est pas "3 de chaque".
  it("charge les gros chiffres quand le reste est épars", () => {
    expect(plan({ 2: 3, 5: 3, 6: 3 })).toBe("2x1 2x3 4x4");
  });

  it("garde 3 de chaque quand c'est bien le plus probable", () => {
    expect(plan({ 1: 3, 2: 3, 3: 3 })).toBe("3x4 3x5 3x6");
  });

  it("omet un chiffre dont le plan n'a pas besoin", () => {
    expect(plan({ 2: 5, 3: 5, 5: 5 })).toBe("1x4 2x6");
  });

  it("porte l'indice sur le plus grand chiffre restant", () => {
    expect(bonusPlan(scores({ 2: 3, 3: 3, 6: 3 }), grid)?.host).toBe("5");
  });

  it("préfère moins de dés à probabilité égale", () => {
    // 45 points acquis (0 sur les 2, 3 dés de 5, 5 dés de 6), il manque 18 sur
    // les 1, 3 et 4 : 2x3 + 3x4, soit 5 dés, plutôt qu'une répartition plus
    // coûteuse à probabilité identique.
    expect(plan({ 2: 0, 5: 3, 6: 5 })).toBe("2x3 3x4");
  });

  it("annonce un besoin littéral quand le bonus est hors d'atteinte", () => {
    // 55 points acquis, il ne reste que les 1 et il manque 8 points : le plan
    // réclame 8 dés là où le joueur n'en a que cinq.
    const result = bonusPlan(scores({ 2: 0, 3: 0, 4: 0, 5: 5, 6: 5 }), grid);
    expect(result?.hopeless).toBe(true);
    expect(result?.steps).toEqual([{ line: "1", dice: 8 }]);
  });

  it("reste réalisable tant que le bonus l'est", () => {
    // Aucun plan atteignable ne doit demander plus de cinq dés sur une ligne.
    for (let dice = 0; dice <= 5; dice++) {
      const result = bonusPlan(scores({ 1: dice, 2: dice, 3: dice }), grid);
      if (!result || result.hopeless) continue;
      for (const step of result.steps) expect(step.dice).toBeLessThanOrEqual(5);
    }
  });
});
