import { describe, expect, it } from "vitest";
import { canCloseHand, endsOnFullHand, slipOf } from "./tape";

describe("addition posée (slipOf)", () => {
  it("rien de tapé : rien au pot", () => {
    expect(slipOf([])).toEqual({ hands: [], current: [], pot: 0 });
  });

  it("une main en cours : ses montants, et leur total", () => {
    expect(slipOf([500, 100, 50])).toEqual({ hands: [], current: [500, 100, 50], pot: 650 });
  });

  it("chaque main pleine monte au-dessus du trait avec son total", () => {
    expect(slipOf([500, 100, "hand", 1000, "hand", 50])).toEqual({
      hands: [600, 1000],
      current: [50],
      pot: 1650,
    });
  });

  it("juste après une main pleine, la main en cours est vide", () => {
    expect(slipOf([500, "hand"])).toEqual({ hands: [500], current: [], pot: 500 });
  });
});

describe("main pleine", () => {
  it("se déclare sur une main commencée seulement", () => {
    expect(canCloseHand([])).toBe(false);
    expect(canCloseHand([500])).toBe(true);
    expect(canCloseHand([500, "hand"])).toBe(false);
  });

  it("une addition qui finit par une main pleine attend une relance", () => {
    expect(endsOnFullHand([500, "hand"])).toBe(true);
    expect(endsOnFullHand([500, "hand", 100])).toBe(false);
    expect(endsOnFullHand([])).toBe(false);
  });
});
