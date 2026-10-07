import { beforeEach, describe, expect, it } from "vitest";
import { migrateStorage } from "./migrate";
import { STORAGE_KEYS } from "./keys";
import { DEFAULT_RULES } from "../../games/yams/scoring";
import { getPlayerStats } from "../../games/yams/storage/playerStatsRepo";
import { getPlayerGames } from "./playerGamesRepo";
import { getKnownNames } from "./knownPlayersRepo";
import { getSavedGame } from "../../games/yams/storage/savedGameRepo";
import type { ScoreEntry } from "../../games/yams/types";
import { getDraft } from "./draftRepo";
import { yamsConfigOf } from "../../games/yams/gameDef";

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
    expect(localStorage.getItem(STORAGE_KEYS.schemaVersion)).toBe("7");
  });

  it("ne retouche plus rien une fois la version atteinte", () => {
    localStorage.setItem(STORAGE_KEYS.schemaVersion, "7");
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
      classiqueGames: 0,
      classiquePoints: 0,
      classiqueBest: 0,
    });
    expect(getPlayerGames()).toEqual({ Jean: 3 });
  });

  it("fusionne les clés qui ne diffèrent que par la casse", () => {
    put(STORAGE_KEYS.playerStats, {
      Jean: { games: 3, classiqueGames: 2, classiquePoints: 400, classiqueBest: 210 },
      jean: { games: 2, classiqueGames: 1, classiquePoints: 150, classiqueBest: 240 },
    });
    migrateStorage();
    expect(getPlayerStats()).toEqual({
      Jean: {
        classiqueGames: 3,
        classiquePoints: 550,
        classiqueBest: 240,
      },
    });
    expect(getPlayerGames()).toEqual({ Jean: 5 });
  });
});

describe("partie en cours", () => {
  it("ajoute les règles à une partie enregistrée avant les paramètres", () => {
    put(STORAGE_KEYS.savedGame, aGame());
    migrateStorage();
    expect(read<{ rules: unknown }>(STORAGE_KEYS.savedGame).rules).toEqual(DEFAULT_RULES);
  });

  it("conserve les joueurs et leurs scores", () => {
    const scores = { Classique: { "1": 3, scoreFinal: 120 } };
    put(STORAGE_KEYS.savedGame, aGame({
      players: [{ name: "Jean", color: "#FCC1C7", scores }],
    }));
    migrateStorage();
    expect(getSavedGame()?.players[0].scores).toEqual(scores);
  });

  it("v7 — range les cases sous leur identifiant au lieu de leur libellé", () => {
    const scores = {
      Classique: { "1": 3, "Brelan (Σ)": 17, "Full (30)": 30, Bonus: 0, "Score Final": 50 },
      Montante: { "Pte Suite (30)": 0 },
    };
    put(STORAGE_KEYS.savedGame, aGame({
      players: [{ name: "Jean", color: "#FCC1C7", scores }],
      selectedVariants: ["Classique", "Montante"],
    }));
    migrateStorage();
    expect(getSavedGame()?.players[0].scores).toEqual({
      Classique: { "1": 3, brelan: 17, full: 30, bonus: 0, scoreFinal: 50 },
      Montante: { petiteSuite: 0 },
    });
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
      sheet: { "1": 3, scoreFinal: 250 },
      lineOrder: ["1", "scoreFinal"],
      rules: DEFAULT_RULES,
    };
    put(STORAGE_KEYS.bestScores, [entry]);
    migrateStorage();
    expect(read<ScoreEntry[]>(STORAGE_KEYS.bestScores)[0]).toEqual(entry);
  });

  it("v7 — convertit une ancienne feuille et retrouve son barème dans ses libellés", () => {
    put(STORAGE_KEYS.bestScores, [
      {
        name: "Jean",
        score: 250,
        date: "01/02/2026",
        variant: "Classique",
        sheet: { "1": 3, "Brelan (Σ)": 20, "Full (30)": 30, "Yams (100)": 100, Bonus: 50, "Score Final": 250 },
        lineOrder: ["1", "Bonus", "Brelan (Σ)", "Full (30)", "Yams (100)", "Score Final"],
      },
    ]);
    migrateStorage();
    const [entry] = read<ScoreEntry[]>(STORAGE_KEYS.bestScores);
    expect(entry.sheet).toEqual({ "1": 3, brelan: 20, full: 30, yams: 100, bonus: 50, scoreFinal: 250 });
    expect(entry.lineOrder).toEqual(["1", "bonus", "brelan", "full", "yams", "scoreFinal"]);
    expect(entry.rules).toMatchObject({
      bonus: 50,
      brelan: { type: "sum" },
      full: { type: "fixed", points: 30 },
      yams: { type: "fixed", points: 100 },
      chance: false, // pas de ligne Chance sur cette feuille
    });
  });

  it("v7 — repasser sur une feuille déjà convertie ne change rien", () => {
    const entry = {
      name: "Jean",
      score: 250,
      date: "",
      sheet: { "1": 3, brelan: 18, scoreFinal: 250 },
      lineOrder: ["1", "brelan", "scoreFinal"],
      rules: { ...DEFAULT_RULES, brelan: { type: "dice" } },
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

describe("v6 — le compteur de parties devient commun à tous les jeux", () => {
  it("extrait `games` des statistiques du Yams", () => {
    put(STORAGE_KEYS.playerStats, {
      Jean: { games: 7, classiqueGames: 4, classiquePoints: 800, classiqueBest: 240 },
      Marie: { games: 2, classiqueGames: 0, classiquePoints: 0, classiqueBest: 0 },
    });
    migrateStorage();
    expect(getPlayerGames()).toEqual({ Jean: 7, Marie: 2 });
  });

  it("reprend le tout premier format, où la valeur ÉTAIT le nombre de parties", () => {
    put(STORAGE_KEYS.playerStats, { Jean: 5 });
    migrateStorage();
    expect(getPlayerGames()).toEqual({ Jean: 5 });
  });

  it("fusionne les entrées qui ne diffèrent que par la casse", () => {
    put(STORAGE_KEYS.playerStats, {
      Jean: { games: 3 },
      "jean ": { games: 2 },
    });
    migrateStorage();
    expect(getPlayerGames()).toEqual({ Jean: 5 });
  });

  it("laisse les statistiques du Yams sans leur ancien compteur", () => {
    put(STORAGE_KEYS.playerStats, {
      Jean: { games: 7, classiqueGames: 4, classiquePoints: 800, classiqueBest: 240 },
    });
    migrateStorage();
    expect(getPlayerStats().Jean).toEqual({
      classiqueGames: 4,
      classiquePoints: 800,
      classiqueBest: 240,
    });
  });

  // Une réinstallation ou l'import d'une vieille sauvegarde relance la
  // migration : elle ne doit pas écraser un compteur déjà alimenté par d'autres
  // jeux.
  it("n'écrase pas un compteur commun déjà en place", () => {
    put(STORAGE_KEYS.playerGames, { Jean: 12 });
    put(STORAGE_KEYS.playerStats, { Jean: { games: 3 } });
    migrateStorage();
    expect(getPlayerGames()).toEqual({ Jean: 12 });
  });

  it("ne crée rien quand l'appareil n'a jamais joué", () => {
    migrateStorage();
    expect(localStorage.getItem(STORAGE_KEYS.playerGames)).toBeNull();
  });
});

describe("v6 — brouillon d'avant-partie", () => {
  it("attribue au Yams un brouillon qui ne dit pas de quel jeu il est", () => {
    put(STORAGE_KEYS.draft, { variants: ["Classique"], playerNames: ["Jean"] });
    migrateStorage();
    expect(read<Record<string, unknown>>(STORAGE_KEYS.draft)).toMatchObject({
      gameId: "yams",
      playerNames: ["Jean"],
    });
  });

  it("range ses variantes là où le Yams les lit", () => {
    put(STORAGE_KEYS.draft, {
      variants: ["Classique", "Montante"],
      playerNames: ["Jean"],
    });
    migrateStorage();
    const draft = getDraft();
    expect(draft).not.toBeNull();
    expect(yamsConfigOf(draft!).variants).toEqual(["Classique", "Montante"]);
  });

  it("ne touche pas à un brouillon qui porte déjà son jeu", () => {
    const draft = { gameId: "g5000", playerNames: ["Marie"], config: {} };
    put(STORAGE_KEYS.draft, draft);
    migrateStorage();
    expect(read(STORAGE_KEYS.draft)).toEqual(draft);
  });
});
