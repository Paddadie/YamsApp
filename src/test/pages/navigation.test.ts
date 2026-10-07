// Liens de retour : on revient d'où l'on vient.

import { describe, expect, it } from "vitest";
import { click, el, openPage } from "./harness";

const backHref = (): string | null => el("#back-btn").getAttribute("href");

describe("règles", () => {
  it("depuis l'accueil d'un jeu, Retour y ramène", async () => {
    await openPage("rules", "?game=yams");
    expect(backHref()).toBe("yams.html");
  });

  it.each([
    ["yams", "yams-game.html"],
    ["g5000", "5000-game.html"],
  ])("ouvertes en pleine partie (%s), Retour ramène à la partie", async (game, page) => {
    await openPage("rules", `?game=${game}&from=play`);
    expect(backHref()).toBe(page);
  });

  it.each([
    ["yamsGame", "yams"],
    ["g5000Game", "g5000"],
  ] as const)("l'écran de jeu %s ouvre les règles en le disant", async (page, game) => {
    await openPage(page);
    const link = document.querySelector(`a[href^="rules.html"]`);
    expect(link?.getAttribute("href")).toBe(`rules.html?game=${game}&from=play`);
  });
});

describe("records du 5000", () => {
  it("depuis l'accueil, Retour y ramène", async () => {
    await openPage("g5000Records");
    expect(backHref()).toBe("5000.html");
  });

  it("depuis l'écran de fin, Retour y ramène", async () => {
    await openPage("g5000Records", "?from=end");
    expect(backHref()).toBe("5000-end.html");
  });
});

describe("« Quitter » de fin de partie", () => {
  // Rien n'est perdu (la partie est déjà enregistrée) : bleu, pas rouge.
  it.each(["yams-end.html", "5000-end.html"])("est bleu dans %s", async (file) => {
    const { readFileSync } = await import("node:fs");
    const html = readFileSync(file, "utf-8");
    expect(html).toMatch(/id="quit-btn"[^>]*class="btn btn-secondary"/);
  });
});

describe("sélecteur de jeu", () => {
  it.each(["yamsHome", "g5000Home"] as const)("%s : la liste n'est pas dans le titre", async (page) => {
    await openPage(page);
    expect(el("h1").querySelector("ul")).toBeNull();
    expect(el("#game-switcher").closest("h1")).toBeNull();
  });

  it("à l'ouverture, le focus va sur le jeu courant ; flèches et Échap", async () => {
    await openPage("yamsHome");
    click("#game-switch");
    expect(el("#game-switcher").hidden).toBe(false);
    expect(document.activeElement?.textContent).toContain("Yams");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(document.activeElement?.textContent).toContain("5000");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(el("#game-switcher").hidden).toBe(true);
    expect(document.activeElement).toBe(el("#game-switch"));
  });
});

describe("même vocabulaire et icônes distinctes d'un jeu à l'autre", () => {
  it.each(["yamsHome", "g5000Home"] as const)("%s : le bouton dit « Palmarès »", async (page) => {
    await openPage(page);
    expect(el(".action-bar .btn-gold").textContent).toBe("🏆 Palmarès");
  });

  it("dans le sélecteur, chaque ligne a sa propre icône", async () => {
    await openPage("yamsHome");
    const icons = [...document.querySelectorAll("#game-switcher .switcher-icon")].map(
      (icon) => icon.textContent,
    );
    expect(icons).toEqual(["🍀", "💰", "🎲"]); // Yams, 5000, Tous les jeux
  });
});
