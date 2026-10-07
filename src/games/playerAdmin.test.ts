import { beforeEach, describe, expect, it } from "vitest";
import { allPlayerNames, removePlayer, renamePlayer } from "./playerAdmin";
import { GAMES } from "./registry";
import { STORAGE_KEYS } from "../core/storage/keys";
import { getKnownNames } from "../core/storage/knownPlayersRepo";
import { getPlayerGames } from "../core/storage/playerGamesRepo";
import { getDraft } from "../core/storage/draftRepo";
import { getSavedGame as getYamsGame } from "./yams/storage/savedGameRepo";
import {
  getPlayerStats,
  recordGameResult,
} from "./yams/storage/playerStatsRepo";
import { getBestScores } from "./yams/storage/hallOfFameRepo";
import { getRecords, getSavedGame as get5000Game } from "./g5000/repo";
import { createGame } from "./g5000/engine";
import { DEFAULT_RULES } from "./g5000/rules";
import { recordsAt } from "./g5000/records";

const put = (key: string, value: unknown): void =>
  localStorage.setItem(key, JSON.stringify(value));

const entry = (name: string, score: number) => ({ name, score, date: "01/09/2026" });

// Jean est partout : connu, compté, dans le brouillon, dans une partie de Yams
// (déjà versée au Hall of Fame) et dans une partie de 5000, avec stats,
// classements et records. Marie ne joue qu'au Yams.
beforeEach(() => {
  localStorage.clear();
  put(STORAGE_KEYS.knownNames, ["Jean", "Marie"]);
  put(STORAGE_KEYS.playerGames, { Jean: 3, Marie: 1 });
  put(STORAGE_KEYS.draft, { gameId: "yams", playerNames: ["jean", "Marie"], config: {} });
  put(STORAGE_KEYS.savedGame, {
    players: [
      { name: "Jean", color: "#FCC1C7", scores: { Classique: {} } },
      { name: "Marie", color: "#A5E4BB", scores: { Classique: {} } },
    ],
    selectedVariants: ["Classique"],
    currentPlayerIndex: 0,
    rules: {},
    hofImpact: {
      best: ["Jean|Classique"],
      worst: [],
      newRecord: { name: "Jean", score: 300, variant: "Classique" },
    },
  });
  put(STORAGE_KEYS.playerStats, {
    Jean: { classiqueGames: 2, classiquePoints: 500, classiqueBest: 280 },
  });
  put(STORAGE_KEYS.bestScores, [entry("Jean", 280), entry("Marie", 250)]);
  put(STORAGE_KEYS.worstScores, [entry("jean", 120)]);
  put(STORAGE_KEYS.g5000SavedGame, createGame(["Jean", "Paul"], ["#1", "#2"], DEFAULT_RULES));
  put(STORAGE_KEYS.g5000Records, {
    biggestBank: { name: "Jean", value: 1800, date: "" },
    biggestFall: { name: "Paul", value: 900, date: "", by: "Jean" },
    wins: { Jean: 2, Paul: 1 },
  });
});

describe("renamePlayer", () => {
  it("fait suivre le nom partout, parties en cours comprises", () => {
    expect(renamePlayer("Jean", "Jeannot")).toBe(true);

    expect(getKnownNames()).toEqual(["Jeannot", "Marie"]);
    expect(getPlayerGames()).toEqual({ Jeannot: 3, Marie: 1 });
    expect(getDraft()?.playerNames).toEqual(["Jeannot", "Marie"]);

    const yams = getYamsGame();
    expect(yams?.players.map((p) => p.name)).toEqual(["Jeannot", "Marie"]);
    expect(yams?.hofImpact?.best).toEqual(["Jeannot|Classique"]);
    expect(yams?.hofImpact?.newRecord?.name).toBe("Jeannot");
    expect(Object.keys(getPlayerStats())).toEqual(["Jeannot"]);
    expect(getBestScores().map((e) => e.name)).toEqual(["Jeannot", "Marie"]);

    expect(get5000Game()?.players.map((p) => p.name)).toEqual(["Jeannot", "Paul"]);
    const records = getRecords();
    expect(recordsAt(records, 5000).biggestBank?.name).toBe("Jeannot");
    expect(recordsAt(records, 5000).biggestFall?.by).toBe("Jeannot");
    expect(records.wins).toEqual({ Jeannot: 2, Paul: 1 });
  });

  it("ne laisse pas de joueur fantôme quand la partie en cours se termine", () => {
    renamePlayer("Jean", "Jeannot");
    // Ce que fait l'écran de fin du Yams : il enregistre sous les noms de la partie.
    const names = getYamsGame()!.players.map((p) => p.name);
    recordGameResult(names.map((name) => ({ name, classiqueScore: 200 })));
    expect(Object.keys(getPlayerStats()).sort()).toEqual(["Jeannot", "Marie"]);
    expect(allPlayerNames()).not.toContain("Jean");
  });

  it("refuse un nom déjà porté par un autre joueur, sans rien toucher", () => {
    expect(renamePlayer("Jean", "marie")).toBe(false);
    expect(getKnownNames()).toEqual(["Jean", "Marie"]);
    expect(getYamsGame()?.players[0].name).toBe("Jean");
    expect(getRecords().wins).toEqual({ Jean: 2, Paul: 1 });
  });

  it("dédoublonne le brouillon si le nouveau nom y figurait déjà", () => {
    put(STORAGE_KEYS.draft, { gameId: "yams", playerNames: ["jean", "Jean"], config: {} });
    renamePlayer("Jean", "Jeannot");
    expect(getDraft()?.playerNames).toEqual(["Jeannot"]);
  });
});

describe("removePlayer", () => {
  it("efface le joueur partout et abandonne les parties qui le comptent", () => {
    removePlayer("Jean");

    expect(getKnownNames()).toEqual(["Marie"]);
    expect(getPlayerGames()).toEqual({ Marie: 1 });
    expect(getDraft()?.playerNames).toEqual(["Marie"]);
    expect(getPlayerStats()).toEqual({});
    expect(getBestScores().map((e) => e.name)).toEqual(["Marie"]);
    expect(getYamsGame()).toBeNull();
    expect(get5000Game()).toBeNull();

    const records = getRecords();
    expect(recordsAt(records, 5000).biggestBank).toBeUndefined();
    // Une chute qu'il a seulement provoquée reste à celui qui l'a subie.
    expect(recordsAt(records, 5000).biggestFall).toMatchObject({ name: "Paul", value: 900 });
    expect(recordsAt(records, 5000).biggestFall?.by).toBeUndefined();
    expect(records.wins).toEqual({ Paul: 1 });
  });

  it("garde les parties où le joueur ne figure pas", () => {
    removePlayer("Paul");
    expect(getYamsGame()).not.toBeNull();
    expect(get5000Game()).toBeNull();
  });
});

describe("allPlayerNames", () => {
  it("rassemble les noms de tous les jeux, une fois chacun", () => {
    // Paul n'est ni connu ni compté : il n'existe que dans le 5000.
    expect(allPlayerNames()).toEqual(["Jean", "Marie", "Paul"]);
  });
});

describe("describePlayer", () => {
  it("annonce ce que chaque jeu perdrait, partie en cours comprise", () => {
    const rows = GAMES.flatMap((game) => game.describePlayer("jean"));
    const text = rows.map(({ term, value }) => `${term}: ${String(value)}`);
    expect(text).toContain("Moyenne classique: 250");
    expect(text).toContain("Palmarès du Yams: 2 entrées");
    expect(text).toContain("Partie de Yams en cours: sera abandonnée");
    expect(text).toContain("Palmarès du 5000: 1 record");
    expect(text).toContain("Victoires au 5000: 2");
    expect(text).toContain("Partie de 5000 en cours: sera abandonnée");
  });
});
