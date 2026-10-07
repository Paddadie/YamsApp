// Écrans du 5000 : calculette, feuille de progression, fin de partie.

import { describe, expect, it } from "vitest";
import { button, click, el, hasButton, openPage } from "./harness";
import { g5000Game, savedG5000 } from "./fixtures";
import { liveScores, sheetFrom } from "../../games/g5000/engine";

function roll(...faces: number[]): void {
  for (const face of faces) click(el(`.face-btn[data-face="${face}"]`));
  click(button("Valider ces dés"));
}

const foot = (): HTMLElement => el("#calc-foot");

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

    expect(button("Main pleine", foot()).classList.contains("btn-outline")).toBe(true);
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
    g5000Game(["Marlo", "Poulet"], { variants: ["sniper"] }, (g) => {
      g.players[0].sheet = sheetFrom([700, 1400, 1600]);
      g.players[1].sheet = sheetFrom([1200]);
      g.currentPlayerIndex = 1;
    });
    await openPage("g5000Game");
    click("#quick-btn");
    click('[data-chip="100"]');
    click('[data-chip="100"]');
    click('[data-chip="100"]');
    click('[data-chip="100"]');
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
    click('[data-chip="100"]');
    click('[data-chip="100"]');
    expect(el("#quick-bank").textContent).toBe("Banquer 200");
    click('[data-chip="100"]');
    expect(el("#quick-bank").textContent).toBe("🏆 Banquer 300 — victoire !");
    expect(el("#quick-after").textContent).toBe("🏆 5 000 : objectif atteint !");
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
    click("#quick-btn");

    const rows = [...document.querySelectorAll("#quick-targets tbody tr")].map((tr) =>
      [...tr.children].map((td) => td.textContent),
    );
    expect(rows).toEqual([
      ["Zoé1 400", "+400", "0", "−1 400"],
      ["Poulet1 600", "+600", "1 200", "−400"],
    ]);
  });

  it("sans Sniper, pas de tableau des cibles", async () => {
    g5000Game(["Marlo", "Poulet"], {}, (g) => {
      g.players[0].sheet = sheetFrom([1000]);
      g.players[1].sheet = sheetFrom([1600]);
    });
    await openPage("g5000Game");
    click("#quick-btn");
    expect(document.querySelector("#quick-targets table")).toBeNull();
  });
});

describe("variante « Sans demi-mesure »", () => {
  it("saisie rapide : pas de jeton +50", async () => {
    g5000Game(["Alice", "Bob"], { variants: ["noFifty"] });
    await openPage("g5000Game");
    expect(document.querySelector('[data-chip="fifty"]')).toBeNull();
    expect(document.querySelector('[data-chip="back"]')).not.toBeNull();
  });

  it("sans la variante, le jeton +50 est là", async () => {
    g5000Game(["Alice", "Bob"]);
    await openPage("g5000Game");
    expect(document.querySelector('[data-chip="fifty"]')).not.toBeNull();
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
  const nameTab = (name: string): HTMLElement =>
    [...document.querySelectorAll<HTMLElement>("#score-sheet thead th")].find(
      (th) => th.textContent === name,
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
