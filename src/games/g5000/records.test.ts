import { describe, expect, it } from "vitest";
import {
  clearRecord,
  clearWins,
  emptyStats,
  mergeRecords,
  mostWins,
  normalizeRecords,
  noteTurn,
  recordNames,
  recordsAt,
  recordsHeldBy,
  recordTargets,
  removeFromRecords,
  renameInRecords,
  type G5000Records,
  type RecordTable,
  type TurnReport,
} from "./records";
import { createGame } from "./engine";
import { DEFAULT_RULES } from "./rules";
import type { G5000Game } from "./types";

const emptyRecords = (): G5000Records => ({ targets: {}, wins: {} });

// Records d'un seul objectif, celui des parties par défaut (5 000).
const at5000 = (table: RecordTable, wins: Record<string, number> = {}): G5000Records => ({
  targets: { 5000: table },
  wins,
});

const DATE = "19/09/2026";

function game(names = ["Marie", "Julien", "Paul"], target = DEFAULT_RULES.target): G5000Game {
  return createGame(names, names.map(() => "#FCC1C7"), { ...DEFAULT_RULES, target });
}

const turn = (over: Partial<TurnReport>): TurnReport => ({
  player: 0,
  wasOpen: true,
  scored: true,
  banked: 0,
  lost: 0,
  hotStreak: 0,
  moves: [],
  ...over,
});

describe("noteTurn — ce que la partie retient", () => {
  it("compte les tours de chaque joueur", () => {
    const stats = emptyStats(2);
    noteTurn(stats, turn({ player: 0, banked: 300 }));
    noteTurn(stats, turn({ player: 1, scored: false }));
    noteTurn(stats, turn({ player: 0, banked: 200 }));
    expect(stats.turns).toEqual([2, 1]);
  });

  it("garde le plus gros tour banqué", () => {
    const stats = emptyStats(2);
    noteTurn(stats, turn({ player: 0, banked: 800 }));
    noteTurn(stats, turn({ player: 1, banked: 1200 }));
    noteTurn(stats, turn({ player: 0, banked: 1200 })); // égalité : le premier garde
    expect(stats.biggestBank).toEqual({ player: 1, value: 1200 });
  });

  it("garde le plus gros pot perdu, et seulement sur un tour raté", () => {
    const stats = emptyStats(2);
    noteTurn(stats, turn({ player: 0, scored: false, lost: 1500 }));
    noteTurn(stats, turn({ player: 1, scored: true, banked: 400, lost: 9999 }));
    expect(stats.biggestBust).toEqual({ player: 0, value: 1500 });
  });

  it("garde la plus longue série de mains pleines", () => {
    const stats = emptyStats(2);
    noteTurn(stats, turn({ player: 1, hotStreak: 2, banked: 2000 }));
    noteTurn(stats, turn({ player: 0, hotStreak: 1, scored: false, lost: 1000 }));
    expect(stats.longestHotStreak).toEqual({ player: 1, value: 2 });
  });

  it("mesure les tours ratés d'affilée avant d'entrer en jeu", () => {
    const stats = emptyStats(1);
    for (let i = 0; i < 4; i++) noteTurn(stats, turn({ wasOpen: false, scored: false }));
    noteTurn(stats, turn({ wasOpen: false, scored: true, banked: 500 }));
    expect(stats.longestClosedRun).toEqual([4]);
    expect(stats.closedRun).toEqual([0]);
  });

  it("ne compte pas les tours blancs d'un joueur déjà entré en jeu", () => {
    const stats = emptyStats(1);
    noteTurn(stats, turn({ wasOpen: true, scored: false }));
    expect(stats.longestClosedRun).toEqual([0]);
  });

  it("recommence le compte pour un joueur retombé à zéro", () => {
    const stats = emptyStats(2);
    noteTurn(stats, turn({ player: 1, wasOpen: false, scored: false }));
    noteTurn(stats, turn({ player: 1, wasOpen: false, scored: false }));
    // Julien entre en jeu, puis Marie le fait retomber à zéro.
    noteTurn(stats, turn({ player: 1, wasOpen: false, scored: true, banked: 500 }));
    noteTurn(stats, turn({
      player: 0,
      banked: 500,
      moves: [{ kind: "tie", player: 1, from: 500, to: 0, by: 0 }],
    }));
    noteTurn(stats, turn({ player: 1, wasOpen: false, scored: false }));
    expect(stats.closedRun[1]).toBe(1);
    expect(stats.longestClosedRun[1]).toBe(2);
  });

  it("garde la plus grosse chute, avec son auteur", () => {
    const stats = emptyStats(3);
    noteTurn(stats, turn({
      player: 0,
      banked: 450,
      moves: [
        { kind: "bank", player: 0, from: 1850, to: 2300 },
        { kind: "tie", player: 1, from: 2300, to: 1450, by: 0 },
        { kind: "tie", player: 2, from: 1450, to: 900, by: 1 },
      ],
    }));
    expect(stats.biggestFall).toEqual({ player: 1, value: 850, by: 0 });
  });

  it("une chute par pénalité n'a pas d'auteur", () => {
    const stats = emptyStats(1);
    noteTurn(stats, turn({
      scored: false,
      moves: [{ kind: "penalty", player: 0, from: 2800, to: 1500 }],
    }));
    expect(stats.biggestFall).toEqual({ player: 0, value: 1300, by: undefined });
  });
});

describe("mergeRecords — la fin de partie", () => {
  function finished(target = DEFAULT_RULES.target): G5000Game {
    const g = game(undefined, target);
    g.stats!.turns = [12, 12, 11];
    g.stats!.longestClosedRun = [0, 3, 1];
    g.stats!.biggestBank = { player: 1, value: 2400 };
    g.stats!.biggestBust = { player: 2, value: 1800 };
    g.stats!.longestHotStreak = { player: 0, value: 2 };
    g.stats!.biggestFall = { player: 2, value: 850, by: 0 };
    return g;
  }

  it("établit tous les records sur une table vierge", () => {
    const { records, broken } = mergeRecords(emptyRecords(), finished(), [0], DATE);
    const table = recordsAt(records, 5000);
    expect(table.fastestWin).toEqual({ name: "Marie", value: 12, date: DATE });
    expect(table.biggestBank).toEqual({ name: "Julien", value: 2400, date: DATE });
    expect(table.biggestBust).toEqual({ name: "Paul", value: 1800, date: DATE });
    expect(table.biggestFall).toEqual({ name: "Paul", value: 850, date: DATE, by: "Marie" });
    expect(table.slowestOpening).toEqual({ name: "Julien", value: 3, date: DATE });
    expect(table.longestGame?.value).toBe(12);
    expect(table.longestGame?.names).toEqual(["Marie", "Julien", "Paul"]);
    expect(records.wins).toEqual({ Marie: 1 });
    expect(broken).toContain("mostWins");
    expect(broken).toHaveLength(8);
  });

  it("un record doit être battu, pas égalé", () => {
    const first = mergeRecords(emptyRecords(), finished(), [0], "01/01/2026").records;
    const { records, broken } = mergeRecords(first, finished(), [0], DATE);
    expect(recordsAt(records, 5000).biggestBank?.date).toBe("01/01/2026");
    expect(broken).not.toContain("biggestBank");
    expect(broken).not.toContain("fastestWin");
  });

  it("la victoire la plus rapide est le seul record qui se bat à la baisse", () => {
    const first = mergeRecords(emptyRecords(), finished(), [0], "01/01/2026").records;
    const quick = finished();
    quick.stats!.turns = [9, 9, 9];
    const { records, broken } = mergeRecords(first, quick, [1], DATE);
    expect(recordsAt(records, 5000).fastestWin).toEqual({ name: "Julien", value: 9, date: DATE });
    expect(broken).toContain("fastestWin");
  });

  it("une victoire partagée compte pour chacun", () => {
    const { records } = mergeRecords(emptyRecords(), finished(), [0, 1], DATE);
    expect(records.wins).toEqual({ Marie: 1, Julien: 1 });
  });

  it("ne modifie pas les records reçus", () => {
    const before = emptyRecords();
    mergeRecords(before, finished(), [0], DATE);
    expect(before).toEqual(emptyRecords());
  });

  it("ne signale le nombre de victoires que quand le vainqueur prend la tête", () => {
    const records: G5000Records = { targets: {}, wins: { Paul: 5, Marie: 1 } };
    expect(mergeRecords(records, finished(), [0], DATE).broken).not.toContain("mostWins");
  });

  it("tolère une partie commencée avant les records", () => {
    const g = game();
    delete g.stats;
    const { records, broken } = mergeRecords(emptyRecords(), g, [0], DATE);
    expect(records.wins).toEqual({ Marie: 1 });
    expect(broken).toEqual(["mostWins"]);
  });

  describe("un objectif, ses records", () => {
    it("une partie à 3 000 ne se mesure qu'aux parties à 3 000", () => {
      const at10000 = mergeRecords(emptyRecords(), finished(10000), [0], "01/01/2026").records;
      const short = finished(3000);
      short.stats!.turns = [6, 6, 6];
      short.stats!.biggestBank = { player: 1, value: 300 };
      const { records, broken } = mergeRecords(at10000, short, [0], DATE);

      // À 3 000, tout est à établir : la table était vierge.
      expect(broken).toContain("fastestWin");
      expect(broken).toContain("biggestBank");
      expect(recordsAt(records, 3000).fastestWin?.value).toBe(6);
      // À 10 000, rien n'a bougé.
      expect(recordsAt(records, 10000).fastestWin).toEqual({
        name: "Marie",
        value: 12,
        date: "01/01/2026",
      });
      expect(recordsAt(records, 10000).biggestBank?.value).toBe(2400);
    });

    it("les victoires, elles, se cumulent d'un objectif à l'autre", () => {
      const first = mergeRecords(emptyRecords(), finished(10000), [0], DATE).records;
      const { records } = mergeRecords(first, finished(3000), [0], DATE);
      expect(records.wins).toEqual({ Marie: 2 });
    });

    it("liste les objectifs qui ont des records, du plus petit au plus grand", () => {
      const first = mergeRecords(emptyRecords(), finished(10000), [0], DATE).records;
      const { records } = mergeRecords(first, finished(3000), [0], DATE);
      expect(recordTargets(records)).toEqual([3000, 10000]);
    });
  });
});

describe("mostWins", () => {
  it("désigne le joueur le plus titré, l'ordre alphabétique tranchant les égalités", () => {
    expect(mostWins({ targets: {}, wins: { Paul: 3, Marie: 3, Zoé: 1 } })).toEqual({
      name: "Marie",
      value: 3,
    });
    expect(mostWins(emptyRecords())).toBeNull();
  });
});

describe("normalizeRecords", () => {
  it("écarte ce qui n'a pas la forme d'un record, sans perdre le reste", () => {
    const records = normalizeRecords({
      targets: {
        5000: {
          biggestBank: { name: "Marie", value: 2400, date: DATE },
          biggestBust: { name: 42 },
        },
      },
      wins: { Marie: 2, Julien: "trois" },
    });
    expect(recordsAt(records, 5000).biggestBank?.value).toBe(2400);
    expect(recordsAt(records, 5000).biggestBust).toBeUndefined();
    expect(records.wins).toEqual({ Marie: 2 });
  });

  it("donne une table vide sur un appareil neuf", () => {
    expect(normalizeRecords(null)).toEqual(emptyRecords());
  });

  it("range les records d'avant la séparation par objectif sous l'objectif par défaut", () => {
    const records = normalizeRecords({
      biggestBank: { name: "Marie", value: 2400, date: DATE },
      fastestWin: { name: "Paul", value: 11, date: DATE },
      wins: { Marie: 2 },
    });
    expect(records.targets).toEqual({
      5000: {
        biggestBank: { name: "Marie", value: 2400, date: DATE },
        fastestWin: { name: "Paul", value: 11, date: DATE },
      },
    });
    expect(records.wins).toEqual({ Marie: 2 });
  });
});

describe("administration des joueurs", () => {
  const sample = (): G5000Records => ({
    targets: {
      5000: {
        biggestBank: { name: "Marie", value: 2400, date: DATE },
        biggestFall: { name: "Paul", value: 850, date: DATE, by: "Marie" },
        longestGame: { name: "Marie, Paul", names: ["Marie", "Paul"], value: 14, date: DATE },
      },
      3000: { fastestWin: { name: "Marie", value: 6, date: DATE } },
    },
    wins: { Marie: 2, Paul: 1 },
  });

  it("un renommage fait suivre les records, partout et à tout objectif", () => {
    const r = renameInRecords(sample(), "marie", "Marion");
    const t = recordsAt(r, 5000);
    expect(t.biggestBank?.name).toBe("Marion");
    expect(t.biggestFall?.by).toBe("Marion");
    expect(t.longestGame?.names).toEqual(["Marion", "Paul"]);
    expect(t.longestGame?.name).toBe("Marion, Paul");
    expect(recordsAt(r, 3000).fastestWin?.name).toBe("Marion");
    expect(r.wins).toEqual({ Marion: 2, Paul: 1 });
  });

  it("un renommage vers un nom existant fusionne les victoires", () => {
    expect(renameInRecords(sample(), "Paul", "Marie").wins).toEqual({ Marie: 3 });
  });

  it("une suppression emporte les records du joueur, à tout objectif", () => {
    const r = removeFromRecords(sample(), "Marie");
    expect(recordsAt(r, 5000).biggestBank).toBeUndefined();
    expect(r.targets[3000]).toBeUndefined(); // table vidée : retirée
    expect(r.wins).toEqual({ Paul: 1 });
  });

  it("mais laisse à la victime une chute qu'il a seulement provoquée", () => {
    const r = removeFromRecords(sample(), "Marie");
    expect(recordsAt(r, 5000).biggestFall).toEqual({ name: "Paul", value: 850, date: DATE });
  });

  it("et retire le joueur de la tablée de la partie la plus longue", () => {
    const r = removeFromRecords(sample(), "Marie");
    expect(recordsAt(r, 5000).longestGame?.names).toEqual(["Paul"]);
  });

  it("compte et nomme les records de tous les objectifs", () => {
    expect(recordsHeldBy(sample(), "Marie")).toBe(3);
    expect(new Set(recordNames(sample()))).toEqual(new Set(["Marie", "Paul"]));
  });
});

describe("effacement à la main", () => {
  const sample = (): G5000Records =>
    at5000(
      {
        biggestBank: { name: "Marie", value: 2400, date: DATE },
        biggestBust: { name: "Paul", value: 1800, date: DATE },
      },
      { Marie: 2, Paul: 1 },
    );

  it("efface un record sans toucher aux autres", () => {
    const r = clearRecord(sample(), 5000, "biggestBank");
    expect(recordsAt(r, 5000).biggestBank).toBeUndefined();
    expect(recordsAt(r, 5000).biggestBust?.name).toBe("Paul");
    expect(r.wins).toEqual({ Marie: 2, Paul: 1 });
  });

  it("n'efface que l'objectif demandé", () => {
    const r = clearRecord(
      { ...sample(), targets: { ...sample().targets, 3000: { biggestBank: { name: "Zoé", value: 900, date: DATE } } } },
      5000,
      "biggestBank",
    );
    expect(recordsAt(r, 3000).biggestBank?.name).toBe("Zoé");
  });

  it("un record effacé peut être rétabli par la partie suivante", () => {
    const g = game();
    g.stats!.biggestBank = { player: 1, value: 300 };
    const { records, broken } = mergeRecords(clearRecord(sample(), 5000, "biggestBank"), g, [0], DATE);
    expect(recordsAt(records, 5000).biggestBank).toEqual({ name: "Julien", value: 300, date: DATE });
    expect(broken).toContain("biggestBank");
  });

  it("remet à zéro les victoires d'un joueur, casse ignorée", () => {
    expect(clearWins(sample(), "marie").wins).toEqual({ Paul: 1 });
  });

  it("ne modifie pas les records reçus", () => {
    const before = sample();
    clearRecord(before, 5000, "biggestBank");
    clearWins(before, "Marie");
    expect(before).toEqual(sample());
  });
});
