// Parcours rejoués geste par geste, vérifiés sur ce qui est réellement écrit
// dans le stockage.

import { describe, expect, it, vi } from "vitest";
import { button, click, el, navigations, openPage } from "./harness";
import { filledYamsGame, g5000Game, savedG5000, savedYams, yamsGame } from "./fixtures";
import { getBestScores } from "../../games/yams/storage/hallOfFameRepo";
import { getPlayerGames } from "../../core/storage/playerGamesRepo";
import { liveScores } from "../../games/g5000/engine";

describe("Yams — saisie", () => {
  it("une valeur choisie est enregistrée, puis la main passe", async () => {
    vi.useFakeTimers();
    yamsGame(["Alice", "Bob"]);
    await openPage("yamsGame");

    click(document.querySelectorAll<HTMLButtonElement>(".score-cell")[0]);
    expect(el<HTMLDialogElement>("#value-picker").open).toBe(true);
    click(button("3", el("#picker-values")));

    expect(savedYams()?.players[0].scores.Classique?.["1"]).toBe(3);
    vi.advanceTimersByTime(1000);
    expect(el("#current-player-name").textContent).toBe("Bob");
    expect(savedYams()?.currentPlayerIndex).toBe(1);
  });
});

describe("Yams — fin de partie", () => {
  it("verse la partie au Hall of Fame une seule fois", async () => {
    filledYamsGame(["Alice", "Bob"]);
    await openPage("yamsEnd");
    expect(getBestScores()).toHaveLength(2);
    expect(savedYams()?.recorded).toBe(true);

    await openPage("yamsEnd"); // rafraîchissement
    expect(getBestScores()).toHaveLength(2);
    expect(getPlayerGames()).toEqual({ Alice: 1, Bob: 1 });
  });

  it("« Quitter » efface la partie et revient à l'accueil du Yams", async () => {
    filledYamsGame();
    await openPage("yamsEnd");
    click("#quit-btn");
    expect(savedYams()).toBeNull();
    expect(navigations()).toEqual(["yamsHome"]);
  });
});

describe("5000 — calculette", () => {
  function roll(...faces: number[]): void {
    for (const face of faces) click(el(`.face-btn[data-face="${face}"]`));
    click(button("Valider ces dés"));
  }

  it("un brelan de 1 banqué ouvre le jeu et passe la main", async () => {
    g5000Game(["Alice", "Bob"]);
    await openPage("g5000Game");
    click("#play-btn");
    roll(1, 1, 1, 2, 3);
    click(el('[data-combo="g1x3"]'));
    click(button("Banquer"));

    const game = savedG5000();
    expect(liveScores(game!.players[0])).toEqual([1000]);
    expect(game?.currentPlayerIndex).toBe(1);
  });

  it("un lancer sans dé marquant est un bust", async () => {
    g5000Game(["Alice", "Bob"]);
    await openPage("g5000Game");
    click("#play-btn");
    roll(2, 3, 4, 6, 6);
    click(button("Passer la main"));
    expect(liveScores(savedG5000()!.players[0])).toEqual([]);
    expect(savedG5000()?.currentPlayerIndex).toBe(1);
  });
});
