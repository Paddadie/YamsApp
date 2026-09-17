import { beforeEach, describe, expect, it } from "vitest";
import { migrateStorage } from "./migrate";
import { STORAGE_KEYS } from "./keys";
import { DEFAULT_RULES } from "../scoring";
import { getPlayerStats } from "./playerStatsRepo";
import { getKnownNames } from "./knownPlayersRepo";
import { getSavedGame } from "./savedGameRepo";
import type { ScoreEntry } from "../types";

beforeEach(() => localStorage.clear());

const put = (key: string, value: unknown): void =>
  localStorage.setItem(key, JSON.stringify(value));
const read = <T>(key: string): T =>
  JSON.parse(localStorage.getItem(key) ?? "null") as T;

// Partie minimale acceptée par isSavedGame().
const aGame = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  players: [{ name: "Jean", color: "#FCC1C7", scores: { Classique: {} } }],
  selectedVariants: ["Classique"],
  currentPlayerIndex: 0,
  ...over,
});

describe("marqueur de version", () => {
  it("pose la version courante après un passage", () => {
    migrateStorage();
    expect(localStorage.getItem(STORAGE_KEYS.schemaVersion)).toBe("5");
  });

  it("ne retouche plus rien une fois la version atteinte", () => {
    localStorage.setItem(STORAGE_KEYS.schemaVersion, "5");
    put(STORAGE_KEYS.knownNames, ["Jean", "jean"]);
    migrateStorage();
    expect(read<string[]>(STORAGE_KEYS.knownNames)).toEqual(["Jean", "jean"]);
  });

  it("repasse quand le marqueur est absent (import de sauvegarde)", () => {
    put(STORAGE_KEYS.knownNames, ["Jean", "jean"]);
    migrateStorage();
    expect(read<string[]>(STORAGE_KEYS.knownNames)).toEqual(["Jean"]);
  });

  it("repasse quand le marqueur est illisible", () => {
    localStorage.setItem(STORAGE_KEYS.schemaVersion, "n'importe quoi");
    put(STORAGE_KEYS.knownNames, ["Jean", "jean"]);
    migrateStorage();
    expect(read<string[]>(STORAGE_KEYS.knownNames)).toEqual(["Jean"]);
  });
});

describe("rien à migrer", () => {
  it("ne crée aucune clé sur un appareil vierge", () => {
    migrateStorage();
    const created = Object.values(STORAGE_KEYS).filter(
      (k) => localStorage.getItem(k) !== null,
    );
    expect(created).toEqual([STORAGE_KEYS.schemaVersion]);
  });
});

describe("règles", () => {
  it("complète un ancien format où les combinaisons étaient des nombres", () => {
    put(STORAGE_KEYS.rules, { full: 25, yams: 50 });
    migrateStorage();
    expect(read(STORAGE_KEYS.rules)).toEqual({
      ...DEFAULT_RULES,
      full: { type: "fixed", points: 25 },
      yams: { type: "fixed", points: 50 },
    });
  });

  it("efface des règles illisibles plutôt que de les laisser faire planter une page", () => {
    localStorage.setItem(STORAGE_KEYS.rules, "{ pas du json");
    migrateStorage();
    expect(localStorage.getItem(STORAGE_KEYS.rules)).toBeNull();
  });

  it("n'invente pas de règles quand il n'y en avait pas", () => {
    migrateStorage();
    expect(localStorage.getItem(STORAGE_KEYS.rules)).toBeNull();
  });
});

describe("statistiques des joueurs", () => {
  it("convertit l'ancien format « nom → nombre de parties »", () => {
    put(STORAGE_KEYS.playerStats, { Jean: 3 });
    migrateStorage();
    expect(getPlayerStats().Jean).toEqual({
      games: 3,
      classiqueGames: 0,
      classiquePoints: 0,
      classiqueBest: 0,
    });
  });

  it("fusionne les clés qui ne diffèrent que par la casse", () => {
    put(STORAGE_KEYS.playerStats, {
      Jean: { games: 3, classiqueGames: 2, classiquePoints: 400, classiqueBest: 210 },
      jean: { games: 2, classiqueGames: 1, classiquePoints: 150, classiqueBest: 240 },
    });
    migrateStorage();
    expect(getPlayerStats()).toEqual({
      Jean: {
        games: 5,
        classiqueGames: 3,
        classiquePoints: 550,
        classiqueBest: 240,
      },
    });
  });
});

describe("partie en cours", () => {
  it("ajoute les règles à une partie enregistrée avant les paramètres", () => {
    put(STORAGE_KEYS.savedGame, aGame());
    migrateStorage();
    expect(read<{ rules: unknown }>(STORAGE_KEYS.savedGame).rules).toEqual(DEFAULT_RULES);
  });

  it("conserve les joueurs et leurs scores", () => {
    const scores = { Classique: { "1": 3, "Score Final": 120 } };
    put(STORAGE_KEYS.savedGame, aGame({
      players: [{ name: "Jean", color: "#FCC1C7", scores }],
    }));
    migrateStorage();
    expect(getSavedGame()?.players[0].scores).toEqual(scores);
  });

  it("laisse en place une partie de forme inattendue au lieu de la perdre", () => {
    put(STORAGE_KEYS.savedGame, { players: [] });
    migrateStorage();
    expect(read(STORAGE_KEYS.savedGame)).toEqual({ players: [] });
  });
});

describe("classements du Hall of Fame", () => {
  it("complète les champs manquants d'une ancienne entrée", () => {
    put(STORAGE_KEYS.bestScores, [{ name: "Jean", score: 250 }]);
    migrateStorage();
    expect(read<ScoreEntry[]>(STORAGE_KEYS.bestScores)).toEqual([
      { name: "Jean", score: 250, date: "" },
    ]);
  });

  it("récupère un score enregistré en texte", () => {
    put(STORAGE_KEYS.bestScores, [{ name: "Jean", score: "250", date: "01/02/2026" }]);
    migrateStorage();
    expect(read<ScoreEntry[]>(STORAGE_KEYS.bestScores)[0].score).toBe(250);
  });

  it("jette une entrée cassée sans faire tomber toute la liste", () => {
    put(STORAGE_KEYS.bestScores, [
      { name: "Jean", score: 250, date: "01/02/2026" },
      { score: 120, date: "01/02/2026" },
      null,
      { name: "Marie", score: "illisible" },
      { name: "Alice", score: 180, date: "02/02/2026" },
    ]);
    migrateStorage();
    expect(read<ScoreEntry[]>(STORAGE_KEYS.bestScores).map((e) => e.name)).toEqual([
      "Jean",
      "Alice",
    ]);
  });

  it("conserve la feuille de score détaillée", () => {
    const entry = {
      name: "Jean",
      score: 250,
      date: "01/02/2026",
      variant: "Classique",
      sheet: { "1": 3, "Score Final": 250 },
      lineOrder: ["1", "Score Final"],
    };
    put(STORAGE_KEYS.bestScores, [entry]);
    migrateStorage();
    expect(read<ScoreEntry[]>(STORAGE_KEYS.bestScores)[0]).toEqual(entry);
  });

  it("garde toutes les variantes dans les meilleurs scores", () => {
    put(STORAGE_KEYS.bestScores, [
      { name: "Jean", score: 250, date: "", variant: "Montante" },
      { name: "Marie", score: 240, date: "", variant: "Classique" },
    ]);
    migrateStorage();
    expect(read<ScoreEntry[]>(STORAGE_KEYS.bestScores)).toHaveLength(2);
  });

  it("ne garde que le Classique dans les pires scores", () => {
    put(STORAGE_KEYS.worstScores, [
      { name: "Jean", score: 40, date: "", variant: "Montante" },
      { name: "Marie", score: 55, date: "", variant: "Classique" },
    ]);
    migrateStorage();
    expect(read<ScoreEntry[]>(STORAGE_KEYS.worstScores).map((e) => e.name)).toEqual([
      "Marie",
    ]);
  });

  it("conserve dans les pires scores les entrées d'avant les variantes", () => {
    put(STORAGE_KEYS.worstScores, [{ name: "Jean", score: 40, date: "" }]);
    migrateStorage();
    expect(read<ScoreEntry[]>(STORAGE_KEYS.worstScores)).toHaveLength(1);
  });

  it("efface un classement illisible", () => {
    localStorage.setItem(STORAGE_KEYS.bestScores, "[[[");
    migrateStorage();
    expect(localStorage.getItem(STORAGE_KEYS.bestScores)).toBeNull();
  });
});

describe("noms de joueurs connus", () => {
  it("dédoublonne la casse et les espaces, puis trie", () => {
    put(STORAGE_KEYS.knownNames, ["marie", "Jean", "jean ", " Marie", "Alice"]);
    migrateStorage();
    expect(read<string[]>(STORAGE_KEYS.knownNames)).toEqual(["Alice", "Jean", "marie"]);
  });

  it("écarte les entrées vides ou qui ne sont pas des noms", () => {
    put(STORAGE_KEYS.knownNames, ["Jean", "", "   ", 42, null]);
    migrateStorage();
    expect(getKnownNames()).toEqual(["Jean"]);
  });
});
