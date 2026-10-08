// Ce que la page des règles annonce doit être exactement ce que la partie
// applique. C'est tout l'intérêt de décrire les règles en données plutôt qu'en
// HTML : on peut confronter la documentation au moteur.

import { describe, expect, it } from "vitest";
import { combinationRows, modeText, yamsRulesDoc } from "./rulesDoc";
import { BONUS_THRESHOLD, DEFAULT_RULES, buildGrid } from "./scoring";
import type { GameRules } from "./types";

const rules = (over: Partial<GameRules> = {}): GameRules => ({
  ...DEFAULT_RULES,
  ...over,
});

// Valeur maximale réellement inscriptible sur une ligne de la grille.
function maxOf(grid: ReturnType<typeof buildGrid>, line: string): number {
  const values = grid.sections[1].lines[line];
  if (!values) throw new Error(`Ligne introuvable dans la grille : ${line}`);
  return Math.max(...values);
}

describe("le barème annoncé est celui de la grille", () => {
  // Chaque ligne du tableau des règles est confrontée à ce que la grille
  // accepte vraiment. Si le barème change de forme, l'un des deux bougera.
  const cases: [string, keyof GameRules][] = [
    ["Brelan", "brelan"],
    ["Full", "full"],
    ["Carré", "carre"],
    ["Petite suite", "petiteSuite"],
    ["Grande suite", "grandeSuite"],
    ["Yams", "yams"],
  ];

  for (const [label, line] of cases) {
    it(`${label} : la page annonce ce que la grille accepte`, () => {
      const config = rules();
      const grid = buildGrid(config);
      const row = combinationRows(config).find(([term]) => term.startsWith(label));
      expect(row).toBeDefined();

      const announced = row![1];
      const max = maxOf(grid, line);
      if (announced === "la somme des 5 dés") {
        expect(max).toBe(30); // somme maximale de 5 dés
      } else {
        expect(announced).toBe(`${max} point${max > 1 ? "s" : ""}`);
      }
    });
  }

  it("annonce le mode « dés de la combinaison » tel que la grille l'applique", () => {
    const config = rules({ brelan: { type: "dice" }, carre: { type: "dice" } });
    const grid = buildGrid(config);
    const rows = new Map(combinationRows(config));
    expect(rows.get("Brelan — 3 dés identiques")).toBe("la somme des 3 dés de la combinaison");
    expect(rows.get("Carré — 4 dés identiques")).toBe("la somme des 4 dés de la combinaison");
    expect(maxOf(grid, "brelan")).toBe(18); // trois 6
    expect(maxOf(grid, "carre")).toBe(24); // quatre 6
  });

  it("suit un barème personnalisé", () => {
    const config = rules({
      full: { type: "fixed", points: 40 },
      yams: { type: "fixed", points: 100 },
      carre: { type: "sum" },
    });
    const rows = new Map(combinationRows(config));
    expect(rows.get("Full — 3 + 2 dés identiques")).toBe("40 points");
    expect(rows.get("Yams — 5 dés identiques")).toBe("100 points");
    expect(rows.get("Carré — 4 dés identiques")).toBe("la somme des 5 dés");
  });

  it("n'annonce la Chance que si elle est en jeu", () => {
    const withChance = combinationRows(rules({ chance: true })).map(([t]) => t);
    const without = combinationRows(rules({ chance: false })).map(([t]) => t);
    expect(withChance.some((t) => t.startsWith("Chance"))).toBe(true);
    expect(without.some((t) => t.startsWith("Chance"))).toBe(false);
  });

  it("annonce autant de lignes que la grille en porte", () => {
    for (const chance of [true, false]) {
      const config = rules({ chance });
      const grid = buildGrid(config);
      expect(combinationRows(config)).toHaveLength(grid.lowerScoringNames.length);
    }
  });
});

describe("modeText", () => {
  it("dit la somme des dés ou un nombre de points", () => {
    expect(modeText({ type: "sum" })).toBe("la somme des 5 dés");
    expect(modeText({ type: "fixed", points: 25 })).toBe("25 points");
    expect(modeText({ type: "fixed", points: 1 })).toBe("1 point");
    expect(modeText({ type: "fixed", points: 0 })).toBe("0 point");
  });
});

describe("le document complet", () => {
  it("annonce le bonus réglé, et son seuil", () => {
    const doc = yamsRulesDoc(rules({ bonus: 50 }));
    const table = doc.find((s) => s.table)?.table;
    const bonus = table?.rows.find(([term]) => term.startsWith("Bonus"));
    expect(bonus?.[1]).toBe("50 points");
    expect(bonus?.[0]).toContain(String(BONUS_THRESHOLD));
  });

  it("dit d'où viennent les valeurs du tableau", () => {
    const table = yamsRulesDoc(rules()).find((s) => s.table)?.table;
    expect(table?.note).toMatch(/réglages/i);
  });

  it("décrit les quatre variantes", () => {
    const variants = yamsRulesDoc(rules()).find((s) => s.title === "Les variantes");
    const text = (variants?.items ?? []).map((i) => `${i.title} ${i.text}`).join(" ");
    for (const name of ["Classique", "Montante", "Descendante", "One Shot"]) {
      expect(text).toContain(name);
    }
  });

  // Une section vide passerait inaperçue à l'écran : on veut le savoir ici.
  it("ne produit aucune section vide", () => {
    for (const section of yamsRulesDoc(rules())) {
      expect(section.title.length).toBeGreaterThan(0);
      expect((section.body?.length ?? 0) + (section.table ? 1 : 0)).toBeGreaterThan(0);
    }
  });
});

describe("exemples en vrais dés", () => {
  const examplesOf = (rules: GameRules, title: string) =>
    yamsRulesDoc(rules).find((s) => s.title === title)?.examples ?? [];

  it("les combinaisons sont comptées par le barème en vigueur", () => {
    expect(examplesOf(DEFAULT_RULES, "Les combinaisons").map((e) => e.result)).toEqual([
      "Brelan → 18 points",
      "Full → 25 points",
      "Yams → 50 points",
    ]);
  });

  it("en « dés de la combinaison », seuls les trois dés du brelan comptent", () => {
    const rules = { ...DEFAULT_RULES, brelan: { type: "dice" } } as GameRules;
    const brelan = examplesOf(rules, "Les combinaisons")[0];
    expect(brelan.result).toBe("Brelan → 15 points");
    expect(brelan.counted).toEqual([0, 1, 2]);
  });

  it("la section des chiffres montre trois 4 sur la ligne des 4", () => {
    const [example] = examplesOf(DEFAULT_RULES, "La section des chiffres");
    expect(example.dice.filter((_, i) => example.counted?.includes(i))).toEqual([4, 4, 4]);
  });
});
