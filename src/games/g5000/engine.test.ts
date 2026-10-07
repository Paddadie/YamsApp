import { describe, expect, it } from "vitest";
import {
  canBank,
  canPlay,
  canReroll,
  choosePlayer,
  closeTurn,
  createGame,
  currentScore,
  expectedPlayer,
  endTurn,
  finishTurn,
  keepDice,
  reroll,
  startTurn,
  turnStarted,
  isOvershoot,
  isUnround,
  liveScores,
  sheetFrom,
  standings,
  tieTargets,
  bankOutcome,
} from "./engine";
import { combosOf, countsOf, DEFAULT_RULES } from "./rules";
import type { Face, G5000Game, G5000Rules } from "./types";

const COLORS = ["#FCC1C7", "#A5E4BB", "#DAC8FC", "#EDCF92"];

function game(
  histories: number[][],
  over: Partial<G5000Rules> = {},
): G5000Game {
  const names = ["Marie", "Julien", "Paul", "Zoé"].slice(0, histories.length);
  const g = createGame(names, COLORS.slice(0, histories.length), {
    ...DEFAULT_RULES,
    ...over,
  });
  histories.forEach((h, i) => (g.players[i].sheet = sheetFrom(h)));
  return g;
}

const scores = (g: G5000Game): number[] => g.players.map(currentScore);

// Les chutes par égalité de score n'existent qu'avec la variante Sniper.
const sniper = (histories: number[][], over: Partial<G5000Rules> = {}): G5000Game =>
  game(histories, { variants: ["sniper"], ...over });

describe("progression du score", () => {
  it("empile les cumuls successifs, pas les gains", () => {
    const g = game([[]]);
    endTurn(g, 600);
    endTurn(g, 200);
    endTurn(g, 700);
    expect(liveScores(g.players[0])).toEqual([600, 800, 1500]);
    expect(currentScore(g.players[0])).toBe(1500);
  });

  it("n'ajoute aucune entrée pour un tour sans points", () => {
    const g = game([[600]]);
    endTurn(g, 0);
    expect(liveScores(g.players[0])).toEqual([600]);
  });

  it("ne compte rien tant que le seuil d'ouverture n'est pas atteint", () => {
    const g = game([[]], { openAt: 500 });
    const first = endTurn(g, 300);
    expect(first.scored).toBe(false);
    expect(liveScores(g.players[0])).toEqual([]);

    const second = endTurn(g, 500);
    expect(second.scored).toBe(true);
    expect(liveScores(g.players[0])).toEqual([500]);
  });

  it("une fois entré en jeu, les petits tours comptent", () => {
    const g = game([[600]], { openAt: 500 });
    endTurn(g, 50);
    expect(currentScore(g.players[0])).toBe(650);
  });
});

describe("feuille raturée : ce qui tombe est barré, pas effacé", () => {
  it("la partie de Marlo et Poulet, comme sur papier", () => {
    const g = sniper([[], []]);
    endTurn(g, 700); // Marlo
    g.currentPlayerIndex = 1;
    endTurn(g, 1200); // Poulet
    g.currentPlayerIndex = 0;
    endTurn(g, 700); // Marlo : 1 400
    endTurn(g, 200); // Marlo : 1 600
    g.currentPlayerIndex = 1;
    endTurn(g, 400); // Poulet égalise à 1 600

    expect(g.players[0].sheet).toEqual([
      { score: 700 },
      { score: 1400 },
      { score: 1600, struck: { kind: "tie", by: 1 } },
    ]);
    expect(currentScore(g.players[0])).toBe(1400);
    expect(liveScores(g.players[0])).toEqual([700, 1400]);

    g.currentPlayerIndex = 0;
    endTurn(g, 1300); // Marlo repart : 2 700 s'écrit sous le score barré
    expect(g.players[0].sheet.map((e) => e.score)).toEqual([700, 1400, 1600, 2700]);
    expect(currentScore(g.players[0])).toBe(2700);
  });

  it("barre le dernier score EN VIGUEUR, pas la dernière ligne", () => {
    const g = sniper([[600, 800, 1500], [600]]);
    g.players[0].sheet[2].struck = { kind: "tie", by: 1 }; // Marie à 800
    g.currentPlayerIndex = 1;
    endTurn(g, 200); // Julien égalise à 800

    expect(g.players[0].sheet.map((e) => !!e.struck)).toEqual([false, true, true]);
    expect(currentScore(g.players[0])).toBe(600);
  });

  it("la pénalité des tours sans marquer barre aussi, avec sa marque", () => {
    const g = sniper([[600, 1000]], { blankTurnsPenalty: 3 });
    endTurn(g, 0);
    endTurn(g, 0);
    endTurn(g, 0);
    expect(g.players[0].sheet).toEqual([
      { score: 600 },
      { score: 1000, struck: { kind: "penalty" } },
    ]);
  });

  it("retombé à zéro, le joueur garde ses scores barrés et doit rouvrir", () => {
    const g = sniper([[200], [600]], { openAt: 0 });
    g.currentPlayerIndex = 0;
    endTurn(g, 400); // Marie à 600 : Julien retombe à zéro
    expect(g.players[1].sheet).toEqual([{ score: 600, struck: { kind: "tie", by: 0 } }]);
    expect(currentScore(g.players[1])).toBe(0);
  });
});

describe("variante Sniper", () => {
  it("fait redescendre l'adversaire rattrapé à son score précédent", () => {
    const g = sniper([[600, 800, 1500], [600, 800, 1500, 2800]]);
    g.currentPlayerIndex = 0;
    const { moves } = endTurn(g, 1300); // Marie passe à 2800

    expect(scores(g)).toEqual([2800, 1500]);
    expect(moves.map((m) => m.kind)).toEqual(["bank", "tie"]);
    expect(moves[1]).toMatchObject({ player: 1, from: 2800, to: 1500, by: 0 });
  });

  it("seul le joueur qui possédait déjà ce score redescend", () => {
    const g = sniper([[1000], [2800], [900]]);
    g.currentPlayerIndex = 0;
    endTurn(g, 1800);
    expect(scores(g)).toEqual([2800, 0, 900]);
  });

  it("fait redescendre tous ceux qui ont ce score", () => {
    // Deux joueurs sur le même score : impossible en cours de partie, mais une
    // reprise de sauvegarde ancienne pourrait le produire.
    const g = sniper([[1000], [2000, 2800], [2100, 2800]]);
    g.currentPlayerIndex = 0;
    endTurn(g, 1800);
    expect(scores(g)).toEqual([2800, 2000, 2100]);
  });

  it("cascade : la redescente peut en provoquer une autre", () => {
    const g = sniper([[1850], [800, 1450, 2300], [350, 900, 1450]]);
    g.currentPlayerIndex = 0;
    const { moves } = endTurn(g, 450); // Marie passe à 2300

    expect(scores(g)).toEqual([2300, 1450, 900]);
    expect(moves.map((m) => m.kind)).toEqual(["bank", "tie", "tie"]);
    expect(moves[2]).toMatchObject({ player: 2, from: 1450, to: 900, by: 1 });
  });

  it("rattrapé sans score précédent : retour à zéro, et il ressort du jeu", () => {
    const g = sniper([[200], [600]]);
    g.currentPlayerIndex = 0;
    endTurn(g, 400); // Marie passe à 600

    expect(scores(g)).toEqual([600, 0]);
    expect(liveScores(g.players[1])).toEqual([]);
    // Il doit revalider le seuil d'ouverture.
    g.currentPlayerIndex = 1;
    expect(endTurn(g, 300).scored).toBe(false);
  });

  it("s'applique dès le premier score", () => {
    const g = sniper([[], [600]]);
    g.currentPlayerIndex = 0;
    endTurn(g, 600);
    expect(scores(g)).toEqual([600, 0]);
  });

  it("zéro n'est pas un score : le premier à banquer ne fait tomber personne", () => {
    const g = sniper([[], [], []]);
    g.currentPlayerIndex = 0;
    const { moves } = endTurn(g, 600);
    expect(scores(g)).toEqual([600, 0, 0]);
    expect(moves.map((m) => m.kind)).toEqual(["bank"]);
  });

  it("est réciproque", () => {
    const g = sniper([[1000, 2800], [1500]]);
    g.currentPlayerIndex = 1;
    endTurn(g, 1300); // Julien passe à 2800 à son tour
    expect(scores(g)).toEqual([1000, 2800]);
  });

  it("ne s'applique pas sans la variante", () => {
    const g = game([[1500], [2800]]);
    g.currentPlayerIndex = 0;
    endTurn(g, 1300);
    expect(scores(g)).toEqual([2800, 2800]);
  });

  // Propriété qui découle de la règle, et qu'on veut voir casser si elle change.
  it("laisse toujours les scores non nuls deux à deux distincts", () => {
    const g = sniper([[1850], [800, 1450, 2300], [350, 900, 1450], [700]]);
    g.currentPlayerIndex = 0;
    endTurn(g, 450);

    const nonZero = scores(g).filter((s) => s > 0);
    expect(new Set(nonZero).size).toBe(nonZero.length);
  });

  it("termine même sur des historiques faits pour cascader au maximum", () => {
    const g = sniper([
      [100],
      [100, 200, 300, 400, 500],
      [100, 200, 300, 400],
      [100, 200, 300],
    ]);
    g.currentPlayerIndex = 0;
    const { moves } = endTurn(g, 400); // Marie passe à 500

    expect(scores(g)).toEqual([500, 400, 300, 200]);
    expect(moves.filter((m) => m.kind === "tie")).toHaveLength(3);
  });
});

describe("pénalité des tours sans marquer", () => {
  it("compte les tours et annule le score actuel au troisième", () => {
    const g = game([[600, 800, 1500, 2800]]);
    endTurn(g, 0);
    expect(g.players[0].blankTurns).toBe(1);
    endTurn(g, 0);
    expect(g.players[0].blankTurns).toBe(2);
    expect(currentScore(g.players[0])).toBe(2800);

    const { moves } = endTurn(g, 0);
    expect(currentScore(g.players[0])).toBe(1500);
    expect(g.players[0].blankTurns).toBe(0);
    expect(moves[0]).toMatchObject({ kind: "penalty", from: 2800, to: 1500 });
  });

  it("remet le compteur à zéro dès que le joueur marque", () => {
    const g = game([[600, 800]]);
    endTurn(g, 0);
    endTurn(g, 0);
    endTurn(g, 200);
    expect(g.players[0].blankTurns).toBe(0);
    endTurn(g, 0);
    expect(g.players[0].blankTurns).toBe(1);
    expect(currentScore(g.players[0])).toBe(1000);
  });

  it("ne démarre qu'une fois le joueur entré en jeu", () => {
    const g = game([[]]);
    endTurn(g, 0);
    endTurn(g, 0);
    endTurn(g, 0);
    expect(g.players[0].blankTurns).toBe(0);
    expect(liveScores(g.players[0])).toEqual([]);
  });

  it("un joueur qui n'a qu'un score retombe à zéro", () => {
    const g = game([[600]]);
    endTurn(g, 0);
    endTurn(g, 0);
    endTurn(g, 0);
    expect(currentScore(g.players[0])).toBe(0);
    expect(liveScores(g.players[0])).toEqual([]);
  });

  it("la redescente peut faire tomber un adversaire à son tour", () => {
    const g = sniper([[600, 800, 1500, 2800], [1000, 1500]]);
    g.currentPlayerIndex = 0;
    endTurn(g, 0);
    endTurn(g, 0);
    const { moves } = endTurn(g, 0);

    expect(scores(g)).toEqual([1500, 1000]);
    expect(moves.map((m) => m.kind)).toEqual(["penalty", "tie"]);
  });

  it("ne fait rien quand la règle est désactivée", () => {
    const g = game([[600, 1500]], { blankTurnsPenalty: 0 });
    endTurn(g, 0);
    endTurn(g, 0);
    endTurn(g, 0);
    expect(currentScore(g.players[0])).toBe(1500);
  });

  it("compte un dépassement (« Dans le mille ») comme un bust", () => {
    const g = game([[600, 4800]], { target: 5000, variants: ["exact"] });
    startTurn(g);
    g.turn.pot = 300;
    finishTurn(g, "bust");
    expect(g.players[0].blankTurns).toBe(1);
  });
});

describe("banque", () => {
  it("refuse un pot qui dépasserait la cible avec « Dans le mille »", () => {
    const g = game([[4800]], { target: 5000, variants: ["exact"] });
    expect(canBank(g, 200, false)).toBe(true);
    expect(canBank(g, 250, false)).toBe(false);
    expect(isOvershoot(g, 250)).toBe(true);
  });

  it("accepte le dépassement sans « Dans le mille » (règle de base)", () => {
    const g = game([[4800]], { target: 5000 });
    expect(canBank(g, 900, false)).toBe(true);
    expect(isOvershoot(g, 900)).toBe(false);
  });

  it("ne fait plus relancer une fois la cible dépassée avec « Dans le mille »", () => {
    const g = game([[4800]], { target: 5000, variants: ["exact"] });
    expect(canReroll(g, 200)).toBe(true);
    expect(canReroll(g, 250)).toBe(false);
  });

  it("laisse relancer au-delà de la cible quand elle n'est pas exacte", () => {
    const g = game([[4800]], { target: 5000 });
    expect(canReroll(g, 900)).toBe(true);
  });

  it("interdit de banquer une main pleine : la relance est obligatoire", () => {
    const g = game([[4200]], { target: 5000 });
    expect(canBank(g, 800, true)).toBe(false);
    expect(canBank(g, 800, false)).toBe(true);
  });

  it("autorise la victoire sur main pleine avec « Pas de zèle »", () => {
    const g = game([[4200]], { target: 5000, variants: ["freeHotDice"] });
    expect(canBank(g, 800, true)).toBe(true);
  });

  it("autorise alors à banquer n'importe quelle main pleine, pas seulement sur la cible", () => {
    const g = game([[1000]], { target: 5000, variants: ["freeHotDice", "exact"] });
    expect(canBank(g, 600, true)).toBe(true);
    // Les autres limites tiennent toujours : dépassement avec « Dans le mille ».
    expect(canBank(g, 4100, true)).toBe(false);
  });

  it("refuse de banquer sous le seuil d'ouverture", () => {
    const g = game([[]], { openAt: 500 });
    expect(canBank(g, 300, false)).toBe(false);
    expect(canBank(g, 500, false)).toBe(true);
  });

  it("refuse un compte qui finit par 50 avec « Sans demi-mesure »", () => {
    const g = game([[1000]], { variants: ["noFifty"] });
    expect(isUnround(g, 350)).toBe(true);
    expect(canBank(g, 350, false)).toBe(false);
    expect(canBank(g, 400, false)).toBe(true);
    // Sans la variante, 350 se banque.
    expect(canBank(game([[1000]]), 350, false)).toBe(true);
  });
});

describe("cibles à viser", () => {
  it("indique ce qu'il faut exactement pour faire tomber chaque adversaire", () => {
    const g = sniper([[1850], [800, 1450, 2300], [350, 900, 1450], [700]]);
    g.currentPlayerIndex = 0;
    expect(tieTargets(g, 0)).toEqual([
      { index: 1, name: "Julien", score: 2300, needed: 450, fallsTo: 1450 },
    ]);
  });

  it("classe les plus proches d'abord, ceux que le pot a dépassés à la fin", () => {
    const g = sniper([[1000], [1300], [1150], [1600]]);
    g.currentPlayerIndex = 0;
    // Pot de 400 : Marie serait à 1 400. Zoé (1 600) est encore à +200 ;
    // Julien (1 300) et Paul (1 150) sont dépassés, le moins dépassé en tête.
    expect(tieTargets(g, 400).map((t) => [t.name, t.needed])).toEqual([
      ["Zoé", 200],
      ["Julien", -100],
      ["Paul", -250],
    ]);
  });

  it("retombe à zéro quand il n'a qu'un score", () => {
    const g = sniper([[1000], [1300]]);
    g.currentPlayerIndex = 0;
    expect(tieTargets(g, 0)[0].fallsTo).toBe(0);
  });

  it("décompte au fur et à mesure que le pot monte", () => {
    const g = sniper([[1850], [2300]]);
    g.currentPlayerIndex = 0;
    expect(tieTargets(g, 300)[0].needed).toBe(150);
    expect(tieTargets(g, 450)[0].needed).toBe(0);
    expect(tieTargets(g, 600)[0].needed).toBe(-150);
  });

  it("ignore les adversaires qu'on ne peut plus rattraper par le bas", () => {
    const g = sniper([[2000], [1500], [900]]);
    g.currentPlayerIndex = 0;
    expect(tieTargets(g, 0)).toEqual([]);
  });

  it("ne propose rien sans la variante Sniper", () => {
    const g = game([[1850], [2300]]);
    expect(tieTargets(g, 0)).toEqual([]);
  });
});

describe("ce que banquer ferait de la partie (bankOutcome)", () => {
  it("pile sur l'objectif : la victoire", () => {
    const g = game([[4700], [3000]], { target: 5000, variants: ["exact"] });
    g.currentPlayerIndex = 0;
    expect(bankOutcome(g, 300)).toBe("win");
    expect(bankOutcome(g, 250)).toBeNull(); // pas encore
    expect(bankOutcome(g, 350)).toBeNull(); // dépassé : bust
  });

  it("à égalité avec un joueur déjà arrivé : objectif atteint, derrière lui", () => {
    const g = game([[4700], [5000]], { target: 5000, variants: ["exact"] });
    g.currentPlayerIndex = 0;
    expect(bankOutcome(g, 300)).toBe("reached");
  });

  it("rien à annoncer sur un compte refusé par « Sans demi-mesure »", () => {
    const g = game([[4700], [3000]], { target: 5000, variants: ["noFifty"] });
    g.currentPlayerIndex = 0;
    expect(bankOutcome(g, 350)).toBeNull();
    expect(bankOutcome(g, 400)).toBe("win");
  });

  it("au-dessus de tous, ou seulement arrivé", () => {
    const g = game([[4700], [5200]], { target: 5000 });
    g.currentPlayerIndex = 0;
    expect(bankOutcome(g, 300)).toBe("reached");
    expect(bankOutcome(g, 600)).toBe("win");
  });
});

describe("fin de partie", () => {
  it("laisse chaque adversaire riposter une fois", () => {
    const g = game([[3000], [4800], [2000]], { target: 5000 });
    g.currentPlayerIndex = 1;
    endTurn(g, 200); // Julien atteint la cible

    expect(g.finishedBy).toBe(1);
    expect(g.toPlay).toEqual([2, 0]); // Paul, puis Marie qui avait déjà joué
    expect(closeTurn(g)).toBe(false);
    expect(g.currentPlayerIndex).toBe(2);
    endTurn(g, 0);
    expect(closeTurn(g)).toBe(false);
    expect(g.currentPlayerIndex).toBe(0);
    endTurn(g, 0);
    expect(closeTurn(g)).toBe(true);
  });

  it("sans riposte, termine seulement le tour de table en cours", () => {
    const g = game([[3000], [4800], [2000]], { target: 5000, lastRound: false });
    g.stats!.turns = [1, 0, 0]; // Marie a déjà joué ce tour-ci
    g.currentPlayerIndex = 1;
    endTurn(g, 200);
    expect(g.toPlay).toEqual([2]);
  });

  it("sans riposte, s'arrête aussitôt quand le dernier du tour atteint la cible", () => {
    const g = game([[3000], [2000], [4800]], { target: 5000, lastRound: false });
    g.stats!.turns = [1, 1, 0];
    g.currentPlayerIndex = 2;
    endTurn(g, 200);
    expect(closeTurn(g)).toBe(true);
    expect(g.ended).toBe(true);
  });

  describe("tour de table après avoir donné la main", () => {
    // Le tour a commencé par Julien (main donnée), puis Paul : Marie, assise
    // en premier, n'a pas encore joué.
    const reordered = (): G5000Game => {
      const g = game([[3000], [2000], [4800]], { target: 5000, lastRound: false });
      g.stats!.turns = [0, 1, 0];
      return g;
    };

    it("laisse jouer celui qui, assis avant le vainqueur, n'a pas joué ce tour", () => {
      const g = reordered();
      g.currentPlayerIndex = 2; // Paul atteint la cible
      endTurn(g, 200);
      expect(g.toPlay).toEqual([0]);
    });

    it("ne fait pas rejouer ceux qui ont déjà joué ce tour", () => {
      const g = reordered();
      g.stats!.turns = [0, 1, 1];
      g.players[0].sheet = sheetFrom([4800]);
      g.currentPlayerIndex = 0; // Marie, dernière du tour, atteint la cible
      endTurn(g, 200);
      expect(closeTurn(g)).toBe(true);
    });

    it("se joue en tours réellement comptés de bout en bout (finishTurn)", () => {
      const g = game([[3000], [2000], [4800]], { target: 5000, lastRound: false });
      choosePlayer(g, 1);
      finishTurn(g, "bust"); // Julien
      g.turn.pot = 200; // Paul atteint la cible
      expect(finishTurn(g, "bank").ended).toBe(false);
      expect(g.currentPlayerIndex).toBe(0); // Marie joue encore son tour
      expect(finishTurn(g, "bust").ended).toBe(true);
    });
  });

  it("partie d'avant l'ordre d'arrivée : l'égalité sur la cible reste partagée", () => {
    const g = game([[5000], [5000], [3000]], { target: 5000 });
    const table = standings(g);
    expect(table.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("met le vainqueur à l'abri : la riposte qui l'égale se classe derrière lui", () => {
    const g = sniper([[4000, 4800], [4000], [3000]], { target: 5000 });
    endTurn(g, 200); // Marie atteint la cible
    closeTurn(g);
    const { moves } = endTurn(g, 1000); // Julien tombe pile dessus
    expect(moves.some((m) => m.kind === "tie")).toBe(false);
    expect(scores(g)).toEqual([5000, 5000, 3000]);
    expect(standings(g).map((r) => [r.name, r.rank])).toEqual([
      ["Marie", 1],
      ["Julien", 2],
      ["Paul", 3],
    ]);
  });

  it("à score égal, le premier arrivé passe devant, quel que soit l'ordre à table", () => {
    const g = game([[3000], [4800], [4900]], { target: 5000 });
    g.currentPlayerIndex = 2;
    endTurn(g, 200); // Paul arrive le premier, à 5 100
    g.currentPlayerIndex = 1;
    endTurn(g, 300); // Julien le rejoint pendant la riposte
    expect(g.arrivals).toEqual([2, 1]);
    expect(standings(g).map((r) => [r.name, r.rank])).toEqual([
      ["Paul", 1],
      ["Julien", 2],
      ["Marie", 3],
    ]);
  });

  it("qui dépasse le premier arrivé pendant la riposte prend la première place", () => {
    const g = game([[3000], [4800], [4000]], { target: 5000 });
    g.currentPlayerIndex = 1;
    endTurn(g, 200); // Julien arrive à 5 000
    g.currentPlayerIndex = 2;
    endTurn(g, 1500); // Paul riposte à 5 500
    expect(standings(g).map((r) => [r.name, r.rank])).toEqual([
      ["Paul", 1],
      ["Julien", 2],
      ["Marie", 3],
    ]);
  });

  it("ne propose pas de viser un joueur arrivé à la cible", () => {
    const g = sniper([[5000], [4000], [4500]], { target: 5000 });
    g.currentPlayerIndex = 1;
    expect(tieTargets(g, 0).map((t) => t.name)).toEqual(["Paul"]);
  });

  it("ne déclare la partie finie qu'une fois le dernier tour joué", () => {
    const g = game([[4800], [3000], [2000]], { target: 5000 });
    endTurn(g, 200); // Marie atteint la cible
    expect(closeTurn(g)).toBe(false); // à Julien de riposter
    endTurn(g, 0);
    expect(closeTurn(g)).toBe(false); // la main passe à Paul, dernier à jouer

    // Paul n'a pas encore joué : une page rechargée ici ne doit pas filer au
    // podium.
    expect(g.ended).toBeUndefined();
    expect(g.toPlay).toEqual([2]);
    expect(g.currentPlayerIndex).toBe(2);

    endTurn(g, 0);
    expect(closeTurn(g)).toBe(true);
    expect(g.ended).toBe(true);
    // La main ne passe plus : l'écran de fin lit la partie telle qu'elle a fini.
    expect(g.currentPlayerIndex).toBe(2);
  });

  it("classe par score décroissant", () => {
    const g = game([[1200], [3000], [2000]]);
    expect(standings(g).map((r) => r.name)).toEqual(["Julien", "Paul", "Marie"]);
  });
});

/* ---------- Déroulé d'un tour ---------- */

// Les combinaisons d'un lancer, retrouvées par identifiant (cf. combosOf).
const pick = (g: G5000Game, dice: Face[], ...ids: string[]) => {
  const combos = combosOf(countsOf(dice), g.turn.openDigits, g.rules);
  return ids.map((id) => combos.find((c) => c.id === id)!);
};

describe("pendant le tour", () => {
  it("commence avec cinq dés, un pot vide et le premier lancer", () => {
    const g = game([[1000], [0]]);
    g.turn = { pot: 900, diceLeft: 2, openDigits: [3], rolls: 4, hotStreak: 2 };
    startTurn(g);
    expect(g.turn).toEqual({ pot: 0, diceLeft: 5, openDigits: [], rolls: 1, hotStreak: 0 });
  });

  it("ajoute au pot ce qui est gardé et retire les dés de la main", () => {
    const g = game([[1000]]);
    startTurn(g);
    const hot = keepDice(g, pick(g, [1, 5, 2, 3, 6], "s1x1", "s5x1"));
    expect(hot).toBe(false);
    expect(g.turn.pot).toBe(150);
    expect(g.turn.diceLeft).toBe(3);
    reroll(g);
    expect(g.turn.rolls).toBe(2);
  });

  it("active le chiffre d'un brelan (Combo), une seule fois", () => {
    const g = game([[1000]], { variants: ["combo"] });
    startTurn(g);
    keepDice(g, pick(g, [3, 3, 3, 2, 4], "g3x3"));
    expect(g.turn.openDigits).toEqual([3]);
    keepDice(g, pick(g, [3, 3, 3, 1, 1], "g3x3"));
    expect(g.turn.openDigits).toEqual([3]);
  });

  it("rend les cinq dés sur une main pleine et allonge la série", () => {
    const g = game([[1000]]);
    startTurn(g);
    const hot = keepDice(g, pick(g, [1, 2, 3, 4, 5], "run"));
    expect(hot).toBe(true);
    expect(g.turn.diceLeft).toBe(5);
    expect(g.turn.hotStreak).toBe(1);
    expect(g.turn.pot).toBe(1000);
  });
});

describe("fin du tour (finishTurn)", () => {
  it("banque le pot, consigne le tour et passe la main", () => {
    const g = game([[1000], [2000]]);
    startTurn(g);
    g.turn.pot = 600;
    const { moves, ended } = finishTurn(g, "bank");
    expect(scores(g)).toEqual([1600, 2000]);
    expect(moves[0]).toMatchObject({ kind: "bank", from: 1000, to: 1600 });
    expect(ended).toBe(false);
    expect(g.currentPlayerIndex).toBe(1);
    expect(g.stats?.biggestBank).toEqual({ player: 0, value: 600 });
    expect(g.turn.pot).toBe(0); // le tour suivant repart de zéro
  });

  it("perd le pot sur un bust, et le compte pour le record du pot perdu", () => {
    const g = game([[1000], [2000]]);
    startTurn(g);
    g.turn.pot = 1800;
    finishTurn(g, "bust");
    expect(scores(g)).toEqual([1000, 2000]);
    expect(g.players[0].blankTurns).toBe(1);
    expect(g.stats?.biggestBust).toEqual({ player: 0, value: 1800 });
  });

  it("compte aussi le pot perdu par dépassement (choix de Paul)", () => {
    const g = game([[4800], [2000]], { target: 5000, variants: ["exact"] });
    startTurn(g);
    g.turn.pot = 300;
    finishTurn(g, "bust");
    expect(scores(g)).toEqual([4800, 2000]);
    expect(g.stats?.biggestBust).toEqual({ player: 0, value: 300 });
  });

  it("mesure l'entrée en jeu AVANT de banquer", () => {
    const g = game([[], []], { openAt: 500 });
    startTurn(g);
    finishTurn(g, "bust"); // Marie rate son entrée
    startTurn(g);
    finishTurn(g, "bust"); // Julien aussi
    startTurn(g);
    g.turn.pot = 500;
    finishTurn(g, "bank"); // Marie entre : sa série de tours ratés s'arrête à 1
    expect(g.stats?.longestClosedRun).toEqual([1, 1]);
    expect(g.stats?.closedRun).toEqual([0, 1]);
  });

  it("retient la série de mains pleines du tour", () => {
    const g = game([[1000], [2000]]);
    startTurn(g);
    keepDice(g, pick(g, [1, 2, 3, 4, 5], "run"));
    keepDice(g, pick(g, [2, 3, 4, 5, 6], "run"));
    finishTurn(g, "bust");
    expect(g.stats?.longestHotStreak).toEqual({ player: 0, value: 2 });
  });

  it("annonce la fin de partie au dernier tour", () => {
    const g = game([[4800], [3000]], { target: 5000 });
    startTurn(g);
    g.turn.pot = 200;
    expect(finishTurn(g, "bank").ended).toBe(false); // Julien riposte
    startTurn(g);
    expect(finishTurn(g, "bust").ended).toBe(true);
    expect(g.ended).toBe(true);
  });
});

describe("à qui c'est le tour, en suivant la table (expectedPlayer)", () => {
  it("au départ, au premier de la table", () => {
    expect(expectedPlayer(game([[], [], []]))).toBe(0);
  });

  it("puis à celui qui a joué le moins de tours, dans l'ordre de départ", () => {
    const g = game([[], [], []]);
    finishTurn(g, "bust"); // Marie
    expect(expectedPlayer(g)).toBe(1);
    finishTurn(g, "bust"); // Julien
    finishTurn(g, "bust"); // Paul : tour de table complet
    expect(expectedPlayer(g)).toBe(0);
  });

  it("ne suit pas une main donnée à un autre : c'est toujours le tour du premier en retard", () => {
    const g = game([[], [], []]);
    choosePlayer(g, 2); // on donne la main à Paul…
    expect(g.currentPlayerIndex).toBe(2);
    expect(expectedPlayer(g)).toBe(0); // …mais c'était à Marie
    finishTurn(g, "bust"); // Paul joue quand même
    expect(expectedPlayer(g)).toBe(0); // toujours à Marie
  });

  it("pendant la riposte, seulement parmi ceux qui doivent encore jouer", () => {
    const g = game([[4800], [3000], [2000]], { target: 5000 });
    g.turn.pot = 200;
    finishTurn(g, "bank"); // Marie atteint la cible : Julien et Paul ripostent
    expect(expectedPlayer(g)).toBe(1);
    finishTurn(g, "bust");
    expect(expectedPlayer(g)).toBe(2);
  });

  it("rien à dire pour une partie finie ou sans statistiques", () => {
    const g = game([[], []]);
    delete g.stats;
    expect(expectedPlayer(g)).toBeNull();
    const done = game([[5000], [2000]]);
    done.ended = true;
    expect(expectedPlayer(done)).toBeNull();
  });
});

describe("choisir qui joue", () => {
  it("donne la main à n'importe qui en cours de partie, et l'ordre repart de lui", () => {
    const g = game([[1000], [2000], [3000]]);
    expect(choosePlayer(g, 2)).toBe(true);
    expect(g.currentPlayerIndex).toBe(2);
    startTurn(g);
    finishTurn(g, "bust");
    expect(g.currentPlayerIndex).toBe(0); // après Paul vient Marie
  });

  it("abandonne le tour entamé", () => {
    const g = game([[1000], [2000]]);
    startTurn(g);
    g.turn.pot = 400;
    g.turn.rolls = 2;
    expect(turnStarted(g)).toBe(true);
    choosePlayer(g, 1);
    expect(g.turn.pot).toBe(0);
    expect(turnStarted(g)).toBe(false);
  });

  it("ne compte pas comme entamé un tour où rien n'a été validé", () => {
    const g = game([[1000], [2000]]);
    startTurn(g); // calculette ouverte, aucun lancer validé
    expect(turnStarted(g)).toBe(false);
  });

  it("pendant la riposte, ne laisse jouer que ceux qui doivent encore jouer", () => {
    const g = game([[4800], [3000], [2000]], { target: 5000 });
    endTurn(g, 200); // Marie gagne : Julien et Paul ripostent
    closeTurn(g);
    expect(canPlay(g, 0)).toBe(false); // le vainqueur ne rejoue pas
    expect(choosePlayer(g, 0)).toBe(false);

    // Paul riposte avant Julien : la partie attend quand même Julien.
    expect(choosePlayer(g, 2)).toBe(true);
    endTurn(g, 0);
    expect(closeTurn(g)).toBe(false);
    expect(g.currentPlayerIndex).toBe(1);
    expect(canPlay(g, 2)).toBe(false); // Paul a riposté
    endTurn(g, 0);
    expect(closeTurn(g)).toBe(true);
  });

  it("refuse tout changement une fois la partie finie", () => {
    const g = game([[5000], [3000]]);
    g.ended = true;
    expect(choosePlayer(g, 1)).toBe(false);
  });
});
