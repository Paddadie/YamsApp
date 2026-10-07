// Ce que le Yams déclare au reste de l'application : en données, testable sans
// navigateur.

import { beforeEach, describe, expect, it } from "vitest";
import { YAMS } from "./gameDef";
import { createPlayers } from "./players";
import { DEFAULT_RULES } from "./scoring";
import { saveSavedGame } from "./storage/savedGameRepo";

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
            { icon: "🎲", color: "#3d9142", title: "Classique" },
            { icon: "⬆️", color: "#c97e1c", title: "Montante" },
          ],
        },
      },
    ]);
  });

  it("rien à reprendre sans partie", () => {
    expect(YAMS.resume()).toBeNull();
  });
});
