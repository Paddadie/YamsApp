// Chaque écran se charge sans erreur, avec et sans données, et ses gardes
// redirigent là où il faut. C'est le filet contre la page blanche : une
// constante lue en zone morte ou un `id` manquant cassent tout l'écran.

import { describe, expect, it } from "vitest";
import { navigations, openPage, type PageName } from "./harness";
import { draft, filledYamsGame, g5000Game, knownPlayers, yamsGame } from "./fixtures";

describe("chargement sans données", () => {
  const pages: [PageName, string][] = [
    ["home", ""],
    ["settings", ""],
    ["settings", "?game=yams"],
    ["settings", "?game=g5000"],
    ["rules", "?game=yams"],
    ["rules", "?game=g5000"],
    ["yamsHome", ""],
    ["yamsHall", ""],
    ["g5000Home", ""],
    ["g5000Records", ""],
  ];
  it.each(pages)("%s%s", async (page, search) => {
    const { error } = await openPage(page, search);
    expect(error).toBeUndefined();
    expect(navigations()).toEqual([]);
  });
});

describe("gardes", () => {
  it("joueurs sans brouillon → menu", async () => {
    await openPage("players");
    expect(navigations()).toEqual(["home"]);
  });

  it("règles sans jeu → menu", async () => {
    await openPage("rules");
    expect(navigations()).toEqual(["home"]);
  });

  it("partie de Yams absente → accueil du Yams", async () => {
    await openPage("yamsGame");
    expect(navigations()).toEqual(["yamsHome"]);
  });

  it("fin de Yams sans partie → accueil du Yams", async () => {
    await openPage("yamsEnd");
    expect(navigations()).toEqual(["yamsHome"]);
  });

  it("partie de Yams terminée → écran de fin", async () => {
    filledYamsGame();
    await openPage("yamsGame");
    expect(navigations()).toEqual(["yamsEnd"]);
  });

  it("partie de 5000 absente → accueil du 5000", async () => {
    await openPage("g5000Game");
    expect(navigations()).toEqual(["g5000Home"]);
  });

  it("fin de 5000 alors que la partie continue → écran de jeu", async () => {
    g5000Game();
    await openPage("g5000End");
    expect(navigations()).toEqual(["g5000Game"]);
  });

  it("partie de 5000 finie → écran de fin", async () => {
    g5000Game(undefined, {}, (g) => {
      g.ended = true;
    });
    await openPage("g5000Game");
    expect(navigations()).toEqual(["g5000End"]);
  });
});

describe("chargement avec données", () => {
  it("menu avec deux parties en cours", async () => {
    yamsGame();
    g5000Game();
    const { error } = await openPage("home");
    expect(error).toBeUndefined();
    expect(document.querySelectorAll(".game-resume")).toHaveLength(2);
  });

  it("sélection des joueurs", async () => {
    knownPlayers("Alice", "Bob", "Chloé");
    draft("yams", ["Alice"], { variants: ["Classique"] });
    const { error } = await openPage("players");
    expect(error).toBeUndefined();
    expect(document.querySelectorAll(".roster-row")).toHaveLength(3);
  });

  it("partie de Yams en cours", async () => {
    yamsGame(["Alice", "Bob"], ["Classique", "Montante"]);
    const { error } = await openPage("yamsGame");
    expect(error).toBeUndefined();
    expect(document.querySelectorAll(".score-cell").length).toBeGreaterThan(0);
  });

  it("partie de 5000 en cours", async () => {
    g5000Game(["Alice", "Bob", "Chloé"]);
    const { error } = await openPage("g5000Game");
    expect(error).toBeUndefined();
  });

  it("Paramètres avec joueurs et partie en cours", async () => {
    knownPlayers("Alice", "Bob");
    yamsGame();
    const { error } = await openPage("settings", "?game=yams");
    expect(error).toBeUndefined();
  });
});

describe("poignée des joueurs sélectionnés", () => {
  it("est dessinée, pas écrite avec un caractère de police", async () => {
    knownPlayers("Alice", "Bob");
    draft("yams", ["Alice", "Bob"], { variants: ["Classique"] });
    await openPage("players");
    const handle = document.querySelector(".drag-handle");
    expect(handle?.querySelector("svg")).not.toBeNull();
    expect(handle?.textContent).toBe("");
  });
});

describe("récapitulatif d'une partie en cours", () => {
  it("lancer une partie montre ce qui sera perdu, variantes en pastilles", async () => {
    yamsGame(["Alice", "Bob"], ["Classique", "Montante"]);
    knownPlayers("Alice", "Bob");
    draft("yams", ["Alice", "Bob"], { variants: ["Classique"] });
    await openPage("players");
    (document.getElementById("start-game-btn") as HTMLButtonElement).click();
    const summary = document.getElementById("new-game-summary")!;
    expect(summary.querySelectorAll(".badge-row .badge")).toHaveLength(2);
    expect(summary.textContent).toContain("Alice, Bob");
  });
});
