import { describe, expect, it } from "vitest";
import { podiumOrder, sharedRanks } from "./ranking";

describe("sharedRanks", () => {
  it("numérote simplement quand personne n'est à égalité", () => {
    expect(sharedRanks([300, 250, 200])).toEqual([1, 2, 3]);
  });

  it("donne le même rang aux ex æquo et saute le suivant", () => {
    expect(sharedRanks([300, 300, 200])).toEqual([1, 1, 3]);
    expect(sharedRanks([300, 250, 250, 100])).toEqual([1, 2, 2, 4]);
    expect(sharedRanks([5000, 5000, 5000])).toEqual([1, 1, 1]);
  });

  it("accepte une liste vide", () => {
    expect(sharedRanks([])).toEqual([]);
  });
});

describe("podiumOrder", () => {
  it("pose le 2e à gauche, le 1er au centre, le 3e à droite", () => {
    expect(podiumOrder(["A", "B", "C", "D"])).toEqual(["B", "A", "C"]);
  });

  it("n'invente pas de marche quand il manque des joueurs", () => {
    expect(podiumOrder(["A", "B"])).toEqual(["B", "A"]);
    expect(podiumOrder(["A"])).toEqual(["A"]);
  });
});
