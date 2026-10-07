import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDate } from "./dates";

const TODAY = new Date(2026, 6, 19); // 19 juillet 2026

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

// `jj/mm/aaaa` est le format réellement écrit par l'app (toLocaleDateString fr-FR).
describe("formatDate", () => {
  it("affiche le jour même en clair", () => {
    expect(formatDate("19/07/2026")).toBe("aujourd'hui");
  });

  it("affiche la veille en clair", () => {
    expect(formatDate("18/07/2026")).toBe("hier");
  });

  it("compte les jours jusqu'à un mois", () => {
    expect(formatDate("17/07/2026")).toBe("il y a 2 jours");
    expect(formatDate("19/06/2026")).toBe("il y a 30 jours");
  });

  it("bascule en date absolue au-delà de 30 jours", () => {
    expect(formatDate("18/06/2026")).toMatch(/2026/);
    expect(formatDate("18/06/2026")).not.toMatch(/il y a/);
  });

  it("tolère le format ISO", () => {
    expect(formatDate("2026-07-18")).toBe("hier");
  });

  it("accepte un jour et un mois sans zéro initial", () => {
    expect(formatDate("1/7/2026")).toBe("il y a 18 jours");
    expect(formatDate("1/6/2026")).toMatch(/juin/);
  });

  it("rend la chaîne telle quelle si elle n'est pas une date", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("bientôt")).toBe("bientôt");
  });

  it("ne bascule pas en « il y a » pour une date future", () => {
    expect(formatDate("20/07/2026")).toBe("aujourd'hui");
  });
});
