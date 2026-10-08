// Ce que le Yams déclare au reste de l'application : en données, testable sans
// navigateur.

import { beforeEach, describe, expect, it } from "vitest";
import { YAMS } from "./gameDef";
import { createPlayers } from "./players";
import { DEFAULT_RULES } from "./scoring";
import { saveSavedGame } from "./storage/savedGameRepo";
import { saveRules } from "./storage/rulesRepo";

beforeEach(() => localStorage.clear());

describe("récapitulatif de la partie en cours", () => {
  it("décrit les variantes par leurs pastilles, en données", () => {
    saveSavedGame({
      players: createPlayers(["Alice", "Bob"], ["Classique", "Montante"]),
      selectedVariants: ["Classique", "Montante"],
      currentPlayerIndex: 0,
      rules: DEFAULT_RULES,
    });
    const resume = YAMS.resume();
    expect(resume?.playerNames).toEqual(["Alice", "Bob"]);
    expect(resume?.rows).toEqual([
      { term: "Joueurs", value: "Alice, Bob" },
      {
        term: "Variantes",
        value: {
          badges: [
            { icon: "die", color: "#3d9142", title: "Classique" },
            { icon: "up", color: "#c97e1c", title: "Montante" },
          ],
        },
      },
    ]);
  });

  it("rien à reprendre sans partie", () => {
    expect(YAMS.resume()).toBeNull();
  });
});

describe("règles affichées", () => {
  // Le barème annoncé pour le Full, ligne du tableau des combinaisons.
  const fullValue = (inGame: boolean): string | undefined =>
    YAMS.rulesDoc({ inGame })
      .flatMap((section) => section.table?.rows ?? [])
      .find(([term]) => term.startsWith("Full"))?.[1];

  beforeEach(() => {
    // Partie lancée avec un Full à 25, Paramètres passés à 30 depuis.
    saveSavedGame({
      players: createPlayers(["Alice"], ["Classique"]),
      selectedVariants: ["Classique"],
      currentPlayerIndex: 0,
      rules: DEFAULT_RULES,
    });
    saveRules({ ...DEFAULT_RULES, full: { type: "fixed", points: 30 } });
  });

  it("depuis une partie, le barème figé à son lancement", () => {
    expect(fullValue(true)).toBe("25 points");
  });

  it("hors partie, le barème des Paramètres", () => {
    expect(fullValue(false)).toBe("30 points");
  });
});
