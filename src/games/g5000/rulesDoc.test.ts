// Ce que la page des règles du 5000 annonce doit être ce que le moteur calcule.

import { describe, expect, it } from "vitest";
import { g5000RulesDoc, scoringExamples, scoringRows, type RulesScope } from "./rulesDoc";
import { DEFAULT_RULES, bestValue, countsOf, groupValue } from "./rules";
import { G5000_VARIANTS } from "./variants";
import type { G5000Rules } from "./types";
import { formatScore } from "../../core/format";

const rules = (over: Partial<G5000Rules> = {}): G5000Rules => ({
  ...DEFAULT_RULES,
  ...over,
});

const row = (r: G5000Rules, prefix: string): string | undefined =>
  scoringRows(r).find(([term]) => term.startsWith(prefix))?.[1];

const text = (r: G5000Rules, scope: RulesScope = "all"): string =>
  g5000RulesDoc(r, scope)
    .flatMap((s) => [
      s.title,
      ...(s.body ?? []),
      ...(s.table?.rows.flat() ?? []),
      ...(s.items?.flatMap((i) => [i.title, i.text]) ?? []),
    ])
    .join(" ");

const pts = (n: number): string => `${formatScore(n)} points`;

describe("le barème annoncé est celui du moteur", () => {
  it("un 1 et un 5", () => {
    expect(row(rules(), "Un 1")).toBe(pts(bestValue(countsOf([1, 2, 3, 4, 6]), [], rules())));
    expect(row(rules(), "Un 5")).toBe(pts(bestValue(countsOf([5, 2, 2, 4, 6]), [], rules())));
  });

  it("les brelans, du 2 au 6", () => {
    // Chaque main ne porte que le brelan : les deux autres dés ne marquent pas.
    const hands = [
      countsOf([2, 2, 2, 3, 4]),
      countsOf([3, 3, 3, 2, 4]),
      countsOf([4, 4, 4, 2, 3]),
      countsOf([5, 5, 5, 2, 3]),
      countsOf([6, 6, 6, 2, 3]),
    ];
    const announced = row(rules(), "Brelan de 2")?.split(" · ").map(Number);
    expect(announced).toEqual(hands.map((hand) => bestValue(hand, [], rules())));
  });

  it("le brelan de 1", () => {
    expect(row(rules(), "Brelan de 1")).toBe(pts(groupValue(1, 3, false, rules())));
  });

  it("par défaut, le carré double le brelan et la quinte double le carré", () => {
    const r = rules();
    expect(row(r, "Carré")).toBe("2 × le brelan");
    expect(row(r, "Quinte")).toBe("2 × le carré");
    expect(groupValue(4, 4, false, r)).toBe(2 * groupValue(4, 3, false, r));
    expect(groupValue(4, 5, false, r)).toBe(2 * groupValue(4, 4, false, r));
  });

  it("le carré à 1,5 × le brelan, la quinte au double du brelan", () => {
    const r = rules({ fourKind: "half", fiveKind: "doubleThree" });
    expect(row(r, "Carré")).toBe("1,5 × le brelan");
    expect(row(r, "Quinte")).toBe("2 × le brelan");
    expect(groupValue(4, 4, false, r)).toBe(1.5 * groupValue(4, 3, false, r));
    expect(groupValue(4, 5, false, r)).toBe(2 * groupValue(4, 3, false, r));
  });

  it("des valeurs saisies : une ligne par chiffre", () => {
    const r = rules({
      fourKind: "custom",
      customFours: [3000, 500, 700, 900, 1100, 1300],
    });
    expect(row(r, "Carré de 1")).toBe(pts(3000));
    expect(row(r, "Carré de 6")).toBe(pts(1300));
    expect(scoringRows(r).filter(([term]) => term.startsWith("Carré"))).toHaveLength(6);
    // La quinte « 2 × le carré » suit le carré saisi.
    expect(groupValue(2, 5, false, r)).toBe(1000);
  });

  it("les suites, à leur valeur réglée", () => {
    expect(row(rules({ runPoints: 1500 }), "Suite")).toBe(pts(1500));
    expect(bestValue(countsOf([1, 2, 3, 4, 5]), [], rules({ runPoints: 1500 }))).toBe(1500);
  });

  it("n'annonce pas de suite quand elles ne comptent pas", () => {
    expect(row(rules({ runPoints: 0 }), "Suite")).toBeUndefined();
  });
});

describe("le document suit les réglages", () => {
  it("annonce l'objectif réglé", () => {
    expect(text(rules({ target: 10000 }))).toContain(formatScore(10000));
  });

  it("parle de l'ouverture seulement si elle existe", () => {
    expect(text(rules({ openAt: 500 }))).toContain("Entrer en jeu");
    expect(text(rules({ openAt: 0 }))).not.toContain("Entrer en jeu");
  });

  it("annonce le nombre de busts d'affilée, seulement si la règle existe", () => {
    expect(text(rules({ blankTurnsPenalty: 4 }))).toContain("4 busts de suite");
    expect(text(rules({ blankTurnsPenalty: 0 }))).not.toContain("busts de suite");
  });

  it("dit la fin selon la riposte", () => {
    expect(text(rules({ lastRound: true }))).toContain("chaque adversaire joue un dernier tour");
    expect(text(rules({ lastRound: false }))).toContain("on finit le tour de table");
  });

  it("dit la main pleine obligatoire, la riposte et l'abri du vainqueur", () => {
    const doc = text(rules());
    expect(doc).toContain("vous devez relancer");
    expect(doc).toContain("dernier tour");
    expect(doc).toContain("ne peut plus redescendre");
    expect(doc).toContain("le premier arrivé passe devant");
  });
});

describe("les variantes", () => {
  const variants = (r: G5000Rules, scope: RulesScope) =>
    g5000RulesDoc(r, scope).find((s) => s.kind === "variants");

  it("depuis le menu : toutes, même sans aucune cochée", () => {
    const section = variants(rules(), "all");
    for (const v of G5000_VARIANTS) {
      expect(section?.items?.some((i) => i.title === v.label && i.icon === v.icon)).toBe(true);
    }
  });

  it("pendant une partie : seulement celles de la partie", () => {
    const section = variants(rules({ variants: ["sniper", "combo"] }), "game");
    expect(section?.items?.map((i) => i.title)).toEqual(["Sniper", "Combo"]);
  });

  it("pendant une partie sans variante : pas de section", () => {
    expect(variants(rules(), "game")).toBeUndefined();
  });

  it("« Dans le mille » annonce l'objectif de la partie", () => {
    expect(text(rules({ target: 20000, variants: ["exact"] }), "game")).toContain(
      `exactement ${pts(20000)}`,
    );
  });

  it("Combo annonce les valeurs telles que le moteur les compte", () => {
    const doc = text(rules({ variants: ["combo"] }), "game");
    expect(doc).toContain(`un 1 vaut ${groupValue(1, 1, true, rules())}`);
    expect(doc).toContain(`un 5 vaut ${groupValue(5, 1, true, rules())}`);
    expect(doc).toContain(`un 3 vaut ${groupValue(3, 1, true, rules())}`);
  });
});

describe("exemples en vrais dés", () => {
  it("comptés par le moteur, et la suite seulement si elle rapporte", () => {
    const examples = scoringExamples(DEFAULT_RULES);
    const brelanEtCinq = bestValue(countsOf([1, 1, 1, 5]), [], DEFAULT_RULES);
    expect(examples[0].result).toBe(
      `Brelan de 1 et un 5 → ${formatScore(brelanEtCinq)} points`,
    );
    expect(examples[1].result).toBe("Rien ne rapporte → bust");
    expect(examples.some((e) => e.result.startsWith("Suite"))).toBe(DEFAULT_RULES.runPoints > 0);
    const noRun = scoringExamples({ ...DEFAULT_RULES, runPoints: 0 });
    expect(noRun.some((e) => e.result.startsWith("Suite"))).toBe(false);
  });
});
