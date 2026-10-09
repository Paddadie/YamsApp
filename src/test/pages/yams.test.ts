// Écrans du Yams : barème, saisie, feuilles du Hall of Fame.

import { describe, expect, it, vi } from "vitest";
import { button, click, el, navigations, openPage } from "./harness";
import { filledYamsGame, g5000Game, savedYams, yamsGame } from "./fixtures";
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
    expect(labels).toEqual(["1", "Bonus (35)", "Full (30)"]);
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

describe("saisie : la case s'écrit, comme sur la feuille", () => {
  // Ligne des 4 de la première grille (les lignes des chiffres n'ont pas de
  // libellé texte : un dé dessiné).
  const fourLine = (): HTMLButtonElement =>
    document.querySelectorAll<HTMLButtonElement>("#score-tables .score-cell")[3];

  it("les chiffres disent leur nombre de dés", async () => {
    yamsGame();
    await openPage("yamsGame");
    click(fourLine());
    const dice = [...document.querySelectorAll("#picker-values .picker-dice")].map(
      (d) => d.textContent,
    );
    expect(dice).toEqual(["aucun", "1×", "2×", "3×", "4×", "5×"]);
    expect(el("#picker-values").children[2].getAttribute("aria-label")).toBe("8, 2 dés");
  });

  it("un 0 se barre", async () => {
    yamsGame();
    await openPage("yamsGame");
    click(fourLine());
    click(el("#picker-values .picker-value.is-zero"));
    expect(fourLine().classList.contains("is-zero")).toBe(true);
    expect(fourLine().classList.contains("is-written")).toBe(true);
  });

  it("un Yams s'entoure et se fête", async () => {
    yamsGame();
    await openPage("yamsGame");
    openLine("Yams");
    click(button("50", el("#picker-values")));
    const row = [...document.querySelectorAll("#score-tables tr")].find((tr) =>
      tr.firstElementChild?.textContent?.startsWith("Yams"),
    )!;
    expect(row.querySelector(".score-cell .hand-circle")).not.toBeNull();
    expect(row.querySelector(".yams-stamp")?.textContent).toBe("Yams !");
    expect(savedYams()?.players[0].scores.Classique?.yams).toBe(50);
  });
});

describe("Montante / Descendante : la prochaine case", () => {
  const marker = (): HTMLElement | null => document.querySelector(".next-marker");

  it("un liseré cerne la case à remplir, puis passe à la suivante", async () => {
    yamsGame(["Alice", "Bob"], ["Montante"]);
    await openPage("yamsGame");
    expect(marker()?.hidden).toBe(false);
    expect(marker()?.dataset.line).toBe("yams");

    openLine("Yams");
    click(button("50", el("#picker-values")));
    expect(marker()?.dataset.line).toBe("chance");
  });

  it("aucun liseré en Classique, où toutes les cases sont ouvertes", async () => {
    yamsGame();
    await openPage("yamsGame");
    expect(marker()).toBeNull();
  });
});

describe("fin de partie depuis la grille", () => {
  // La dernière case vide du dernier joueur : c'est à lui de jouer.
  function fillLastCell(): void {
    click(el("#score-tables .score-cell.is-empty"));
    const values = el("#picker-values").querySelectorAll<HTMLButtonElement>("button");
    click(values[values.length - 1]);
  }

  it("la dernière case remplie mène au podium", async () => {
    vi.useFakeTimers();
    filledYamsGame(["Alice", "Bob"], ["Classique"], 1);
    await openPage("yamsGame");
    expect(el("#current-player-name").textContent).toBe("Bob");
    fillLastCell();
    vi.advanceTimersByTime(3000);
    expect(navigations()).toEqual(["yamsEnd"]);
  });

  it("une flèche touchée dans la foulée n'empêche plus d'y aller", async () => {
    vi.useFakeTimers();
    filledYamsGame(["Alice", "Bob"], ["Classique"], 1);
    await openPage("yamsGame");
    fillLastCell();
    vi.advanceTimersByTime(250);
    click("#next-player-btn"); // réflexe : on regarde la grille d'Alice
    vi.advanceTimersByTime(3000);
    // Avant : l'auto-avance était annulée, la table restait sur une grille finie.
    expect(navigations()).toEqual(["yamsEnd"]);
  });

  it("partie en cours : une flèche annule toujours l'auto-avance", async () => {
    vi.useFakeTimers();
    yamsGame(["Alice", "Bob", "Chloé"]);
    await openPage("yamsGame");
    openLine("Chance");
    click(button("20", el("#picker-values")));
    click("#prev-player-btn"); // on regarde Chloé
    vi.advanceTimersByTime(3000);
    expect(el("#current-player-name").textContent).toBe("Chloé");
  });
});

describe("l'auto-avance laisse le temps de la fête", () => {
  it("après un Yams, la main ne passe qu'une fois le tampon parti", async () => {
    vi.useFakeTimers();
    yamsGame(["Alice", "Bob"]);
    await openPage("yamsGame");
    openLine("Yams");
    click(button("50", el("#picker-values")));
    vi.advanceTimersByTime(1000); // une saisie ordinaire serait déjà passée
    expect(el("#current-player-name").textContent).toBe("Alice");
    vi.advanceTimersByTime(800);
    expect(el("#current-player-name").textContent).toBe("Bob");
  });

  it("après le bonus décroché, la main attend la fin de la jauge", async () => {
    vi.useFakeTimers();
    const game = yamsGame(["Alice", "Bob"]);
    for (const player of game.players) {
      Object.assign(player.scores.Classique!, { "1": 3, "2": 6, "3": 9, "4": 12, "5": 15 });
    }
    localStorage.setItem("yams-saved-game", JSON.stringify(game));
    await openPage("yamsGame");
    click(document.querySelectorAll<HTMLButtonElement>("#score-tables .score-cell")[5]);
    click(button("18", el("#picker-values"))); // 63 : bonus
    vi.advanceTimersByTime(1500);
    expect(el("#current-player-name").textContent).toBe("Alice");
    vi.advanceTimersByTime(1000);
    expect(el("#current-player-name").textContent).toBe("Bob");
  });
});

describe("Montante / Descendante : l'ordre imposé", () => {
  const enabledLines = (): string[] =>
    [...document.querySelectorAll<HTMLButtonElement>("#score-tables .score-cell")]
      .filter((cell) => !cell.disabled)
      .map((cell) => cell.getAttribute("aria-label") ?? "");

  it("Montante : seule la case du Yams s'ouvre au départ", async () => {
    yamsGame(["Alice"], ["Montante"]);
    await openPage("yamsGame");
    expect(enabledLines()).toEqual(["Yams (50), Montante"]);
  });

  it("Descendante : seule la ligne des 1 s'ouvre, puis la suivante", async () => {
    yamsGame(["Alice"], ["Descendante"]);
    await openPage("yamsGame");
    expect(enabledLines()).toEqual(["1, Descendante"]);
    click(document.querySelectorAll<HTMLButtonElement>("#score-tables .score-cell")[0]);
    click(button("3", el("#picker-values")));
    // La case remplie reste corrigeable, la suivante s'ouvre.
    expect(enabledLines()).toEqual(["1, Descendante", "2, Descendante"]);
  });
});

describe("consultation (?review)", () => {
  it("partie finie : grilles en lecture seule, retour au classement", async () => {
    filledYamsGame(["Alice", "Bob"]);
    await openPage("yamsGame", "?review=1");
    expect(navigations()).toEqual([]);
    expect(el("#review-bar").hidden).toBe(false);
    expect(el("#pause-btn").hidden).toBe(true);
    expect(el<HTMLButtonElement>("#score-tables .score-cell").tabIndex).toBe(-1);
  });

  it("partie en cours : le paramètre est ignoré, on joue", async () => {
    yamsGame(["Alice", "Bob"]);
    await openPage("yamsGame", "?review=1");
    expect(el("#review-bar").hidden).toBe(true);
    expect(el("#pause-btn").hidden).toBe(false);
    click(el("#score-tables .score-cell"));
    expect(el<HTMLDialogElement>("#value-picker").open).toBe(true);
  });
});

describe("la fenêtre de saisie dit sa ligne", () => {
  it("un chiffre : le dé dessiné et « Les 4 »", async () => {
    yamsGame();
    await openPage("yamsGame");
    click(document.querySelectorAll<HTMLButtonElement>("#score-tables .score-cell")[3]);
    expect(el("#picker-line").textContent).toBe("Les 4");
    expect(el("#picker-line").querySelector("svg.die")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("changer de joueur au clavier", () => {
  it("la flèche garde le focus, et le nouveau joueur est annoncé", async () => {
    yamsGame(["Alice", "Bob"]);
    await openPage("yamsGame");
    const next = el<HTMLButtonElement>("#next-player-btn");
    next.focus();
    click(next);
    expect(document.activeElement).toBe(next);
    expect(el("#current-player-name").textContent).toBe("Bob");
    expect(el("#current-player-name").getAttribute("aria-live")).toBe("polite");
  });
});
