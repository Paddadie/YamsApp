// Habillage « La table de jeu » : couleurs du jeu, illustrations, états vides,
// fins à la couleur du vainqueur. Ce qui se vérifie sans navigateur (la place
// des éléments, leurs textes, les couleurs posées) ; le rendu se juge sur
// captures.

import { afterEach, describe, expect, it } from "vitest";
import { el, openPage } from "./harness";
import { draft, filledYamsGame, g5000Game, knownPlayers, yamsGame } from "./fixtures";
import { PLAYER_COLORS } from "../../core/playerColors";
import { sheetFrom } from "../../games/g5000/engine";
import { getLastWin } from "../../core/storage/lastWinRepo";
import { saveBestScores } from "../../games/yams/storage/hallOfFameRepo";
import { formatDate } from "../../core/dates";

describe("couleurs du jeu sur ses pages", () => {
  it("la grille du Yams porte l'encre et le papier du Yams", async () => {
    yamsGame();
    await openPage("yamsGame");
    const screen = el("#game-screen");
    expect(screen.style.getPropertyValue("--accent")).toBe("#17784a");
    expect(screen.style.getPropertyValue("--accent-paper")).toBe("#e5f1e8");
  });

  it("les joueurs prennent les couleurs du jeu qu'on prépare", async () => {
    draft("g5000", ["Alice", "Bob"]);
    await openPage("players");
    expect(el("#players-screen").style.getPropertyValue("--accent")).toBe("#bf4a26");
  });
});

describe("illustrations", () => {
  it("le menu dessine le cornet", async () => {
    await openPage("home");
    expect(document.querySelector("#brand-mark .cornet-illustration")).not.toBeNull();
  });

  it("l'accueil du Yams lance un Yams de 6", async () => {
    await openPage("yamsHome");
    const dice = [...document.querySelectorAll("#game-scene .scene-die")];
    expect(dice).toHaveLength(5);
    // Six points par face : un Yams.
    for (const die of dice) expect(die.querySelectorAll(".die-pip")).toHaveLength(6);
    // Décoratif : rien pour un lecteur d'écran.
    expect(el("#game-scene .dice-scene").getAttribute("aria-hidden")).toBe("true");
  });

  it("l'accueil du 5000 a aussi sa scène", async () => {
    await openPage("g5000Home");
    expect(document.querySelectorAll("#game-scene .scene-die")).toHaveLength(5);
  });
});

describe("fin de partie à la couleur du vainqueur", () => {
  it("Yams : l'en-tête prend la couleur d'Alice, son nom est surligné de blanc", async () => {
    filledYamsGame(["Alice", "Bob"]);
    await openPage("yamsEnd");
    const head = el("#end-screen .page-head");
    expect(head.style.getPropertyValue("--accent-paper")).toBe(PLAYER_COLORS[0]);
    expect(el(".end-winner").style.getPropertyValue("--winner")).toBe("var(--sheet)");
  });
});

describe("états vides", () => {
  it("palmarès du Yams vide : le podium à prendre, sans en-têtes de colonnes", async () => {
    await openPage("yamsHall");
    const best = el("#best-scores-table");
    expect(best.classList.contains("is-empty")).toBe(true);
    expect(best.textContent).toContain("Trois places à prendre");
    expect(best.querySelectorAll(".gommette--empty")).toHaveLength(3);
    expect(el("#worst-scores-table").textContent).toContain(
      "Les plus petits scores des parties classiques viendront ici.",
    );
  });

  it("palmarès du 5000 vide : des records à prendre", async () => {
    await openPage("g5000Records");
    expect(el("#records-empty").textContent).toBe(
      "Aucun record à 5 000 points pour l'instant. Le premier vainqueur ouvrira le palmarès.",
    );
    expect(el(".record-vacant").textContent).toBe("à prendre");
  });

  it("un joueur qui n'a jamais fini de partie est « nouveau »", async () => {
    knownPlayers("Alice", "Bob");
    draft("yams", ["Alice"]);
    await openPage("players");
    const games = [...document.querySelectorAll(".roster-row .games")];
    expect(games.every((g) => g.textContent === "nouveau")).toBe(true);
    expect(games[0].classList.contains("is-new")).toBe(true);
  });

  it("une partie du 5000 garde sa feuille vide telle quelle", async () => {
    g5000Game(["Alice", "Bob"], {}, (g) => {
      g.players[0].sheet = sheetFrom([]);
    });
    await openPage("g5000Game");
    expect(document.querySelector("#g5000-screen .dice-scene")).toBeNull();
  });
});

describe("menu : la soirée en cours", () => {
  it("la carte d'une partie de Yams dit le tour en cours", async () => {
    yamsGame(["Alice", "Bob"]);
    await openPage("home");
    expect(el(".game-resume .resume-progress-label").textContent).toBe("Tour 1 sur 13");
  });

  it("la carte d'une partie de 5000 dit qui mène", async () => {
    g5000Game(["Alice", "Bob"], {}, (g) => {
      g.players[0].sheet = sheetFrom([600]);
      g.players[1].sheet = sheetFrom([1200]);
    });
    await openPage("home");
    expect(el(".game-resume .resume-progress-label").textContent).toContain("Bob mène");
  });

  it("pas de post-it tant qu'aucune partie n'est finie", async () => {
    await openPage("home");
    expect(el("#last-win").hidden).toBe(true);
  });

  it("une fin de partie laisse son post-it « Dernière victoire »", async () => {
    filledYamsGame(["Alice", "Bob"]);
    await openPage("yamsEnd");
    expect(getLastWin()).toMatchObject({ gameId: "yams", winners: ["Alice"] });
    await openPage("home");
    const postit = el("#last-win");
    expect(postit.hidden).toBe(false);
    expect(postit.textContent).toContain("Dernière victoire");
    expect(postit.textContent).toContain("Alice au Yams");
    expect(postit.textContent).toContain("aujourd'hui");
  });
});

describe("règles illustrées", () => {
  it("les exemples sont dessinés en vrais dés, ceux qui ne comptent pas pâlis", async () => {
    await openPage("rules", "?game=yams");
    const examples = document.querySelectorAll(".rules-example");
    expect(examples.length).toBe(4);
    // Ligne des 4 : 4, 4, 4 comptent ; le 2 et le 6 non.
    expect(examples[0].querySelectorAll(".die.is-idle")).toHaveLength(2);
    expect(examples[0].querySelector(".rules-example-result")?.textContent).toBe("Ligne des 4 → 12");
  });
});

describe("finitions", () => {
  it("le Retour des pages qu'on consulte est un contour bleu", async () => {
    await openPage("rules", "?game=yams");
    expect(el("#back-btn").className).toBe("btn btn-secondary btn-outline");
  });

  it("chaque variante du Yams dit ce qu'elle change, sous son nom", async () => {
    await openPage("yamsHome");
    const hints = [...document.querySelectorAll(".variant-chip .chip-hint")].map((h) => h.textContent);
    expect(hints).toEqual([
      "La règle de base",
      "Du Yams vers les chiffres",
      "Des chiffres vers le Yams",
      "Un seul lancer, sans relance",
    ]);
  });

  it("les dates du palmarès s'écrivent dans les Paramètres comme au palmarès", async () => {
    saveBestScores([{ name: "Alice", score: 312, date: "15/08/2025" }]);
    await openPage("settings");
    expect(el(".score-admin-date").textContent).toBe(formatDate("15/08/2025"));
    expect(el(".score-admin-date").textContent).not.toBe("15/08/2025");
  });
});

describe("accueil sans défilement (audit du 09/10, piste B)", () => {
  it.each([
    ["yamsHome", () => yamsGame()],
    ["g5000Home", () => g5000Game()],
  ] as const)("%s : la partie en cours est dans l'en-tête, à la place des dés", async (page, seed) => {
    seed();
    await openPage(page);
    const card = el("#resume-card");
    expect(card.hidden).toBe(false);
    expect(card.closest(".game-hero")).not.toBeNull();
    expect(el(".screen-body").contains(card)).toBe(false);
  });

  // jsdom ne mesure rien : la hauteur du contenu est simulée. Il dépasse de
  // 120 px, la scène en rend 90, le resserrage le reste.
  // Posées sur HTMLElement, elles masquent celles d'Element (jsdom) : les
  // retirer suffit à revenir à la normale.
  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
    Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
  });

  function simulate(overflow: (screen: HTMLElement) => number): void {
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("screen-body") ? 500 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get(this: HTMLElement) {
        const screen = this.closest<HTMLElement>("#home-screen");
        return this.classList.contains("screen-body") && screen ? 500 + overflow(screen) : 0;
      },
    });
  }

  it("ce qui tient ne bouge pas", async () => {
    simulate(() => 0);
    await openPage("g5000Home");
    expect(el("#home-screen").className).not.toMatch(/is-tight/);
  });

  it("déborde un peu : seuls les dés s'effacent", async () => {
    simulate((screen) => (screen.classList.contains("is-tight") ? 0 : 60));
    await openPage("g5000Home");
    expect(el("#home-screen").classList.contains("is-tight")).toBe(true);
    expect(el("#home-screen").classList.contains("is-tighter")).toBe(false);
  });

  it("déborde encore : tout se resserre d'un cran", async () => {
    simulate((screen) =>
      screen.classList.contains("is-tighter") ? 0 : screen.classList.contains("is-tight") ? 30 : 120,
    );
    await openPage("g5000Home");
    expect(el("#home-screen").classList.contains("is-tighter")).toBe(true);
  });
});
