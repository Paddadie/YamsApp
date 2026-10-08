import { beforeEach, describe, expect, it } from "vitest";
import { getRules, getSavedGame, isG5000Game, renameInSavedGame, saveSavedGame } from "./repo";
import { createGame, enterTurn, finishTurn, undoLastTurn } from "./engine";
import { DEFAULT_RULES } from "./rules";
import { STORAGE_KEYS } from "../../core/storage/keys";
import type { G5000Game } from "./types";

beforeEach(() => localStorage.clear());

// Une partie enregistrée avant la feuille raturée : les joueurs n'avaient que
// leurs scores en vigueur, dans `history`.
function legacyGame(): unknown {
  const game = createGame(["Marlo", "Poulet"], ["#FCC1C7", "#A5E4BB"], DEFAULT_RULES);
  return {
    ...game,
    players: game.players.map(({ sheet: _sheet, ...p }, i) => ({
      ...p,
      history: i === 0 ? [700, 1400] : [],
    })),
  };
}

describe("partie enregistrée avant la feuille raturée", () => {
  it("est reconnue (partie en cours, sauvegarde importée)", () => {
    expect(isG5000Game(legacyGame())).toBe(true);
  });

  it("ses scores deviennent la feuille, sans rature", () => {
    localStorage.setItem(STORAGE_KEYS.g5000SavedGame, JSON.stringify(legacyGame()));
    const game = getSavedGame()!;
    expect(game.players[0].sheet).toEqual([{ score: 700 }, { score: 1400 }]);
    expect(game.players[1].sheet).toEqual([]);
    expect(game.players[0]).not.toHaveProperty("history");
  });
});

describe("feuille raturée", () => {
  it("refuse une rature de nature inconnue", () => {
    const game = createGame(["Marlo"], ["#FCC1C7"], DEFAULT_RULES);
    const bad = { ...game, players: [{ ...game.players[0], sheet: [{ score: 700, struck: { kind: "oups" } }] }] };
    expect(isG5000Game(bad)).toBe(false);
  });
});

// Les anciens interrupteurs (égalité, score exact…) ne deviennent des variantes
// que pour une partie en cours : les réglages enregistrés arrivent sur
// l'accueil sans variante cochée (choix de Paul, 07/10/2026).
const OLD_RULES = {
  target: 5000,
  openAt: 500,
  runPoints: 1000,
  openDigits: false,
  exactTarget: true,
  hotDiceMustReroll: true,
  lastRound: true,
  tieRule: true,
  blankTurnsPenalty: 3,
  overshootCountsAsBlank: true,
};

describe("règles d'avant les variantes", () => {
  it("une partie en cours garde l'égalité et le score exact de son lancement", () => {
    const game = createGame(["Marlo", "Poulet"], ["#FCC1C7", "#A5E4BB"], DEFAULT_RULES);
    localStorage.setItem(
      STORAGE_KEYS.g5000SavedGame,
      JSON.stringify({ ...game, rules: OLD_RULES }),
    );
    expect(getSavedGame()!.rules.variants).toEqual(["sniper", "exact"]);
  });

  it("les réglages enregistrés n'en tirent aucune variante, et gardent le reste", () => {
    localStorage.setItem(STORAGE_KEYS.g5000Rules, JSON.stringify({ ...OLD_RULES, openAt: 1000 }));
    const rules = getRules();
    expect(rules.variants).toEqual([]);
    expect(rules.openAt).toBe(1000);
  });

  it("des réglages déjà au nouveau format gardent leurs variantes", () => {
    localStorage.setItem(
      STORAGE_KEYS.g5000Rules,
      JSON.stringify({ ...DEFAULT_RULES, variants: ["combo"] }),
    );
    expect(getRules().variants).toEqual(["combo"]);
  });
});

describe("la partie d'avant le dernier tour (« Corriger »)", () => {
  function playedGame() {
    const game = createGame(["Marlo", "Poulet"], ["#FCC1C7", "#A5E4BB"], DEFAULT_RULES);
    enterTurn(game, 600);
    finishTurn(game, "bank");
    saveSavedGame(game);
    return game;
  }

  it("suit un renommage : reprendre le tour ne ramène pas l'ancien nom", () => {
    playedGame();
    renameInSavedGame("marlo", "Marlène");
    const game = getSavedGame()!;
    undoLastTurn(game);
    expect(game.players.map((p) => p.name)).toEqual(["Marlène", "Poulet"]);
  });

  it("abîmée, elle est écartée sans perdre la partie", () => {
    const game = playedGame();
    saveSavedGame({ ...game, previous: { players: "?" } as unknown as G5000Game });
    const read = getSavedGame()!;
    expect(read.players[0].sheet).toEqual([{ score: 600 }]);
    expect(read.previous).toBeUndefined();
    expect(read.lastTurn).toBeUndefined();
  });
});
