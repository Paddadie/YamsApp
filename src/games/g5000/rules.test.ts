import { describe, expect, it } from "vitest";
import {
  bestValue,
  canKeep,
  pickCombo,
  combosOf,
  countsOf,
  DEFAULT_RULES,
  groupValue,
  highestThousand,
  isBust,
  normalizeRules,
  SCORE_STEP,
} from "./rules";
import type { Face, G5000Rules, G5000Variant } from "./types";

const rules = (over: Partial<G5000Rules> = {}): G5000Rules => ({
  ...DEFAULT_RULES,
  ...over,
});

const value = (dice: Face[], open: Face[] = [], over: Partial<G5000Rules> = {}) =>
  bestValue(countsOf(dice), open, rules(over));

describe("barème de base", () => {
  it("compte les 1 à 100 et les 5 à 50", () => {
    expect(value([1, 2, 3, 4, 6])).toBe(100);
    expect(value([5, 2, 2, 4, 6])).toBe(50);
    expect(value([1, 5, 2, 2, 4])).toBe(150);
    expect(value([1, 1, 5, 5, 2])).toBe(300);
  });

  it("ne donne rien aux 2, 3, 4 et 6 isolés", () => {
    expect(value([2, 3, 4, 6, 2])).toBe(0);
  });

  it("donne au brelan sa valeur × 100, et 1 000 aux as", () => {
    expect(value([2, 2, 2, 3, 4])).toBe(200);
    expect(value([3, 3, 3, 2, 4])).toBe(300);
    expect(value([6, 6, 6, 2, 3])).toBe(600);
    expect(value([1, 1, 1, 2, 3])).toBe(1000);
  });

  it("double le brelan pour un carré et le redouble pour une quinte", () => {
    expect(value([3, 3, 3, 3, 2])).toBe(600);
    expect(value([3, 3, 3, 3, 3])).toBe(1200);
    expect(value([1, 1, 1, 1, 2])).toBe(2000);
    expect(value([1, 1, 1, 1, 1])).toBe(4000);
  });

  it("compte les deux suites", () => {
    expect(value([1, 2, 3, 4, 5])).toBe(1000);
    expect(value([2, 3, 4, 5, 6])).toBe(1000);
    expect(value([5, 3, 1, 4, 2])).toBe(1000); // l'ordre du lancer est sans effet
  });

  it("ne reconnaît pas de suite quand la règle les désactive", () => {
    expect(value([1, 2, 3, 4, 5], [], { runPoints: 0 })).toBe(150);
  });

  it("additionne un brelan et les dés isolés du même lancer", () => {
    expect(value([3, 3, 3, 1, 5])).toBe(450);
  });
});

describe("variante « Combo »", () => {
  const open: Partial<G5000Rules> = { variants: ["combo"] };

  it("ajoute 100 à chaque dé du chiffre ouvert", () => {
    expect(value([3, 2, 4, 6, 6], [3], open)).toBe(100);
    expect(value([3, 3, 2, 4, 6], [3], open)).toBe(200);
  });

  it("porte un 1 ouvert à 200 et un 5 ouvert à 150", () => {
    expect(value([1, 2, 3, 4, 6], [1], open)).toBe(200);
    expect(value([5, 2, 2, 4, 6], [5], open)).toBe(150);
  });

  it("retient le calcul le plus favorable : le 2 ouvert bat son propre brelan", () => {
    // Brelan de 2 = 200, mais trois dés ouverts valent 3 × 100 = 300.
    expect(groupValue(2, 3, true, DEFAULT_RULES)).toBe(300);
    expect(groupValue(2, 3, false, DEFAULT_RULES)).toBe(200);
  });

  it("garde la combinaison quand elle reste meilleure", () => {
    expect(groupValue(6, 3, true, DEFAULT_RULES)).toBe(600); // brelan plutôt que 3 × 100
    expect(groupValue(1, 3, true, DEFAULT_RULES)).toBe(1000);
    expect(groupValue(5, 3, true, DEFAULT_RULES)).toBe(500);
    expect(groupValue(3, 3, true, DEFAULT_RULES)).toBe(300); // les deux lectures se valent
  });

  it("laisse le carré primer sur les dés ouverts", () => {
    expect(value([3, 3, 3, 3, 2], [3], open)).toBe(600);
  });

  it("ne change rien quand l'option est désactivée", () => {
    expect(value([3, 2, 4, 6, 6], [3])).toBe(0);
  });

  it("évite le bust : un chiffre ouvert marque toujours", () => {
    const dice = countsOf([3, 2, 4, 6, 6]);
    expect(isBust(dice, [], rules(open))).toBe(true);
    expect(isBust(dice, [3], rules(open))).toBe(false);
  });
});

describe("bust", () => {
  it("reconnaît un lancer qui ne marque rien", () => {
    expect(isBust(countsOf([2, 3, 4, 6, 2]), [], rules())).toBe(true);
  });

  it("ne déclare pas bust un lancer qui porte un brelan", () => {
    expect(isBust(countsOf([2, 2, 2, 3, 4]), [], rules())).toBe(false);
  });
});

describe("combinaisons proposées", () => {
  it("propose chaque groupe et chaque dé isolé", () => {
    const combos = combosOf(countsOf([3, 3, 3, 1, 5]), [], rules());
    const labels = combos.map((c) => c.label);
    expect(labels).toContain("Brelan de 3");
    expect(labels).toContain("Un 1");
    expect(labels).toContain("Un 5");
  });

  it("laisse le choix de ne garder que trois dés d'un carré", () => {
    const combos = combosOf(countsOf([3, 3, 3, 3, 2]), [], rules());
    expect(combos.map((c) => c.label)).toEqual([
      "Carré de 3",
      "Brelan de 3 (garder 3)",
    ]);
    expect(combos[0].points).toBe(600);
    expect(combos[1].points).toBe(300);
  });

  it("dit quel chiffre un brelan active, avec la variante Combo seulement", () => {
    const combo = combosOf(countsOf([3, 3, 3, 1, 5]), [], rules({ variants: ["combo"] }));
    expect(combo.find((c) => c.label === "Brelan de 3")?.opens).toBe(3);
    expect(combo.find((c) => c.label === "Un 1")?.opens).toBeNull();
    const plain = combosOf(countsOf([3, 3, 3, 1, 5]), [], rules());
    expect(plain.find((c) => c.label === "Brelan de 3")?.opens).toBeNull();
  });

  it("n'active pas deux fois le même chiffre, et signale ses dés", () => {
    const combos = combosOf(
      countsOf([3, 3, 3, 1, 5]),
      [3],
      rules({ variants: ["combo"] }),
    );
    const brelan = combos.find((c) => c.label === "Brelan de 3");
    expect(brelan?.opens).toBeNull();
    expect(brelan?.boosted).toBe(true);
    expect(combos.find((c) => c.label === "Un 1")?.boosted).toBeUndefined();
  });

  it("une suite consomme les cinq dés et exclut toute autre lecture", () => {
    const combos = combosOf(countsOf([1, 2, 3, 4, 5]), [], rules());
    expect(combos).toHaveLength(1);
    expect(combos[0].dice).toHaveLength(5);
  });

  it("ne propose rien sur un bust", () => {
    expect(combosOf(countsOf([2, 3, 4, 6, 2]), [], rules())).toEqual([]);
  });
});

describe("invariant des multiples de 50", () => {
  // La cible doit rester atteignable en mode « score exact » : si un score
  // pouvait tomber à côté du pas de 50, un joueur resterait bloqué à jamais.
  it("aucun lancer possible ne produit un score hors du pas de 50", () => {
    const faces: Face[] = [1, 2, 3, 4, 5, 6];
    const dice: Face[] = [1, 1, 1, 1, 1];
    let checked = 0;

    // Les 16 barèmes essayés, construits une fois : les refaire pour chacun des
    // 7 776 lancers, et un `expect` par essai, menait ce test au bord de sa
    // limite de 5 s (il a échoué sur une machine chargée, 08/10). Les écarts
    // sont rassemblés et vérifiés d'un coup : même couverture.
    const rulesSets = (
      [[], ["combo"]] as G5000Variant[][]
    ).flatMap((variants) =>
      (["classic", "custom"] as const).flatMap((tripleKind) =>
        (["double", "half"] as const).flatMap((fourKind) =>
          (["doubleFour", "doubleThree"] as const).map((fiveKind) =>
            normalizeRules({
              variants,
              tripleKind,
              fourKind,
              fiveKind,
              customTriples: [250, 150, 350, 450, 550, 650],
            }),
          ),
        ),
      ),
    );
    const offStep: string[] = [];

    const walk = (i: number): void => {
      if (i === 5) {
        checked++;
        const counts = countsOf(dice);
        for (const open of [[], [1], [5], [2, 6]] as Face[][]) {
          for (const r of rulesSets) {
            const value = bestValue(counts, open, r);
            if (value % SCORE_STEP !== 0) offStep.push(`${dice.join("")} → ${value}`);
          }
        }
        return;
      }
      for (const f of faces) {
        dice[i] = f;
        walk(i + 1);
      }
    };
    walk(0);
    expect(rulesSets).toHaveLength(16);
    expect(checked).toBe(6 ** 5);
    expect(offStep).toEqual([]);
  });
});

describe("normalizeRules", () => {
  it("complète un objet vide avec les valeurs par défaut", () => {
    expect(normalizeRules({})).toEqual(DEFAULT_RULES);
    expect(normalizeRules(null)).toEqual(DEFAULT_RULES);
    expect(normalizeRules("n'importe quoi")).toEqual(DEFAULT_RULES);
  });

  it("arrondit la cible au pas de 50", () => {
    expect(normalizeRules({ target: 5020 }).target).toBe(5000);
    expect(normalizeRules({ target: 5030 }).target).toBe(5050);
  });

  it("borne les valeurs absurdes", () => {
    expect(normalizeRules({ target: -100 }).target).toBe(500);
    expect(normalizeRules({ target: 1e9 }).target).toBe(20000);
    expect(normalizeRules({ blankTurnsPenalty: 99 }).blankTurnsPenalty).toBe(9);
    expect(normalizeRules({ blankTurnsPenalty: -1 }).blankTurnsPenalty).toBe(0);
  });

  it("garde les réglages reconnus", () => {
    const custom = normalizeRules({
      target: 10000,
      fourKind: "half",
      fiveKind: "doubleThree",
      lastRound: false,
      variants: ["combo", "sniper"],
    });
    expect(custom.target).toBe(10000);
    expect(custom.fourKind).toBe("half");
    expect(custom.fiveKind).toBe("doubleThree");
    expect(custom.lastRound).toBe(false);
    expect(custom.openAt).toBe(DEFAULT_RULES.openAt);
  });

  it("garde la riposte d'une partie qui l'avait désactivée avant les variantes", () => {
    expect(normalizeRules({ tieRule: true, lastRound: false }).lastRound).toBe(false);
    expect(normalizeRules({}).lastRound).toBe(true);
  });

  it("range les variantes dans l'ordre du catalogue, sans doublon ni intrus", () => {
    expect(
      normalizeRules({ variants: ["combo", "sniper", "combo", "inconnue", 3] }).variants,
    ).toEqual(["sniper", "combo"]);
  });

  it("refuse un carré ou une quinte inconnus", () => {
    const r = normalizeRules({ fourKind: "triple", fiveKind: 12 });
    expect(r.fourKind).toBe("double");
    expect(r.fiveKind).toBe("doubleFour");
  });

  it("« Perso » sans valeurs lisibles retombe sur le réglage par défaut", () => {
    const r = normalizeRules({ fourKind: "custom", customFours: [1, 2, 3] });
    expect(r.fourKind).toBe("double");
    expect(r.customFours).toBeNull();
  });

  it("ramène les valeurs saisies au pas de 50, entre 50 et 20 000", () => {
    const r = normalizeRules({
      tripleKind: "custom",
      customTriples: [1020, 0, -5, 333, 1e9, 600],
    });
    expect(r.customTriples).toEqual([1000, 50, 50, 350, 20000, 600]);
  });

  it("ne lit plus l'ancien « ne compte pas »", () => {
    const r = normalizeRules({ fourKind: "none", fiveKind: "none" });
    expect(r.fourKind).toBe("double");
    expect(r.fiveKind).toBe("doubleFour");
  });

  // Une partie lancée avant les variantes doit finir avec ses règles d'alors.
  it("convertit les anciens interrupteurs en variantes", () => {
    expect(normalizeRules({ tieRule: true, exactTarget: true }).variants).toEqual([
      "sniper",
      "exact",
    ]);
    // Sans les anciens interrupteurs, rien n'est à convertir.
    expect(normalizeRules({ target: 5000 }).variants).toEqual([]);
    expect(
      normalizeRules({
        tieRule: false,
        exactTarget: false,
        hotDiceMustReroll: false,
        openDigits: true,
      }).variants,
    ).toEqual(["combo", "freeHotDice"]);
  });
});

describe("réglages du carré et de la quinte", () => {
  it("compte un carré à 1,5 × le brelan, et la quinte au double de ce carré", () => {
    const half = { fourKind: "half" } as const;
    expect(value([5, 5, 5, 5, 2], [], half)).toBe(750);
    expect(value([1, 1, 1, 1, 2], [], half)).toBe(1500);
    expect(value([4, 4, 4, 4, 4], [], half)).toBe(1200);
  });

  it("compte une quinte au double du brelan", () => {
    expect(value([4, 4, 4, 4, 4], [], { fiveKind: "doubleThree" })).toBe(800);
  });

  it("lit les valeurs saisies, chiffre par chiffre", () => {
    const r = {
      tripleKind: "custom",
      customTriples: [1500, 250, 300, 400, 500, 600],
      fourKind: "custom",
      customFours: [3000, 500, 700, 900, 1100, 1300],
      fiveKind: "custom",
      customFives: [5000, 1000, 1400, 1800, 2200, 2600],
    } as const;
    const custom = normalizeRules(r);
    expect(value([1, 1, 1, 3, 4], [], custom)).toBe(1500);
    expect(value([2, 2, 2, 3, 4], [], custom)).toBe(250);
    expect(value([3, 3, 3, 3, 2], [], custom)).toBe(700);
    expect(value([1, 1, 1, 1, 1], [], custom)).toBe(5000);
  });

  it("calcule « 2 × le brelan » sur un brelan saisi, arrondi au pas", () => {
    const r = normalizeRules({
      tripleKind: "custom",
      customTriples: [1000, 250, 300, 400, 500, 600],
      fourKind: "half",
    });
    // 1,5 × 250 = 375, ramené à 400 : aucun score ne sort du pas de 50.
    expect(value([2, 2, 2, 2, 3], [], r)).toBe(400);
  });

  it("garde la meilleure lecture quand un carré saisi vaut moins qu'un brelan et un 1", () => {
    const r = normalizeRules({ fourKind: "custom", customFours: [1050, 400, 600, 800, 1000, 1200] });
    // Brelan de 1 (1 000) + un 1 (100) = 1 100 > carré saisi à 1 050.
    expect(value([1, 1, 1, 1, 2], [], r)).toBe(1100);
  });
});

describe("ordre des combinaisons proposées", () => {
  // Ce qui rapporte le plus doit venir en tête : construite face par face, la
  // liste plaçait « Un 1 » au-dessus d'un brelan trois fois plus payant.
  it("classe par gain décroissant", () => {
    const labels = combosOf(countsOf([3, 3, 3, 1, 2]), [], rules()).map((c) => c.label);
    expect(labels).toEqual(["Brelan de 3", "Un 1"]);
  });

  it("place le carré avant le brelan qu'il contient", () => {
    const labels = combosOf(countsOf([3, 3, 3, 3, 1]), [], rules()).map((c) => c.label);
    expect(labels.slice(0, 2)).toEqual(["Carré de 3", "Brelan de 3 (garder 3)"]);
  });

  // À gain égal, garder moins de dés laisse plus à relancer.
  it("préfère la garde la plus légère à gain égal", () => {
    const combos = combosOf(countsOf([1, 1, 1, 5, 5]), [], rules());
    for (let i = 1; i < combos.length; i++) {
      const before = combos[i - 1];
      const after = combos[i];
      expect(before.points > after.points ||
        (before.points === after.points && before.dice.length <= after.dice.length)).toBe(true);
    }
  });
});

describe("dés gardés dans un même lancer", () => {
  const roll = (dice: Face[]) => {
    const counts = countsOf(dice);
    const combos = combosOf(counts, [], rules());
    const pick = (id: string) => combos.find((c) => c.id === id)!;
    return { counts, pick };
  };

  it("refuse de compter deux fois le même dé", () => {
    // Quatre 1 lancés : le carré les prend tous, il n'en reste pas pour « Un 1 ».
    const { counts, pick } = roll([1, 1, 1, 1, 2]);
    expect(canKeep([pick("g1x4")], pick("s1x1"), counts)).toBe(false);
    expect(canKeep([pick("s1x3")], pick("s1x2"), counts)).toBe(false);
  });

  it("accepte des options qui se partagent les dés disponibles", () => {
    const { counts, pick } = roll([1, 1, 1, 1, 2]);
    expect(canKeep([pick("g1x3")], pick("s1x1"), counts)).toBe(true);
  });

  it("accepte des faces différentes tant que chacune suffit", () => {
    const { counts, pick } = roll([1, 5, 5, 3, 4]);
    expect(canKeep([pick("s1x1")], pick("s5x2"), counts)).toBe(true);
    expect(canKeep([pick("s5x2")], pick("s5x1"), counts)).toBe(false);
  });

  it("accepte toujours la première option retenue", () => {
    const { counts, pick } = roll([1, 2, 3, 4, 5]);
    expect(canKeep([], pick("run"), counts)).toBe(true);
  });
});

describe("toucher une combinaison (pickCombo)", () => {
  const roll = (dice: Face[]) => {
    const counts = countsOf(dice);
    const combos = combosOf(counts, [], rules());
    const pick = (id: string) => combos.find((c) => c.id === id)!;
    return { counts, pick };
  };
  const ids = (list: { id: string }[]) => list.map((c) => c.id);

  it("passe du brelan à la quinte sans désélection préalable", () => {
    const { counts, pick } = roll([2, 2, 2, 2, 2]);
    const brelan = pickCombo([], pick("g2x3"), counts);
    expect(ids(pickCombo(brelan, pick("g2x5"), counts))).toEqual(["g2x5"]);
  });

  it("garde les combinaisons compatibles avec la nouvelle", () => {
    const { counts, pick } = roll([1, 3, 3, 3, 5]);
    const first = pickCombo([], pick("s1x1"), counts);
    expect(ids(pickCombo(first, pick("g3x3"), counts))).toEqual(["s1x1", "g3x3"]);
  });

  it("ne lâche que ce qui partage les dés de la nouvelle", () => {
    const { counts, pick } = roll([1, 1, 5, 5, 3]);
    let picked = pickCombo([], pick("s1x2"), counts);
    picked = pickCombo(picked, pick("s5x1"), counts);
    // « Un 1 » remplace « 2 × 1 », « Un 5 » reste.
    expect(ids(pickCombo(picked, pick("s1x1"), counts))).toEqual(["s5x1", "s1x1"]);
  });

  it("ne garde jamais plus de dés d'une face qu'il n'y en a", () => {
    const { counts, pick } = roll([1, 1, 1, 1, 2]);
    const carre = pickCombo([], pick("g1x4"), counts);
    const picked = pickCombo(carre, pick("s1x1"), counts);
    expect(ids(picked)).toEqual(["s1x1"]);
    expect(picked.every((c, i) => canKeep(picked.slice(0, i), c, counts))).toBe(true);
  });
});


describe("saisie manuelle : le plus haut millier", () => {
  it("deux fois l'objectif, jamais au-delà de 20 000", () => {
    expect(highestThousand(5000)).toBe(10000);
    expect(highestThousand(10000)).toBe(20000);
    expect(highestThousand(20000)).toBe(20000);
    expect(highestThousand(3000)).toBe(6000);
  });
});
