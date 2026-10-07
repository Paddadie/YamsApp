import { beforeEach, describe, expect, it } from "vitest";
import {
  dedupePlayerGames,
  gamesPlayed,
  getPlayerGames,
  recordGamesPlayed,
  removePlayerGames,
  renamePlayerGames,
} from "./playerGamesRepo";
import { STORAGE_KEYS } from "./keys";

beforeEach(() => localStorage.clear());

const write = (games: Record<string, unknown>): void =>
  localStorage.setItem(STORAGE_KEYS.playerGames, JSON.stringify(games));

describe("getPlayerGames", () => {
  it("relit ce qui a été écrit", () => {
    write({ Jean: 3, Marie: 1 });
    expect(getPlayerGames()).toEqual({ Jean: 3, Marie: 1 });
  });

  it("renvoie un lot vide sur un appareil neuf", () => {
    expect(getPlayerGames()).toEqual({});
  });

  it("écarte un contenu qui n'a pas la forme attendue", () => {
    write({ Jean: "trois" });
    expect(getPlayerGames()).toEqual({});
    localStorage.setItem(STORAGE_KEYS.playerGames, JSON.stringify([1, 2]));
    expect(getPlayerGames()).toEqual({});
  });
});

describe("gamesPlayed", () => {
  it("retrouve un joueur quelle que soit la casse ou les espaces", () => {
    const games = { Jean: 4 };
    expect(gamesPlayed(games, "Jean")).toBe(4);
    expect(gamesPlayed(games, "jean")).toBe(4);
    expect(gamesPlayed(games, " JEAN ")).toBe(4);
  });

  it("renvoie 0 pour un joueur qui n'a jamais joué", () => {
    expect(gamesPlayed({ Jean: 4 }, "Marie")).toBe(0);
  });
});

describe("recordGamesPlayed", () => {
  it("compte une partie pour chaque joueur", () => {
    recordGamesPlayed(["Jean", "Marie"]);
    recordGamesPlayed(["Jean"]);
    expect(getPlayerGames()).toEqual({ Jean: 2, Marie: 1 });
  });

  // Même règle que knownPlayersRepo et playerStatsRepo : sans ça, « Jean » et
  // « jean » deviennent deux joueurs dans la liste de sélection.
  it("n'ouvre pas une seconde entrée quand la casse diffère", () => {
    write({ Jean: 3 });
    recordGamesPlayed(["jean"]);
    expect(getPlayerGames()).toEqual({ Jean: 4 });
  });
});

describe("removePlayerGames", () => {
  it("retire le joueur", () => {
    write({ Jean: 3, Marie: 1 });
    removePlayerGames("Jean");
    expect(getPlayerGames()).toEqual({ Marie: 1 });
  });

  it("retire aussi les entrées dépareillées héritées d'anciennes versions", () => {
    write({ Jean: 3, "jean ": 2, Marie: 1 });
    removePlayerGames("JEAN");
    expect(getPlayerGames()).toEqual({ Marie: 1 });
  });

  it("ne touche à rien quand le nom est inconnu", () => {
    write({ Jean: 3 });
    removePlayerGames("Marie");
    expect(getPlayerGames()).toEqual({ Jean: 3 });
  });
});

describe("renamePlayerGames", () => {
  it("déplace le compteur sous le nouveau nom", () => {
    write({ Jean: 3 });
    renamePlayerGames("Jean", "Jeanne");
    expect(getPlayerGames()).toEqual({ Jeanne: 3 });
  });

  it("fusionne quand le nom cible existe déjà", () => {
    write({ Jean: 3, Jeanne: 2 });
    renamePlayerGames("Jean", "Jeanne");
    expect(getPlayerGames()).toEqual({ Jeanne: 5 });
  });

  // La source est retirée AVANT qu'on cherche la cible : sinon une simple
  // correction de casse se fusionnerait avec elle-même et doublerait le compte.
  it("corrige la casse sans doubler le compteur", () => {
    write({ jean: 3 });
    renamePlayerGames("jean", "Jean");
    expect(getPlayerGames()).toEqual({ Jean: 3 });
  });

  it("ne laisse pas d'entrée orpheline quand la casse diffère", () => {
    write({ Jean: 3, "jean ": 2 });
    renamePlayerGames("Jean", "Jeanne");
    expect(getPlayerGames()).toEqual({ Jeanne: 5 });
  });

  it("ne fait rien si le joueur n'a pas de compteur", () => {
    write({ Marie: 1 });
    renamePlayerGames("Jean", "Jeanne");
    expect(getPlayerGames()).toEqual({ Marie: 1 });
  });

  it("ignore un renommage vers le même nom", () => {
    write({ Jean: 3 });
    renamePlayerGames("Jean", "Jean");
    expect(getPlayerGames()).toEqual({ Jean: 3 });
  });
});

describe("dedupePlayerGames", () => {
  it("additionne les entrées qui ne diffèrent que par la casse ou les espaces", () => {
    expect(dedupePlayerGames({ Jean: 3, "jean ": 2, Marie: 1 })).toEqual({
      Jean: 5,
      Marie: 1,
    });
  });

  it("garde la première forme rencontrée", () => {
    expect(dedupePlayerGames({ jean: 1, Jean: 2 })).toEqual({ jean: 3 });
  });
});
