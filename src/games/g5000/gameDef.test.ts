// Ce que le 5000 déclare au reste de l'application : en données, testable sans
// navigateur (comme celui du Yams).

import { beforeEach, describe, expect, it } from "vitest";
import { G5000 } from "./gameDef";
import { createGame, sheetFrom } from "./engine";
import { DEFAULT_RULES } from "./rules";
import { getRecords, getSavedGame, saveRecords, saveRules, saveSavedGame } from "./repo";
import type { G5000Rules } from "./types";

beforeEach(() => localStorage.clear());

// Une partie à trois, chacun avec ses cumuls.
function savedGame(sheets: number[][], rules: Partial<G5000Rules> = {}): void {
  const names = ["Alice", "Bob", "Chloé"].slice(0, sheets.length);
  const game = createGame(names, ["#FCC1C7", "#A5E4BB", "#DAC8FC"].slice(0, sheets.length), {
    ...DEFAULT_RULES,
    ...rules,
  });
  sheets.forEach((s, i) => (game.players[i].sheet = sheetFrom(s)));
  saveSavedGame(game);
}

describe("partie en cours (resume)", () => {
  it("rien à reprendre sans partie", () => {
    expect(G5000.resume()).toBeNull();
  });

  it("dit qui mène, et la jauge va jusqu'à l'objectif", () => {
    savedGame([[1000, 2000], [3100], [500]], { variants: ["sniper"] });
    const resume = G5000.resume()!;
    expect(resume.playerNames).toEqual(["Alice", "Bob", "Chloé"]);
    expect(resume.playerColors).toEqual(["#FCC1C7", "#A5E4BB", "#DAC8FC"]);
    expect(resume.progress).toEqual({ label: "Bob mène · 3 100", ratio: 0.62 });
    expect(resume.rows).toEqual([
      { term: "Joueurs", value: "Alice, Bob, Chloé" },
      { term: "Objectif", value: "5 000 points" },
      { term: "Variantes", value: { badges: [expect.objectContaining({ title: "Sniper" })] } },
      { term: "Meilleur score", value: "3 100" },
    ]);
  });

  it("sans variante, pas de ligne « Variantes »", () => {
    savedGame([[600], [600]]);
    expect(G5000.resume()!.rows.map((r) => r.term)).toEqual(["Joueurs", "Objectif", "Meilleur score"]);
  });

  it("égalité en tête, ou personne encore entré en jeu", () => {
    savedGame([[1000], [1000]]);
    expect(G5000.resume()!.progress?.label).toBe("Égalité en tête · 1 000");
    savedGame([[], []]);
    expect(G5000.resume()!.progress).toEqual({ label: "Personne n'est encore entré en jeu", ratio: 0 });
  });
});

describe("règles affichées (rulesDoc)", () => {
  const variantsSection = (inGame: boolean) =>
    G5000.rulesDoc({ inGame }).find((section) => section.kind === "variants");

  it("depuis une partie : ses seules variantes", () => {
    savedGame([[], []], { variants: ["combo"] });
    const section = variantsSection(true);
    expect(section?.title).toBe("Les variantes de la partie");
    expect(section?.items?.map((i) => i.title)).toEqual(["Combo"]);
  });

  it("depuis l'accueil : toutes les variantes, réglages actuels", () => {
    savedGame([[], []], { variants: ["combo"] });
    saveRules({ ...DEFAULT_RULES, openAt: 750 });
    const doc = G5000.rulesDoc({ inGame: false });
    expect(doc.find((s) => s.kind === "variants")?.items).toHaveLength(5);
    expect(JSON.stringify(doc)).toContain("750");
  });
});

describe("administration des joueurs", () => {
  beforeEach(() => {
    saveRecords({
      targets: { "5000": { biggestBank: { name: "Alice", value: 2350, date: "2026-10-03" } } },
      wins: { Alice: 2, Bob: 1 },
    });
  });

  it("tous les noms gardés : partie en cours et records", () => {
    savedGame([[500], [800]]);
    expect(G5000.playerNames()).toEqual(expect.arrayContaining(["Alice", "Bob"]));
  });

  it("renommer fait suivre la partie en cours et les records", () => {
    savedGame([[500], [800]]);
    G5000.renamePlayer("alice", "Alicia");
    expect(getSavedGame()!.players[0].name).toBe("Alicia");
    expect(getRecords().targets["5000"].biggestBank?.name).toBe("Alicia");
    expect(getRecords().wins).toEqual({ Alicia: 2, Bob: 1 });
  });

  it("supprimer retire ses records et abandonne la partie qui le compte", () => {
    savedGame([[500], [800]]);
    G5000.removePlayer("Alice");
    expect(getSavedGame()).toBeNull();
    expect(getRecords().targets["5000"]?.biggestBank).toBeUndefined();
    expect(getRecords().wins).toEqual({ Bob: 1 });
  });

  it("le récapitulatif de suppression dit ce qui partira", () => {
    savedGame([[500], [800]]);
    expect(G5000.describePlayer("alice")).toEqual([
      { term: "Palmarès du 5000", value: "1 record" },
      { term: "Victoires au 5000", value: "2" },
      { term: "Partie de 5000 en cours", value: "sera abandonnée" },
    ]);
  });
});
