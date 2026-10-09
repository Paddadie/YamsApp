// Écrans du 5000 : calculette, feuille de progression, fin de partie.

import { describe, expect, it, vi } from "vitest";
import { button, click, el, hasButton, navigations, openPage } from "./harness";
import { g5000Game, savedG5000 } from "./fixtures";
import { liveScores, sheetFrom } from "../../games/g5000/engine";

function roll(...faces: number[]): void {
  for (const face of faces) click(el(`.face-btn[data-face="${face}"]`));
  click(button("Valider ces dés"));
}

const foot = (): HTMLElement => el("#calc-foot");

// Saisie manuelle (les paliers) : le millier, puis la case.
function pick(points: number): void {
  const thousand = Math.floor(points / 1000) * 1000;
  click(el(`[data-thousand="${thousand}"]`));
  click(el(`#quick-grid [data-offset="${points - thousand}"]`));
}

// La case d'un score, son millier affiché.
const tile = (points: number): HTMLElement => {
  const thousand = Math.floor(points / 1000) * 1000;
  click(el(`[data-thousand="${thousand}"]`));
  return el(`#quick-grid [data-offset="${points - thousand}"]`);
};

describe("calculette — objectif dépassé avec « Dans le mille »", () => {
  it("c'est un bust : passer la main au lieu de forcer à relancer", async () => {
    g5000Game(["Alice", "Bob"], { target: 5000, variants: ["exact"] }, (g) => {
      g.players[0].sheet = sheetFrom([4950]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(1, 2, 3, 4, 6);
    click(el('[data-combo="s1x1"]'));

    expect(hasButton("Relancer", foot())).toBe(false);
    click(button("Bust — passer la main", foot()));

    const game = savedG5000()!;
    expect(liveScores(game.players[0])).toEqual([4950]);
    expect(game.players[0].blankTurns).toBe(1);
    expect(game.stats?.biggestBust).toEqual({ player: 0, value: 100 });
    expect(game.currentPlayerIndex).toBe(1);
  });
});

describe("calculette — main pleine", () => {
  it("relance obligatoire : seule action, bouton plein", async () => {
    g5000Game(["Alice", "Bob"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(1, 1, 1, 5, 5);
    click(el('[data-combo="g1x3"]'));
    click(el('[data-combo="s5x2"]'));

    const buttons = [...foot().querySelectorAll("button")];
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain("Main pleine");
    expect(buttons[0].classList.contains("btn-outline")).toBe(false);
  });

  it("« Pas de zèle » : banquer permis, la relance redevient secondaire", async () => {
    g5000Game(["Alice", "Bob"], { variants: ["freeHotDice"] }, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(1, 1, 1, 5, 5);
    click(el('[data-combo="g1x3"]'));
    click(el('[data-combo="s5x2"]'));

    expect(button("Relancer 5 dés", foot()).classList.contains("btn-outline")).toBe(true);
    expect(hasButton("Banquer", foot())).toBe(true);
  });
});

describe("feuille de progression", () => {
  // Les scores écrits dans la colonne d'un joueur, « ~ » devant un score barré.
  const column = (index: number): string[] =>
    [...document.querySelectorAll("#score-sheet tbody tr")]
      .map((tr) => tr.children[index])
      .filter((td) => td?.querySelector(".entry"))
      .map((td) => {
        const entry = td.querySelector(".entry")!;
        return `${entry.tagName === "S" ? "~" : ""}${entry.textContent}`;
      });

  it("une colonne par joueur, à son rythme, sans ligne de totaux", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([700, 1400, 1600]);
      g.players[1].sheet = sheetFrom([1200]);
    });
    await openPage("g5000Game");
    expect(column(0)).toEqual(["700", "1 400", "1 600"]);
    expect(column(1)).toEqual(["1 200"]);
    expect(document.querySelector("#score-sheet .totals, #score-sheet .gain")).toBeNull();
    // Autant de lignes que la plus longue colonne, pas une de plus.
    expect(document.querySelectorAll("#score-sheet tbody tr")).toHaveLength(3);
  });

  it("avant le premier score, un message et aucune ligne", async () => {
    g5000Game(["Marlo", "Poulet"], { openAt: 500 });
    await openPage("g5000Game");
    const rows = document.querySelectorAll("#score-sheet tbody tr");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Personne n'est encore entré en jeu");
  });

  it("Sniper barre le score de l'adversaire sans l'effacer", async () => {
    vi.useFakeTimers(); // la jauge du banquier se remplit avant de passer la main
    g5000Game(["Marlo", "Poulet"], { variants: ["sniper"] }, (g) => {
      g.players[0].sheet = sheetFrom([700, 1400, 1600]);
      g.players[1].sheet = sheetFrom([1200]);
      g.currentPlayerIndex = 1;
    });
    await openPage("g5000Game");
    click("#quick-btn");
    pick(400);
    click("#quick-bank");

    expect(column(0)).toEqual(["700", "1 400", "~1 600"]);
    expect(column(1)).toEqual(["1 200", "1 600"]);
    // La marque dit qui a fait tomber le score.
    expect(el("#score-sheet .strike-mark--tie").getAttribute("aria-label")).toBe(
      "rattrapé par Poulet",
    );
  });

  it("surligne le score en vigueur, même sous une rature", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = [{ score: 700 }, { score: 1400 }, { score: 1600, struck: { kind: "tie", by: 1 } }];
    });
    await openPage("g5000Game");
    const live = [...document.querySelectorAll("#score-sheet .is-live .entry")];
    expect(live.map((e) => e.textContent)).toEqual(["1 400"]);
  });

  it("sous chaque nom, ses busts d'affilée ; en rouge avant la pénalité", async () => {
    g5000Game(["Marlo", "Poulet"], { blankTurnsPenalty: 3 }, (g) => {
      g.players[0].sheet = sheetFrom([700]);
      g.players[0].blankTurns = 1;
      g.players[1].sheet = sheetFrom([900]);
      g.players[1].blankTurns = 2;
    });
    await openPage("g5000Game");
    const rows = [...document.querySelectorAll<HTMLElement>("#score-sheet .sheet-pips")];
    expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual([
      "1 bust d'affilée sur 3",
      "2 busts d'affilée sur 3",
    ]);
    expect(rows[0].querySelectorAll(".pip--on")).toHaveLength(1);
    expect(rows[1].querySelectorAll(".pip--danger")).toHaveLength(2);
  });

  it("pas de pastilles quand la pénalité est désactivée", async () => {
    g5000Game(["Marlo", "Poulet"], { blankTurnsPenalty: 0 });
    await openPage("g5000Game");
    expect(document.querySelector("#score-sheet .sheet-pips")).toBeNull();
  });

  it("un joueur pas encore entré en jeu a un tiret sous son nom", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([700]);
    });
    await openPage("g5000Game");
    expect(el("#score-sheet .sheet-out").title).toBe("Pas encore entré en jeu");
  });
});

describe("banquer la victoire", () => {
  it("pile sur l'objectif, le bouton annonce la victoire", async () => {
    g5000Game(["Marlo", "Poulet"], { target: 5000, variants: ["exact"] }, (g) => {
      g.players[0].sheet = sheetFrom([4700]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    pick(200);
    expect(el("#quick-bank").textContent).toBe("Banquer 200");
    pick(300);
    // Le trophée l'annonce ; la ligne en or au-dessus le dit en toutes lettres.
    expect(el("#quick-bank").textContent).toBe("Banquer 300");
    expect(el("#quick-bank svg")?.getAttribute("data-icon")).toBe("trophy");
    expect(el("#quick-after").textContent).toBe("5 000 : objectif atteint !");
  });
});

describe("cibles à viser (Sniper)", () => {
  it("tous ceux qui sont devant, du plus proche au plus loin, avec leur chute", async () => {
    g5000Game(["Marlo", "Poulet", "Zoé", "Tom"], { variants: ["sniper"] }, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
      g.players[1].sheet = sheetFrom([1200, 1600]);
      g.players[2].sheet = sheetFrom([1400]);
      g.players[3].sheet = sheetFrom([500]); // derrière : absent
    });
    await openPage("g5000Game");
    click("#play-btn");
    // Replié : une pastille par adversaire devant, avec l'écart exact.
    const chips = [...document.querySelectorAll("#calc-targets .aim-chip")].map((c) => c.textContent);
    expect(chips).toEqual(["Zoé +400", "Poulet +600"]);
    expect(document.querySelector("#calc-targets table")).toBeNull();
    // « Détail » déplie le tableau d'avant.
    click(button("Détail", el("#calc-targets")));

    const rows = [...document.querySelectorAll("#calc-targets tbody tr")].map((tr) =>
      [...tr.children].map((td) => td.textContent),
    );
    expect(rows).toEqual([
      ["Zoé1 400", "+400", "0", "−1 400"],
      ["Poulet1 600", "+600", "1 200", "−400"],
    ]);
  });

  it("sans Sniper, ni cibles ni pastilles « Devant vous »", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
      g.players[1].sheet = sheetFrom([1600]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    expect(el("#calc-targets").childElementCount).toBe(0);
  });
});

describe("variante « Sans demi-mesure »", () => {
  it("paliers : les cases en 50 sont hachurées et ne se banquent pas", async () => {
    g5000Game(["Alice", "Bob"], { variants: ["noFifty"] }, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    expect(tile(750).classList.contains("is-blocked")).toBe(true);
    expect(tile(700).classList.contains("is-blocked")).toBe(false);
    // Choisie quand même (un bust peut la porter), elle dit pourquoi.
    pick(750);
    expect(el<HTMLButtonElement>("#quick-bank").disabled).toBe(true);
    expect(el("#quick-after").textContent).toContain("compte rond");
    pick(700);
    expect(el<HTMLButtonElement>("#quick-bank").disabled).toBe(false);
  });

  it("calculette : un compte qui finit par 50 ne se banque pas", async () => {
    g5000Game(["Alice", "Bob"], { variants: ["noFifty"] }, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(1, 5, 2, 3, 6);
    click(el('[data-combo="s1x1"]'));
    click(el('[data-combo="s5x1"]'));
    expect(button("Banquer", foot()).disabled).toBe(true);
    expect(el("#calc-after").textContent).toContain("compte rond");
    expect(hasButton("Relancer", foot())).toBe(true);

    // Sans le 5, 100 tout rond se banque.
    click(el('[data-combo="s5x1"]'));
    expect(button("Banquer", foot()).disabled).toBe(false);
  });
});

describe("variante Combo", () => {
  it("met en valeur les chiffres activés au lancer suivant", async () => {
    g5000Game(["Alice", "Bob"], { variants: ["combo"] }, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(3, 3, 3, 2, 4);
    click(el('[data-combo="g3x3"]'));
    click(button("Relancer", foot()));

    expect(el(".combo-strip").textContent).toContain("+100 par dé");
    expect(el('.face-btn[data-face="3"]').classList.contains("is-boosted")).toBe(true);
    expect(el('.face-btn[data-face="2"]').classList.contains("is-boosted")).toBe(false);

    roll(3, 2);
    const three = el('[data-combo="s3x1"]');
    expect(three.classList.contains("is-boosted")).toBe(true);
    expect(three.textContent).toContain("100");
  });

  it("sans la variante, rien n'est activé", async () => {
    g5000Game(["Alice", "Bob"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(3, 3, 3, 2, 4);
    click(el('[data-combo="g3x3"]'));
    click(button("Relancer", foot()));
    expect(document.querySelector(".combo-strip")).toBeNull();
  });
});

describe("écran de fin", () => {
  it("compte les tours réellement joués, busts compris", async () => {
    g5000Game(["Alice", "Bob"], {}, (g) => {
      g.players[0].sheet = sheetFrom([5000]);
      g.players[1].sheet = sheetFrom([2000]);
      g.stats!.turns = [7, 7];
      g.ended = true;
    });
    await openPage("g5000End");
    const rows = [...document.querySelectorAll("#ranking-table tbody tr")];
    expect(rows.map((r) => r.lastElementChild?.textContent)).toEqual(["7", "7"]);
  });
});

describe("records par objectif", () => {
  const records = {
    targets: {
      3000: { fastestWin: { name: "Zoé", value: 6, date: "01/10/2026" } },
      5000: { fastestWin: { name: "Paul", value: 12, date: "01/10/2026" } },
    },
    wins: { Paul: 1, Zoé: 1 },
  };

  it("la page montre l'objectif des réglages, et passe à un autre au toucher", async () => {
    localStorage.setItem("g5000-records", JSON.stringify(records));
    await openPage("g5000Records");
    expect(el("#target-block").hidden).toBe(false);
    const holder = (): string | null =>
      el("#records-best .record-card .record-holder").textContent;
    expect(holder()).toBe("Paul");

    const chip = el<HTMLInputElement>('#target-options input[value="3000"]');
    chip.checked = true;
    chip.dispatchEvent(new Event("change"));
    expect(holder()).toBe("Zoé");
  });

  it("sans records à un autre objectif, pas de choix à faire", async () => {
    await openPage("g5000Records");
    expect(el("#target-block").hidden).toBe(true);
    expect(el("#records-empty").textContent).toContain("5 000");
  });

  it("une partie finie à 3 000 se mesure aux records de 3 000", async () => {
    localStorage.setItem("g5000-records", JSON.stringify(records));
    g5000Game(["Alice", "Bob"], { target: 3000 }, (g) => {
      g.players[0].sheet = sheetFrom([3000]);
      g.stats!.turns = [8, 8];
      g.ended = true;
    });
    await openPage("g5000End");
    // 8 tours ne battent pas les 6 de Zoé à 3 000 — alors qu'ils battraient
    // les 12 de Paul à 5 000.
    expect(el("#records-broken").textContent).not.toContain("Victoire la plus rapide");
  });

  it("les Paramètres disent à quel objectif appartient chaque record", async () => {
    localStorage.setItem("g5000-records", JSON.stringify(records));
    await openPage("settings");
    const rows = [...document.querySelectorAll("#g5000-records-admin .score-admin-score")];
    expect(rows.map((r) => r.textContent)).toEqual(["6 tours · à 3 000", "12 tours · à 5 000"]);
  });
});

describe("à qui c'est le tour, en suivant la table", () => {
  // L'onglet lui-même : c'est lui, bouton dans l'en-tête, qui donne la main.
  const nameTab = (name: string): HTMLElement =>
    [...document.querySelectorAll<HTMLElement>("#score-sheet thead .name-tab")].find(
      (tab) => tab.textContent === name,
    )!;

  it("rien à signaler quand le joueur qui joue est celui attendu", async () => {
    g5000Game(["Alice", "Bob", "Chloé"]);
    await openPage("g5000Game");
    expect(el("#turn-hint").hidden).toBe(true);
  });

  it("la main donnée à un autre, la pastille le dit et y ramène", async () => {
    g5000Game(["Alice", "Bob", "Chloé"]);
    await openPage("g5000Game");
    click(nameTab("Chloé"));
    expect(el("#turn-name").textContent).toBe("Chloé");
    expect(el("#turn-hint").hidden).toBe(false);
    expect(el("#turn-hint").textContent).toBe("C'est à Alice ›");
    expect(el("#turn-hint").closest(".screen-bar")).not.toBeNull();

    click("#turn-hint");
    expect(el("#turn-name").textContent).toBe("Alice");
    expect(el("#turn-hint").hidden).toBe(true);
  });

  it("si l'autre a joué quand même, la table reprend à celui qui était en retard", async () => {
    g5000Game(["Alice", "Bob", "Chloé"]);
    await openPage("g5000Game");
    click(nameTab("Chloé"));
    click("#play-btn");
    roll(2, 3, 4, 6, 6); // bust de Chloé
    click(button("Passer la main"));
    // La main passe à Alice (après Chloé) : c'est bien son tour, plus de rappel.
    expect(el("#turn-name").textContent).toBe("Alice");
    expect(el("#turn-hint").hidden).toBe(true);
  });

  it("un tour entamé demande confirmation avant d'y revenir", async () => {
    g5000Game(["Alice", "Bob"], {}, (g) => {
      g.currentPlayerIndex = 1; // Bob a la main…
      g.turn = { pot: 300, diceLeft: 2, openDigits: [], rolls: 2 }; // …et a commencé
    });
    await openPage("g5000Game");
    expect(el("#turn-hint").textContent).toBe("C'est à Alice ›");
    click("#turn-hint");
    expect(el<HTMLDialogElement>("#switch-dialog").open).toBe(true);
    expect(el("#turn-name").textContent).toBe("Bob");
  });
});

describe("accueil du 5000 : objectif et variantes", () => {
  const rulesSaved = () => JSON.parse(localStorage.getItem("g5000-rules") ?? "{}");

  it("propose 5 000, 10 000 et 20 000, 5 000 coché par défaut", async () => {
    await openPage("g5000Home");
    const chips = [...document.querySelectorAll<HTMLInputElement>("#target-options input")];
    expect(chips.map((c) => c.value)).toEqual(["5000", "10000", "20000"]);
    expect(chips.find((c) => c.checked)?.value).toBe("5000");
  });

  it("chaque variante dit en quelques mots ce qu'elle change", async () => {
    await openPage("g5000Home");
    const hints = [...document.querySelectorAll("#g5000-variant-options .chip-hint")];
    expect(hints).toHaveLength(5);
    expect(hints[0].textContent).toContain("redescendre");
  });

  it("un ancien objectif (3 000) revient à 5 000", async () => {
    localStorage.setItem("g5000-rules", JSON.stringify({ target: 3000, variants: [] }));
    await openPage("g5000Home");
    expect(el<HTMLInputElement>('#target-options input[value="5000"]').checked).toBe(true);
    expect(rulesSaved().target).toBe(5000);
  });

  it("aucune variante cochée au départ, et les anciens réglages n'en cochent pas", async () => {
    localStorage.setItem(
      "g5000-rules",
      JSON.stringify({ target: 5000, tieRule: true, exactTarget: true }),
    );
    await openPage("g5000Home");
    const boxes = [...document.querySelectorAll<HTMLInputElement>("#g5000-variant-options input")];
    expect(boxes).toHaveLength(5);
    expect(boxes.some((b) => b.checked)).toBe(false);
  });

  it("une variante cochée est retenue, et la partie lancée la joue", async () => {
    await openPage("g5000Home");
    const sniper = el<HTMLInputElement>('#g5000-variant-options input[value="sniper"]');
    sniper.checked = true;
    sniper.dispatchEvent(new Event("change"));
    const target = el<HTMLInputElement>('#target-options input[value="10000"]');
    target.checked = true;
    target.dispatchEvent(new Event("change"));
    expect(rulesSaved().variants).toEqual(["sniper"]);
    expect(rulesSaved().target).toBe(10000);
  });
});

describe("page des règles du 5000", () => {
  const variantsBox = (): string =>
    document.querySelector(".rules-section--variants")?.textContent ?? "";

  it("depuis le menu : toutes les variantes", async () => {
    await openPage("rules", "?game=g5000");
    for (const name of ["Sniper", "Dans le mille", "Sans demi-mesure", "Pas de zèle", "Combo"]) {
      expect(variantsBox()).toContain(name);
    }
  });

  it("depuis la partie : seulement celles de la partie, à son objectif", async () => {
    g5000Game(["Alice", "Bob"], { target: 10000, variants: ["exact"] });
    await openPage("rules", "?game=g5000&from=play");
    expect(variantsBox()).toContain("Dans le mille");
    expect(variantsBox()).not.toContain("Sniper");
    expect(el("#rules-content").textContent).toContain("10 000");
  });

  it("depuis une partie sans variante : pas d'encadré", async () => {
    g5000Game(["Alice", "Bob"]);
    await openPage("rules", "?game=g5000&from=play");
    expect(document.querySelector(".rules-section--variants")).toBeNull();
  });
});

describe("Paramètres du 5000", () => {
  const saved = () => JSON.parse(localStorage.getItem("g5000-rules") ?? "{}");
  const change = (selector: string, value: string): void => {
    const input = el<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event("change"));
  };
  const toggle = (selector: string): void => {
    const input = el<HTMLInputElement>(selector);
    input.checked = !input.checked;
    input.dispatchEvent(new Event("change"));
  };
  const seg = (id: string, value: string): void =>
    click(el(`#${id} button[data-value="${value}"]`));

  it("ne règlent ni l'objectif ni les variantes", async () => {
    await openPage("settings", "?game=g5000");
    expect(document.querySelector("#g5000-target")).toBeNull();
    expect(document.querySelector("#g5000-tie")).toBeNull();
  });

  it("entrée en jeu : un interrupteur, puis un montant libre", async () => {
    await openPage("settings", "?game=g5000");
    expect(el<HTMLInputElement>("#g5000-open-on").checked).toBe(true);
    expect(el<HTMLInputElement>("#g5000-open-at").value).toBe("500");

    change("#g5000-open-at", "730");
    expect(saved().openAt).toBe(750); // ramené au pas de 50

    toggle("#g5000-open-on");
    expect(saved().openAt).toBe(0);
    expect(el("#g5000-open-sub").hidden).toBe(true);

    toggle("#g5000-open-on"); // rallumé : la dernière valeur revient
    expect(saved().openAt).toBe(750);
  });

  it("busts d'affilée : un interrupteur, puis un nombre libre", async () => {
    await openPage("settings", "?game=g5000");
    expect(el<HTMLInputElement>("#g5000-blank").value).toBe("3");
    change("#g5000-blank", "6");
    expect(saved().blankTurnsPenalty).toBe(6);
    toggle("#g5000-blank-on");
    expect(saved().blankTurnsPenalty).toBe(0);
  });

  it("riposte activée par défaut, désactivable", async () => {
    await openPage("settings", "?game=g5000");
    expect(el<HTMLInputElement>("#g5000-last-round").checked).toBe(true);
    toggle("#g5000-last-round");
    expect(saved().lastRound).toBe(false);
    expect(el("#g5000-last-round-note").textContent).toContain("tour de table");
  });

  it("carré « Perso » : six cases préremplies à 2 × le brelan", async () => {
    await openPage("settings", "?game=g5000");
    expect(el("#g5000-four-grid").hidden).toBe(true);
    seg("g5000-four", "custom");
    const values = [...document.querySelectorAll<HTMLInputElement>("#g5000-four-grid input")].map(
      (i) => i.value,
    );
    expect(values).toEqual(["2000", "400", "600", "800", "1000", "1200"]);

    change('#g5000-four-grid input[aria-label="Carré de 3"]', "900");
    expect(saved().fourKind).toBe("custom");
    expect(saved().customFours).toEqual([2000, 400, 900, 800, 1000, 1200]);

    // Retour à un multiple, puis « Perso » : la saisie est retrouvée.
    seg("g5000-four", "half");
    expect(el("#g5000-four-grid").hidden).toBe(true);
    seg("g5000-four", "custom");
    expect(el<HTMLInputElement>('#g5000-four-grid input[aria-label="Carré de 3"]').value).toBe("900");
  });

  it("brelan « Perso » : le carré à 2 × le suit", async () => {
    await openPage("settings", "?game=g5000");
    seg("g5000-triple", "custom");
    change('#g5000-triple-grid input[aria-label="Brelan de 2"]', "250");
    seg("g5000-four", "custom");
    expect(el<HTMLInputElement>('#g5000-four-grid input[aria-label="Carré de 2"]').value).toBe("500");
  });

  it("suite : 1 000, 1 500, ou un montant libre", async () => {
    await openPage("settings", "?game=g5000");
    expect(el("#g5000-run-sub").hidden).toBe(true);
    seg("g5000-run", "1500");
    expect(saved().runPoints).toBe(1500);
    seg("g5000-run", "custom");
    expect(el("#g5000-run-sub").hidden).toBe(false);
    change("#g5000-run-points", "0");
    expect(saved().runPoints).toBe(0);
  });

  it("« Remettre par défaut » est hors des cartes et ne touche ni à l'objectif ni aux variantes", async () => {
    localStorage.setItem(
      "g5000-rules",
      JSON.stringify({ target: 20000, variants: ["combo"], runPoints: 1500, lastRound: false }),
    );
    await openPage("settings", "?game=g5000");
    const reset = el("#g5000-reset");
    expect(reset.hidden).toBe(false);
    expect(reset.closest(".settings-group")).toBeNull();
    click(reset);
    expect(saved().runPoints).toBe(1000);
    expect(saved().lastRound).toBe(true);
    expect(saved().target).toBe(20000);
    expect(saved().variants).toEqual(["combo"]);
    expect(reset.hidden).toBe(true);
  });
});

describe("saisie manuelle : les paliers", () => {
  const bank = (): HTMLButtonElement => el<HTMLButtonElement>("#quick-bank");
  const after = (): string => el("#quick-after").textContent ?? "";
  const thousands = (): string[] =>
    [...document.querySelectorAll<HTMLElement>("#quick-thousands [data-thousand]")].map(
      (b) => b.dataset.thousand ?? "",
    );

  it("deux touches : le millier, puis la case", async () => {
    g5000Game(["Alice", "Bob"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    expect(after()).toBe("Touchez votre score.");
    expect(bank().disabled).toBe(true);
    pick(1500);
    expect(bank().textContent).toBe("Banquer 1 500");
    expect(bank().disabled).toBe(false);
    expect(el("#quick-bust").textContent).toBe("Bust · 1 500");
    expect(after()).toBe("si vous banquez : 2 500");
    expect(el('#quick-grid [aria-checked="true"]').textContent).toBe("1 500");
  });

  it("le millier change, la case reste : 500 puis « 1 000 » donne 1 500", async () => {
    g5000Game(["Alice", "Bob"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    click(el('#quick-grid [data-offset="500"]'));
    click(el('[data-thousand="1000"]'));
    expect(bank().textContent).toBe("Banquer 1 500");
  });

  it("toucher la case choisie la relâche", async () => {
    g5000Game(["Alice", "Bob"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    pick(300);
    pick(300);
    expect(bank().disabled).toBe(true);
    expect(after()).toBe("Touchez votre score.");
  });

  it("sous 1 000, la case « 0 » est vide et ne se touche pas", async () => {
    g5000Game(["Alice", "Bob"]);
    await openPage("g5000Game");
    click("#quick-btn");
    const zero = el<HTMLButtonElement>('#quick-grid [data-offset="0"]');
    expect(zero.disabled).toBe(true);
    expect(zero.textContent).toBe("");
  });

  it("les milliers vont jusqu'à deux fois l'objectif, 20 000 au plus", async () => {
    g5000Game(["Alice", "Bob"], { target: 5000 });
    await openPage("g5000Game");
    expect(thousands().at(-1)).toBe("10000");
    expect(thousands()).toHaveLength(11);

    g5000Game(["Alice", "Bob"], { target: 20000 });
    await openPage("g5000Game");
    expect(thousands().at(-1)).toBe("20000");
  });

  it("Sniper : une case qui tombe pile porte le point de l'adversaire", async () => {
    g5000Game(["Marlo", "Poulet"], { variants: ["sniper"] }, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
      g.players[1].sheet = sheetFrom([1600]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    const six = tile(600);
    expect(six.classList.contains("is-aim")).toBe(true);
    expect(six.querySelector(".pal-dot")).not.toBeNull();
    expect(six.getAttribute("aria-label")).toContain("pile sur Poulet");
    expect(tile(550).classList.contains("is-aim")).toBe(false);
    pick(600);
    expect(after()).toBe("Pile sur Poulet : redescend !");
  });

  it("Dans le mille : la case gagnante porte le trophée, celles au-delà sont des busts", async () => {
    g5000Game(["Marlo", "Poulet"], { target: 5000, variants: ["exact"] }, (g) => {
      g.players[0].sheet = sheetFrom([4700]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    expect(tile(300).classList.contains("is-win")).toBe(true);
    expect(tile(300).querySelector('[data-icon="trophy"]')).not.toBeNull();
    expect(tile(350).classList.contains("is-over")).toBe(true);
  });

  it("entrée en jeu : sous le seuil, les cases sont hachurées", async () => {
    g5000Game(["Alice", "Bob"], { openAt: 500 });
    await openPage("g5000Game");
    click("#quick-btn");
    expect(tile(450).classList.contains("is-blocked")).toBe(true);
    expect(tile(500).classList.contains("is-blocked")).toBe(false);
    pick(450);
    expect(bank().disabled).toBe(true);
    expect(after()).toContain("pour entrer en jeu");
  });

  it("Bust porte le score choisi, perdu pour le record du pot", async () => {
    g5000Game(["Alice", "Bob"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    pick(800);
    click("#quick-bust");
    const game = savedG5000()!;
    expect(game.stats?.biggestBust).toEqual({ player: 0, value: 800 });
    expect(game.currentPlayerIndex).toBe(1);
  });

  it("plus de mains pleines : la série ne vient que de la calculette", async () => {
    vi.useFakeTimers(); // la jauge du banquier se remplit avant de passer la main
    g5000Game(["Alice", "Bob"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    expect(document.querySelector('[data-chip="hand"]')).toBeNull();
    pick(2500);
    click(bank());
    vi.runAllTimers();
    expect(savedG5000()!.stats?.longestHotStreak).toBeUndefined();
  });

  it("refermée par erreur, la saisie garde le score ; il s'oublie à la fin du tour", async () => {
    vi.useFakeTimers(); // la jauge du banquier se remplit avant de passer la main
    g5000Game(["Alice", "Bob"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
      g.players[1].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    pick(1700);
    click("#quick-close");
    click("#quick-btn");
    expect(bank().textContent).toBe("Banquer 1 700");
    click(bank());

    vi.runAllTimers(); // la saisie rouvre une fois le bandeau passé à Bob
    click("#quick-btn");
    expect(after()).toBe("Touchez votre score.");
    expect(el('[data-thousand="0"]').classList.contains("is-on")).toBe(true);
  });

  it("donner la main pendant un score choisi demande confirmation, puis l'oublie", async () => {
    g5000Game(["Alice", "Bob"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
      g.players[1].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    pick(500);
    click("#quick-close");
    click(el("#score-sheet th:not(.is-current) .name-tab"));
    expect(el<HTMLDialogElement>("#switch-dialog").open).toBe(true);
    expect(el("#switch-summary").textContent).toContain("500");
    click("#switch-confirm");
    expect(savedG5000()!.currentPlayerIndex).toBe(1);
    click("#quick-btn");
    expect(after()).toBe("Touchez votre score.");
  });
});

describe("calculette : le joueur choisit ce qu'il garde", () => {
  it("une combinaison incompatible annonce ce qu'elle remplace", async () => {
    g5000Game(["Alice", "Bob"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(5, 5, 5, 1, 3);
    // Rien n'est retenu d'office.
    expect(document.querySelectorAll(".combo.picked")).toHaveLength(0);
    click('[data-combo="g5x3"]');
    expect(document.querySelectorAll(".roll-tray--pick .is-kept")).toHaveLength(3);
    expect(el('[data-combo="s5x1"] .combo-swap').textContent).toBe("à la place de Brelan de 5");
    // Un 1 s'ajoute sans rien remplacer.
    expect(document.querySelector('[data-combo="s1x1"] .combo-swap')).toBeNull();
    click('[data-combo="s5x1"]');
    expect([...document.querySelectorAll(".combo.picked")].map((c) => c.getAttribute("data-combo"))).toEqual(["s5x1"]);
  });
});

describe("saisie manuelle — ouverture", () => {
  it("le focus va à la fenêtre, pas à la première touche", async () => {
    g5000Game(["Marlo", "Poulet"]);
    await openPage("g5000Game");
    click("#quick-btn");
    expect(document.activeElement).toBe(el("#quick-dialog"));
  });

  it("la calculette aussi : le focus va au pupitre, pas à sa flèche", async () => {
    g5000Game(["Marlo", "Poulet"]);
    await openPage("g5000Game");
    click("#play-btn");
    expect(document.activeElement).toBe(el("#calc-dialog"));
  });
});

describe("après « Banquer »", () => {
  it("les deux saisies attendent que le bandeau passe au joueur suivant", async () => {
    vi.useFakeTimers();
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    pick(500);
    click("#quick-bank");

    // Le bandeau montre encore Marlo, qui vient de banquer.
    expect(el("#turn-name").textContent).toBe("Marlo");
    expect(el<HTMLButtonElement>("#play-btn").disabled).toBe(true);
    expect(el<HTMLButtonElement>("#quick-btn").disabled).toBe(true);
    expect(el<HTMLButtonElement>("#bar-bust").disabled).toBe(true);

    vi.runAllTimers();
    expect(el("#turn-name").textContent).toBe("Poulet");
    expect(el<HTMLButtonElement>("#play-btn").disabled).toBe(false);
    expect(el<HTMLButtonElement>("#quick-btn").disabled).toBe(false);
    expect(el<HTMLButtonElement>("#bar-bust").disabled).toBe(false);
  });
});

describe("revoir la feuille depuis la fin", () => {
  const finishedGame = (): void => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000, 5200]);
      g.players[1].sheet = sheetFrom([800]);
      g.ended = true;
    });
  };

  it("l'écran de fin y mène", async () => {
    finishedGame();
    await openPage("g5000End");
    expect(el("a[href='5000-game.html?review=1']").textContent).toContain("Revoir la feuille");
  });

  it("la feuille s'affiche en lecture seule, avec le retour au classement", async () => {
    finishedGame();
    await openPage("g5000Game", "?review=1");
    expect(navigations()).toEqual([]);
    const marlo = [...document.querySelectorAll("#score-sheet tbody td:first-child .entry")];
    expect(marlo.map((e) => e.textContent)).toEqual(["1 000", "5 200"]);
    expect(el("#turn-banner").hidden).toBe(true);
    expect(el("#entry-bar").hidden).toBe(true);
    expect(el("#pause-btn").hidden).toBe(true);
    expect(el("#review-bar").hidden).toBe(false);
    // Personne n'a la main : ni onglet en cours, ni onglet à toucher.
    expect(document.querySelector("#score-sheet th.is-current, #score-sheet th.is-choosable")).toBeNull();
  });

  it("une partie en cours ignore la consultation", async () => {
    g5000Game(["Marlo", "Poulet"]);
    await openPage("g5000Game", "?review=1");
    expect(el("#review-bar").hidden).toBe(true);
    expect(el("#entry-bar").hidden).toBe(false);
  });
});

describe("fin de partie : la mise en scène du Yams", () => {
  it("les marches montent une à une, puis le classement du dernier au premier", async () => {
    g5000Game(["Marlo", "Poulet", "Chloé"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000, 5200]);
      g.players[1].sheet = sheetFrom([800]);
      g.players[2].sheet = sheetFrom([1500]);
      g.ended = true;
    });
    await openPage("g5000End");
    const delay = (rank: number): string =>
      el(`#podium .rank-${rank}`).style.getPropertyValue("--d");
    expect([delay(3), delay(2), delay(1)]).toEqual(["0.08s", "0.26s", "0.44s"]);
    const rows = [...document.querySelectorAll<HTMLElement>("#ranking-table tbody tr")];
    expect(rows.every((row) => row.classList.contains("reveal"))).toBe(true);
    // Le dernier apparaît le premier.
    expect(parseFloat(rows[2].style.getPropertyValue("--d"))).toBeLessThan(
      parseFloat(rows[0].style.getPropertyValue("--d")),
    );
  });
});

describe("Sniper : « pile ! » s'allume au moment où le pot tombe juste", () => {
  it("une seule fois, pas à chaque touche qui garde le pot pile", async () => {
    g5000Game(["Marlo", "Poulet"], { variants: ["sniper"] }, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
      g.players[1].sheet = sheetFrom([1200]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    const chip = (): HTMLElement => el("#calc-targets .aim-chip");

    roll(1, 1, 3, 4, 6);
    click(el('[data-combo="s1x1"]'));
    expect(chip().classList.contains("is-hit")).toBe(false);
    click(el('[data-combo="s1x2"]'));
    expect(chip().classList.contains("is-hit-new")).toBe(true);
    expect(chip().textContent).toBe("Poulet pile !");
    // Déplier le détail redessine sans changer le pot : plus de rebond.
    click(button("Détail", el("#calc-targets")));
    expect(chip().classList.contains("is-hit")).toBe(true);
    expect(chip().classList.contains("is-hit-new")).toBe(false);
  });
});

describe("corriger le dernier tour", () => {
  const strip = (): HTMLElement => el("#last-turn");
  const stripText = (): string => el("#last-turn-text").textContent ?? "";
  const entries = (player: number): string[] =>
    [...document.querySelectorAll(`#score-sheet tbody td:nth-child(${player + 1}) .entry`)].map(
      (e) => e.textContent ?? "",
    );

  it("rien à corriger avant le premier tour", async () => {
    g5000Game(["Marlo", "Poulet"]);
    await openPage("g5000Game");
    expect(strip().hidden).toBe(true);
  });

  it("la ligne dit ce qui vient d'être écrit ; « Corriger » le reprend après confirmation", async () => {
    vi.useFakeTimers();
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    pick(600);
    click("#quick-bank");
    vi.runAllTimers();

    expect(strip().hidden).toBe(false);
    expect(stripText()).toBe("Marlo +600 → 1 600");
    expect(el("#turn-name").textContent).toBe("Poulet");

    click("#undo-btn");
    expect(el<HTMLDialogElement>("#undo-dialog").open).toBe(true);
    expect(el("#undo-title").textContent).toBe("Reprendre le tour de Marlo ?");
    expect(el("#undo-summary").textContent).toContain("+600 (1 000 → 1 600)");

    click("#undo-confirm");
    expect(entries(0)).toEqual(["1 000"]);
    expect(el("#turn-name").textContent).toBe("Marlo");
    expect(stripText()).toBe("Tour de Marlo repris : à rejouer.");
    expect(el("#undo-btn").hidden).toBe(true);
    expect(savedG5000()?.players[0].sheet).toEqual([{ score: 1000 }]);
  });

  it("« Garder » ne touche à rien", async () => {
    vi.useFakeTimers();
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    pick(500);
    click("#quick-bank");
    vi.runAllTimers();
    click("#undo-btn");
    click("#undo-cancel");
    expect(entries(0)).toEqual(["1 000", "1 500"]);
    expect(el("#turn-name").textContent).toBe("Poulet");
  });

  it("un bust par erreur se corrige aussi, et le tour entamé du suivant est annoncé", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
      g.players[1].sheet = sheetFrom([800]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    pick(500);
    click("#quick-bust");
    expect(stripText()).toBe("Marlo : bust, 500 perdus");

    // Poulet commence son tour aux paliers, puis on corrige Marlo.
    click("#quick-btn");
    pick(1000);
    click("#quick-close");
    click("#undo-btn");
    const summary = el("#undo-summary").textContent ?? "";
    expect(summary).toContain("Bust (500 perdus)");
    expect(summary).toContain("Busts d'affilée1 → 0");
    expect(summary).toContain("Tour de Pouletentamé : 1 000, sera perdu");
  });

  it("Sniper : l'adversaire tombé retrouve son score", async () => {
    vi.useFakeTimers();
    g5000Game(["Marlo", "Poulet"], { variants: ["sniper"] }, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
      g.players[1].sheet = sheetFrom([1500]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    pick(500);
    click("#quick-bank");
    click("#cascade-ok");
    vi.runAllTimers();
    expect(stripText()).toBe("Marlo +500 → 1 500 · Poulet redescend");

    click("#undo-btn");
    expect(el("#undo-summary").textContent).toContain("Poulet");
    expect(el("#undo-summary").textContent).toContain("retrouve 1 500");
    click("#undo-confirm");
    expect(entries(1)).toEqual(["1 500"]);
    expect(document.querySelector("#score-sheet s.entry")).toBeNull();
  });

  it("pas de ligne en consultation de fin de partie", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([5200]);
      g.ended = true;
    });
    await openPage("g5000Game", "?review=1");
    expect(strip().hidden).toBe(true);
  });
});

describe("le pupitre : les saisies se posent en bas, sans voile", () => {
  const screen = (): HTMLElement => el("#g5000-screen");
  const isOpen = (id: string): boolean => el<HTMLDialogElement>(id).open;

  it("ouvrir une saisie range la barre et résume le bandeau ; la flèche les rétablit", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    for (const [opener, panel, closer] of [
      ["#play-btn", "#calc-dialog", "#calc-close"],
      ["#quick-btn", "#quick-dialog", "#quick-close"],
    ]) {
      click(opener);
      expect(isOpen(panel)).toBe(true);
      expect(el("#entry-bar").hidden).toBe(true);
      expect(screen().classList.contains("is-entering")).toBe(true);
      click(closer);
      expect(isOpen(panel)).toBe(false);
      expect(el("#entry-bar").hidden).toBe(false);
      expect(screen().classList.contains("is-entering")).toBe(false);
    }
  });

  it("plus de bouton « Fermer » ni « Annuler » : refermer garde le tour", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    expect(hasButton("Fermer", foot())).toBe(false);
    roll(1, 2, 3, 4, 6);
    click(el('[data-combo="s1x1"]'));
    click(button("Relancer", foot()));
    click("#calc-close");
    click("#play-btn");
    expect(el("#calc-pot").textContent).toBe("100");
    expect(document.querySelector("#quick-cancel")).toBeNull();
  });

  it("Échap referme le pupitre, sauf sous une confirmation", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(isOpen("#quick-dialog")).toBe(false);
    expect(el("#entry-bar").hidden).toBe(false);

    // Une confirmation (donner la main pendant un tour entamé) s'ouvre
    // par-dessus la calculette : Échap est pour elle.
    click("#play-btn");
    roll(1, 2, 3, 4, 6);
    click(el('[data-combo="s1x1"]'));
    click(button("Relancer", foot()));
    click(el("#score-sheet th:not(.is-current) .name-tab"));
    expect(el<HTMLDialogElement>("#switch-dialog").open).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(isOpen("#calc-dialog")).toBe(true);
  });

  it("donner la main à un autre referme la saisie de l'ancien joueur", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
      g.players[1].sheet = sheetFrom([800]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    click(el("#score-sheet th:not(.is-current) .name-tab"));
    expect(savedG5000()!.currentPlayerIndex).toBe(1);
    expect(isOpen("#quick-dialog")).toBe(false);
    expect(el("#entry-bar").hidden).toBe(false);
  });
});

describe("le Bust de la barre du bas", () => {
  const stripText = (): string => el("#last-turn-text").textContent ?? "";

  it("une touche : le tour est un bust, la main passe", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#bar-bust");
    const game = savedG5000()!;
    expect(game.players[0].blankTurns).toBe(1);
    expect(game.currentPlayerIndex).toBe(1);
    expect(stripText()).toBe("Marlo : bust");
    expect(document.querySelector("dialog[open]")).toBeNull();
  });

  it("un score choisi aux paliers est perdu avec son pot", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    pick(500);
    click("#quick-close");
    click("#bar-bust");
    expect(stripText()).toBe("Marlo : bust, 500 perdus");
    expect(savedG5000()!.stats?.biggestBust).toEqual({ player: 0, value: 500 });
  });

  it("une calculette refermée en cours de tour aussi", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(1, 2, 3, 4, 6);
    click(el('[data-combo="s1x1"]'));
    click(button("Relancer", foot()));
    click("#calc-close");
    click("#bar-bust");
    expect(stripText()).toBe("Marlo : bust, 100 perdus");
  });
});

describe("la calculette au pupitre", () => {
  it("le pot et le lancer en tête ; des emplacements pour les dés à saisir", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    expect(el("#calc-sub").textContent).toBe("Lancer 1 · 5 dés");
    expect(el("#calc-pot").textContent).toBe("0");
    click(el('.face-btn[data-face="1"]'));
    click(el('.face-btn[data-face="1"]'));
    expect(document.querySelectorAll(".roll-tray .tray-die")).toHaveLength(2);
    expect(document.querySelectorAll(".roll-tray .roll-slot")).toHaveLength(3);
    expect(el('.face-btn[data-face="1"] .face-count').textContent).toBe("2");
    // Toucher un dé posé le retire.
    click(el(".roll-tray .tray-die"));
    expect(document.querySelectorAll(".roll-tray .roll-slot")).toHaveLength(4);
    click(el('.face-btn[data-face="1"]'));
    click(el('.face-btn[data-face="3"]'));
    click(el('.face-btn[data-face="4"]'));
    click(el('.face-btn[data-face="6"]'));
    click(button("Valider ces dés"));
    click(el('[data-combo="s1x2"]'));
    expect(el("#calc-pot").textContent).toBe("200");
    // Un pied d'une ligne : relancer, banquer.
    expect([...foot().querySelectorAll("button")].map((b) => b.textContent)).toEqual([
      "Relancer 3 dés",
      "Banquer 200",
    ]);
  });

  it("« Recommencer le tour » se confirme sur place", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    expect(hasButton("Recommencer le tour", el("#calc-stage"))).toBe(false);
    roll(1, 2, 3, 4, 6);
    click(el('[data-combo="s1x1"]'));
    click(button("Relancer", foot()));
    click(button("Recommencer le tour", el("#calc-stage")));
    expect(el(".restart-ask").textContent).toContain("Effacer le tour (100) ?");
    click(button("Non", el("#calc-stage")));
    expect(el("#calc-pot").textContent).toBe("100");
    click(button("Recommencer le tour", el("#calc-stage")));
    click(button("Oui, recommencer", el("#calc-stage")));
    expect(el("#calc-pot").textContent).toBe("0");
    expect(el("#calc-sub").textContent).toBe("Lancer 1 · 5 dés");
    expect(document.querySelector("#restart-dialog")).toBeNull();
  });

  it("la victoire : le trophée sur « Banquer », la ligne en or au-dessus", async () => {
    g5000Game(["Marlo", "Poulet"], { target: 5000 }, (g) => {
      g.players[0].sheet = sheetFrom([4900]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(1, 2, 3, 4, 6);
    click(el('[data-combo="s1x1"]'));
    const bank = button("Banquer", foot());
    expect(bank.textContent).toBe("Banquer 100");
    expect(bank.querySelector('[data-icon="trophy"]')).not.toBeNull();
    expect(el("#calc-after").textContent).toBe("5 000 : objectif atteint !");
  });

  it("un bust au premier lancer ne parle pas de « 0 points perdus »", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(2, 3, 4, 6, 6);
    expect(el(".bust-msg").textContent).toBe("Aucun dé ne marque : bust.");
  });
});

describe("calculette : les lancers déjà gardés, et revenir au précédent", () => {
  const aside = (): HTMLElement => el("#calc-stage .roll-aside");
  const keptGroups = (): string[] =>
    [...document.querySelectorAll("#calc-stage .aside-roll small")].map((s) => s.textContent ?? "");

  it("les dés gardés se posent à gauche de la bande, avec leur gain", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    expect(document.querySelector("#calc-stage .roll-aside")).toBeNull();
    roll(1, 1, 3, 4, 6);
    click(el('[data-combo="s1x2"]'));
    click(button("Relancer", foot()));
    expect(keptGroups()).toEqual(["+200"]);
    expect(aside().querySelectorAll(".die")).toHaveLength(2);
    roll(5, 2, 3);
    click(el('[data-combo="s5x1"]'));
    click(button("Relancer", foot()));
    expect(keptGroups()).toEqual(["+200", "+50"]);
    expect(el("#calc-sub").textContent).toBe("Lancer 3 · 2 dés");
  });

  it("la flèche rouvre le lancer précédent tel qu'il était", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(1, 1, 3, 4, 6);
    click(el('[data-combo="s1x2"]'));
    click(button("Relancer", foot()));
    roll(5, 2, 3);
    click(el('[data-combo="s5x1"]'));
    click(button("Relancer", foot()));
    // Au lancer 3, on se rend compte d'une erreur au lancer 2.
    click(el(".aside-back"));
    expect(el("#calc-sub").textContent).toBe("Lancer 2 · 3 dés");
    expect(el("#calc-pot").textContent).toBe("250");
    expect([...document.querySelectorAll(".combo.picked")].map((c) => c.getAttribute("data-combo"))).toEqual([
      "s5x1",
    ]);
    expect(keptGroups()).toEqual(["+200"]);
    // On garde autre chose : rien du lancer repris ne reste.
    click(el('[data-combo="s5x1"]'));
    expect(el("#calc-pot").textContent).toBe("200");
    expect(savedG5000()!.turn.history).toHaveLength(1);
  });

  it("jusqu'au premier lancer : plus de réserve", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(1, 1, 3, 4, 6);
    click(el('[data-combo="s1x2"]'));
    click(button("Relancer", foot()));
    click(el(".aside-back"));
    expect(el("#calc-sub").textContent).toBe("Lancer 1 · 5 dés");
    expect(document.querySelector("#calc-stage .roll-aside")).toBeNull();
    expect(el("#calc-pot").textContent).toBe("200");
  });

  it("une main pleine finie se résume en une pastille", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(1, 1, 1, 5, 5);
    click(el('[data-combo="g1x3"]'));
    click(el('[data-combo="s5x2"]'));
    click(button("Main pleine", foot()));
    expect(el("#calc-stage .aside-hand").textContent).toBe("1 100");
    expect(document.querySelectorAll("#calc-stage .aside-roll")).toHaveLength(0);
  });

  it("un bust inattendu peut venir d'une erreur au lancer d'avant", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(1, 2, 3, 4, 6);
    click(el('[data-combo="s1x1"]'));
    click(button("Relancer", foot()));
    roll(2, 3, 4, 6);
    expect(document.querySelector(".bust-msg")).not.toBeNull();
    click(el(".aside-back"));
    expect(el("#calc-sub").textContent).toBe("Lancer 1 · 5 dés");
    expect(document.querySelector(".bust-msg")).toBeNull();
  });

  it("le tour et sa réserve survivent à un rechargement", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(1, 1, 3, 4, 6);
    click(el('[data-combo="s1x2"]'));
    click(button("Relancer", foot()));

    await openPage("g5000Game");
    click("#play-btn");
    expect(keptGroups()).toEqual(["+200"]);
    click(el(".aside-back"));
    expect(el("#calc-pot").textContent).toBe("200");
  });
});

describe("la feuille A", () => {
  const pending = (): HTMLElement | null => document.querySelector("#score-sheet td.is-pending");

  it("les noms sur des intercalaires, les busts d'affilée dedans", async () => {
    g5000Game(["Marlo", "Poulet"], { blankTurnsPenalty: 3 }, (g) => {
      g.players[0].sheet = sheetFrom([700]);
      g.players[0].blankTurns = 1;
    });
    await openPage("g5000Game");
    const tab = el("#score-sheet th .name-tab");
    expect(tab.querySelector(".name-tab-text")?.textContent).toBe("Marlo");
    expect(tab.querySelector(".sheet-pips")).not.toBeNull();
  });

  it("des colonnes réglées sur l'objectif : plus étroites à 5 000", async () => {
    g5000Game(["Marlo", "Poulet"], { target: 5000 });
    await openPage("g5000Game");
    expect(el("#score-sheet").style.getPropertyValue("--num-min")).toBe("4.85rem");

    g5000Game(["Marlo", "Poulet"], { target: 10000 });
    await openPage("g5000Game");
    expect(el("#score-sheet").style.getPropertyValue("--num-min")).toBe("5.5rem");
  });

  it("l'objectif atteint est entouré d'un cercle tracé", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000, 5050]);
      g.finishedBy = 0;
      g.toPlay = [1];
      g.arrivals = [0];
      g.currentPlayerIndex = 1;
    });
    await openPage("g5000Game");
    expect(el("#score-sheet td.is-goal .entry .goal-circle")).not.toBeNull();
  });

  it("au repos, pas de case réservée ni de crayon", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
      g.players[1].sheet = sheetFrom([800]);
    });
    await openPage("g5000Game");
    expect(document.querySelector("#score-sheet .pending-cell")).toBeNull();
    expect(document.querySelectorAll("#score-sheet tbody tr")).toHaveLength(1);
  });

  it("pendant la saisie, le score s'écrit au crayon dans la colonne", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
      g.players[1].sheet = sheetFrom([800]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    // La case est réservée, vide tant qu'aucun score n'est choisi.
    expect(document.querySelectorAll("#score-sheet tbody tr")).toHaveLength(2);
    expect(el("#score-sheet .pending-cell").textContent).toBe("");
    pick(1500);
    expect(pending()?.querySelector(".entry")?.textContent).toBe("2 500");
    expect(pending()?.querySelector(".pending-gain")?.textContent).toBe("+1 500");
    // Refermée : la case se libère.
    click("#quick-close");
    expect(document.querySelector("#score-sheet .pending-cell")).toBeNull();
  });

  it("la calculette l'écrit aussi, au fil des dés gardés", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
    });
    await openPage("g5000Game");
    click("#play-btn");
    roll(1, 1, 3, 4, 6);
    click(el('[data-combo="s1x2"]'));
    expect(pending()?.querySelector(".entry")?.textContent).toBe("1 200");
  });

  it("un pot qui ne se banquerait pas est barré au crayon", async () => {
    g5000Game(["Marlo", "Poulet"], { openAt: 500 });
    await openPage("g5000Game");
    click("#quick-btn");
    pick(300);
    expect(pending()?.classList.contains("is-blocked")).toBe(true);
    pick(500);
    expect(pending()?.classList.contains("is-blocked")).toBe(false);
  });

  it("Sniper : le score de l'adversaire visé s'allume « pile ! »", async () => {
    g5000Game(["Marlo", "Poulet"], { variants: ["sniper"] }, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
      g.players[1].sheet = sheetFrom([1200, 1600]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    pick(500);
    expect(document.querySelector("#score-sheet td.is-hit")).toBeNull();
    pick(600);
    const hit = el("#score-sheet td.is-hit");
    expect(hit.querySelector(".entry")?.textContent).toBe("1 600");
  });
});

describe("onglets et titres", () => {
  it("un onglet à qui donner la main est un vrai bouton, l'en-tête reste un en-tête", async () => {
    g5000Game(["Alice", "Bob"]);
    await openPage("g5000Game");
    const [current, other] = document.querySelectorAll<HTMLElement>("#score-sheet thead th");
    expect(current.hasAttribute("role")).toBe(false);
    expect(other.hasAttribute("role")).toBe(false);
    expect(current.querySelector(".name-tab")?.tagName).toBe("SPAN");
    const tab = other.querySelector<HTMLButtonElement>("button.name-tab")!;
    expect(tab.getAttribute("aria-label")).toBe("Donner la main à Bob");
    click(tab);
    expect(el("#turn-name").textContent).toBe("Bob");
  });

  it("« Tour d'Alice » : « de » s'élide devant une voyelle", async () => {
    g5000Game(["Alice", "Bob"]);
    await openPage("g5000Game");
    click("#play-btn");
    expect(el("#calc-title").textContent).toBe("Tour d'Alice");
    click("#calc-close");
    click("#quick-btn");
    expect(el("#quick-title").textContent).toBe("Tour d'Alice");
  });
});
