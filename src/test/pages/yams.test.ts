// Écrans du Yams : barème, saisie, feuilles du Hall of Fame.

import { describe, expect, it, vi } from "vitest";
import { button, click, el, openPage } from "./harness";
import { g5000Game, savedYams, yamsGame } from "./fixtures";
import { DEFAULT_RULES, normalizeRules } from "../../games/yams/scoring";

// Ouvre la fenêtre de saisie de la ligne dont le libellé commence par `label`.
function openLine(label: string): string[] {
  const row = [...document.querySelectorAll("#score-tables tr")].find((tr) =>
    tr.firstElementChild?.textContent?.startsWith(label),
  );
  if (!row) throw new Error(`Ligne introuvable : ${label}`);
  click(row.querySelector<HTMLButtonElement>(".score-cell")!);
  return [...el("#picker-values").querySelectorAll("button")].map((b) => b.textContent ?? "");
}

describe("saisie : seulement des valeurs possibles", () => {
  it("Chance : 0 puis 5 à 30", async () => {
    yamsGame();
    await openPage("yamsGame");
    const values = openLine("Chance");
    expect(values[0]).toBe("0");
    expect(values[1]).toBe("5");
    expect(values).not.toContain("4");
    expect(values[values.length - 1]).toBe("30");
  });

  it("Grande suite en somme : 0, 15 ou 20", async () => {
    yamsGame(undefined, undefined, normalizeRules({ grandeSuite: { type: "sum" } }));
    await openPage("yamsGame");
    expect(openLine("Gde Suite")).toEqual(["0", "15", "20"]);
  });
});

describe("mode « dés de la combinaison »", () => {
  const diceRules = normalizeRules({ brelan: { type: "dice" }, carre: { type: "dice" } });

  it("la grille l'affiche « Brelan (Σ3) » et propose 3, 6… 18", async () => {
    yamsGame(undefined, undefined, diceRules);
    await openPage("yamsGame");
    expect(openLine("Brelan (Σ3)")).toEqual(["0", "3", "6", "9", "12", "15", "18"]);
    expect(el("#picker-line").textContent).toBe("Brelan (Σ3)");
  });

  it("la valeur est rangée sous l'identifiant de la ligne", async () => {
    yamsGame(undefined, undefined, diceRules);
    await openPage("yamsGame");
    openLine("Carré (Σ4)");
    click(button("24", el("#picker-values")));
    expect(savedYams()?.players[0].scores.Classique?.carre).toBe(24);
  });

  it("se règle dans les Paramètres, pour le Brelan et le Carré seulement", async () => {
    await openPage("settings", "?game=yams");
    const segOf = (key: string): string[] =>
      [...document.querySelectorAll(`.setting-row[data-key="${key}"] .seg button`)].map(
        (b) => b.textContent ?? "",
      );
    expect(segOf("brelan")).toEqual(["Somme", "3 dés", "Fixe"]);
    expect(segOf("carre")).toEqual(["Somme", "4 dés", "Fixe"]);
    expect(segOf("full")).toEqual(["Somme", "Fixe"]);

    click(button("3 dés", el('.setting-row[data-key="brelan"]')));
    const stored = JSON.parse(localStorage.getItem("yams-rules") ?? "{}");
    expect(stored.brelan).toEqual({ type: "dice" });
    expect(el("#reset-rules").hidden).toBe(false);
  });
});

describe("Hall of Fame : la feuille garde les libellés de sa partie", () => {
  it("« Full (30) » si le Full valait 30 ce jour-là", async () => {
    const rules = { ...DEFAULT_RULES, full: { type: "fixed" as const, points: 30 } };
    localStorage.setItem(
      "bestScores",
      JSON.stringify([
        {
          name: "Alice",
          score: 230,
          date: "01/10/2026",
          variant: "Classique",
          sheet: { "1": 3, full: 30, bonus: 0, scoreFinal: 230 },
          lineOrder: ["1", "bonus", "full", "scoreFinal"],
          rules,
        },
      ]),
    );
    await openPage("yamsHall");
    click(el("#best-scores-table tbody tr.clickable"));
    const labels = [...document.querySelectorAll("#sheet-table td:first-child")].map(
      (td) => td.textContent,
    );
    expect(labels).toEqual(["1", "Bonus", "Full (30)"]);
  });
});

describe("à qui de jouer", () => {
  it("rien à signaler sur la grille du joueur qui doit jouer", async () => {
    yamsGame(["Alice", "Bob"]);
    await openPage("yamsGame");
    expect(el("#turn-hint").hidden).toBe(true);
  });

  it("sur la grille d'un autre, le dit et y ramène d'un toucher", async () => {
    yamsGame(["Alice", "Bob"]);
    await openPage("yamsGame");
    click("#next-player-btn");
    expect(el("#current-player-name").textContent).toBe("Bob");
    expect(el("#turn-hint").textContent).toBe("C'est à Alice ›");
    // Dans la barre du haut : rien ne s'intercale entre le nom et la grille.
    expect(el("#turn-hint").closest(".screen-bar")).not.toBeNull();

    click("#turn-hint");
    expect(el("#current-player-name").textContent).toBe("Alice");
    expect(el("#turn-hint").hidden).toBe(true);
  });

  it("après une correction dans la grille d'un autre, revient à celui qui doit jouer", async () => {
    vi.useFakeTimers();
    const game = yamsGame(["Alice", "Bob", "Chloé"]);
    for (const player of game.players) player.scores.Classique!["1"] = 1;
    localStorage.setItem("yams-saved-game", JSON.stringify(game));
    await openPage("yamsGame"); // tour complet : à Alice
    click("#next-player-btn"); // on regarde la grille de Bob…
    click(document.querySelectorAll<HTMLButtonElement>(".score-cell")[0]); // ligne des 1
    click(button("2", el("#picker-values"))); // …et on corrige son 1
    vi.advanceTimersByTime(1000);
    // Avant : la main passait au voisin de Bob, Chloé.
    expect(el("#current-player-name").textContent).toBe("Alice");
  });
});

describe("écran allumé", () => {
  it.each(["yamsGame", "g5000Game"] as const)("est demandé sur %s", async (page) => {
    const request = vi.fn(async () => ({}));
    vi.stubGlobal("navigator", { ...navigator, wakeLock: { request } });
    if (page === "yamsGame") yamsGame();
    else g5000Game();
    await openPage(page);
    vi.unstubAllGlobals();
    expect(request).toHaveBeenCalledWith("screen");
  });
});
