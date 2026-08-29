import { describe, expect, it } from "vitest";
import { compareNames, foldName, sameName } from "./playerName";

describe("foldName", () => {
  it("ignore la casse et les espaces de bord", () => {
    expect(foldName("  Jean ")).toBe("jean");
    expect(foldName("JEAN")).toBe("jean");
  });
});

describe("sameName", () => {
  it("reconnaît le même joueur malgré casse et espaces", () => {
    expect(sameName("Jean", "  jean")).toBe(true);
    expect(sameName("JEAN", "Jean")).toBe(true);
  });

  it("distingue deux joueurs différents", () => {
    expect(sameName("Jean", "Jeanne")).toBe(false);
  });

  it("ne confond pas des accents différents", () => {
    // Deux personnes distinctes peuvent s'appeler « Rene » et « René ».
    expect(sameName("Rene", "René")).toBe(false);
  });
});

describe("compareNames", () => {
  it("trie alphabétiquement sans tenir compte de la casse", () => {
    expect(["bob", "Anne", "Zoé"].sort(compareNames)).toEqual([
      "Anne",
      "bob",
      "Zoé",
    ]);
  });

  it("place les accents à côté de leur lettre de base", () => {
    expect(["Zoé", "Émile", "Alice"].sort(compareNames)).toEqual([
      "Alice",
      "Émile",
      "Zoé",
    ]);
  });
});
