import { beforeEach, describe, expect, it } from "vitest";
import {
  impactFor,
  isHallOfFameImpact,
  previewHallOfFame,
  saveBestAndWorstScores,
} from "./hallOfFame";
import {
  getBestScores,
  getWorstScores,
  saveBestScores,
  saveWorstScores,
} from "./storage/hallOfFameRepo";
import { DEFAULT_RULES, FINAL_SCORE_LINE, buildGrid } from "./scoring";
import type { Player, ScoreEntry, Variant } from "./types";

const grid = buildGrid(DEFAULT_RULES);

function player(name: string, scores: Partial<Record<Variant, number>>): Player {
  const sheets = {} as Player["scores"];
  for (const [variant, final] of Object.entries(scores)) {
    sheets[variant as Variant] = { [FINAL_SCORE_LINE]: final };
  }
  return { name, color: "#fff", scores: sheets };
}

function entry(name: string, score: number, variant: Variant = "Classique"): ScoreEntry {
  return { name, score, date: "01/01/2026", variant };
}

beforeEach(() => {
  localStorage.clear();
});

describe("saveBestAndWorstScores", () => {
  it("enregistre un score final par joueur et par variante", () => {
    saveBestAndWorstScores(
      [player("Anne", { Classique: 250, Montante: 90 })],
      ["Classique", "Montante"],
      grid,
    );
    expect(getBestScores().map((e) => e.score)).toEqual([250, 90]);
  });

  it("ne garde que les cinq meilleurs", () => {
    saveBestScores([10, 20, 30, 40, 50].map((n) => entry("Ancien", n)));
    saveBestAndWorstScores([player("Anne", { Classique: 45 })], ["Classique"], grid);

    const scores = getBestScores().map((e) => e.score);
    expect(scores).toHaveLength(5);
    expect(scores).toEqual([50, 45, 40, 30, 20]);
  });

  it("ne garde que les cinq pires, du plus bas au plus haut", () => {
    saveWorstScores([100, 110, 120, 130, 140].map((n) => entry("Ancien", n)));
    saveBestAndWorstScores([player("Anne", { Classique: 105 })], ["Classique"], grid);

    expect(getWorstScores().map((e) => e.score)).toEqual([100, 105, 110, 120, 130]);
  });

  it("exclut les variantes non classiques des pires scores", () => {
    saveBestAndWorstScores(
      [player("Anne", { Classique: 200, Montante: 10 })],
      ["Classique", "Montante"],
      grid,
    );
    // La Montante produit des scores très bas : elle polluerait le classement.
    expect(getWorstScores().map((e) => e.variant)).toEqual(["Classique"]);
  });

  it("joint la feuille de score détaillée à chaque entrée", () => {
    saveBestAndWorstScores([player("Anne", { Classique: 200 })], ["Classique"], grid);
    const [saved] = getBestScores();
    expect(saved.sheet).toBeDefined();
    expect(saved.lineOrder).toContain(FINAL_SCORE_LINE);
  });
});

describe("previewHallOfFame", () => {
  it("annonce exactement les entrées que l'enregistrement retiendra", () => {
    // Invariant clé : l'écran de fin affiche 🏆 avant l'écriture, la liste
    // écrite ensuite doit correspondre. Les deux calculs sont séparés dans le
    // code — ce test les tient alignés.
    const existing = [10, 20, 30, 40, 50].map((n) => entry("Ancien", n));
    const players = [player("Anne", { Classique: 45 }), player("Bob", { Classique: 5 })];

    saveBestScores(existing);
    const preview = previewHallOfFame(players, ["Classique"]);

    saveBestScores(existing); // remet l'état d'avant la prévisualisation
    saveWorstScores([]);
    saveBestAndWorstScores(players, ["Classique"], grid);

    const kept = new Set(getBestScores().map((e) => `${e.name}:${e.score}`));
    expect(impactFor(preview, "Anne", "Classique").inBest).toBe(
      kept.has("Anne:45"),
    );
    expect(impactFor(preview, "Bob", "Classique").inBest).toBe(
      kept.has("Bob:5"),
    );
  });

  it("compte les entrées qui rejoignent chaque classement", () => {
    const preview = previewHallOfFame(
      [player("Anne", { Classique: 200 }), player("Bob", { Classique: 100 })],
      ["Classique"],
    );
    expect(preview.best).toHaveLength(2);
    expect(preview.worst).toHaveLength(2);
  });

  it("signale un nouveau record quand le meilleur score est battu", () => {
    saveBestScores([entry("Ancien", 200)]);
    const preview = previewHallOfFame([player("Anne", { Classique: 250 })], [
      "Classique",
    ]);
    expect(preview.newRecord?.name).toBe("Anne");
    expect(preview.newRecord?.score).toBe(250);
  });

  it("ne signale rien quand le record tient", () => {
    saveBestScores([entry("Ancien", 300)]);
    const preview = previewHallOfFame([player("Anne", { Classique: 250 })], [
      "Classique",
    ]);
    expect(preview.newRecord).toBeNull();
  });

  it("ne signale pas de record à la toute première partie", () => {
    // Aucun score antérieur : il n'y a rien à battre, la bannière resterait
    // absurde (« nouveau record » pour la seule partie du téléphone).
    const preview = previewHallOfFame([player("Anne", { Classique: 250 })], [
      "Classique",
    ]);
    expect(preview.newRecord).toBeNull();
  });

  it("ignore un joueur dont la feuille n'a pas de score final", () => {
    const incomplete: Player = { name: "Vide", color: "#fff", scores: {} as never };
    const preview = previewHallOfFame([incomplete], ["Classique"]);
    expect(preview.best).toHaveLength(0);
  });
});

describe("impact mémorisé dans la partie", () => {
  it("survit à un aller-retour JSON", () => {
    saveBestScores([entry("Ancien", 200)]);
    const preview = previewHallOfFame([player("Anne", { Classique: 250 })], [
      "Classique",
    ]);

    const restored: unknown = JSON.parse(JSON.stringify(preview));
    expect(isHallOfFameImpact(restored)).toBe(true);
    expect(restored).toEqual(preview);
  });

  it("garde la bannière de record après enregistrement des scores", () => {
    // Le bug corrigé : au rafraîchissement de l'écran de fin, le Hall of Fame
    // contient déjà le score, donc le recalcul ne voit plus de record. L'impact
    // mémorisé, lui, reste juste.
    saveBestScores([entry("Ancien", 200)]);
    const players = [player("Anne", { Classique: 250 })];

    const memorised = previewHallOfFame(players, ["Classique"]);
    saveBestAndWorstScores(players, ["Classique"], grid);
    const recomputed = previewHallOfFame(players, ["Classique"]);

    expect(memorised.newRecord?.score).toBe(250);
    expect(recomputed.newRecord).toBeNull(); // ce que l'écran affichait avant
    expect(isHallOfFameImpact(memorised)).toBe(true);
  });

  it("rejette un impact de forme inattendue", () => {
    expect(isHallOfFameImpact(undefined)).toBe(false);
    expect(isHallOfFameImpact({ best: ["a"] })).toBe(false);
    expect(isHallOfFameImpact({ best: [], worst: [], newRecord: null })).toBe(true);
    expect(isHallOfFameImpact({ best: [], worst: [], newRecord: {} })).toBe(false);
  });
});
