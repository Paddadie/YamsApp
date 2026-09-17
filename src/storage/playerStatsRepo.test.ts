import { beforeEach, describe, expect, it } from "vitest";
import {
  dedupePlayerStats,
  getPlayerStats,
  recordGameResult,
  removePlayerStats,
  renamePlayerStats,
  type PlayerStat,
} from "./playerStatsRepo";
import { STORAGE_KEYS } from "./keys";

beforeEach(() => localStorage.clear());

const write = (stats: Record<string, unknown>): void =>
  localStorage.setItem(STORAGE_KEYS.playerStats, JSON.stringify(stats));

const stat = (over: Partial<PlayerStat> = {}): PlayerStat => ({
  games: 0,
  classiqueGames: 0,
  classiquePoints: 0,
  classiqueBest: 0,
  ...over,
});

describe("getPlayerStats", () => {
  it("relit le format courant tel quel", () => {
    write({ Jean: stat({ games: 3, classiqueGames: 2, classiquePoints: 400, classiqueBest: 230 }) });
    expect(getPlayerStats().Jean).toEqual(
      stat({ games: 3, classiqueGames: 2, classiquePoints: 400, classiqueBest: 230 }),
    );
  });

  it("accepte l'ancien format « nom → nombre de parties »", () => {
    write({ Jean: 4 });
    expect(getPlayerStats().Jean).toEqual(stat({ games: 4 }));
  });

  it("complète un format intermédiaire sans classiqueBest", () => {
    write({ Jean: { games: 2, classiqueGames: 1, classiquePoints: 180 } });
    expect(getPlayerStats().Jean).toEqual(
      stat({ games: 2, classiqueGames: 1, classiquePoints: 180 }),
    );
  });

  it("ignore une entrée inexploitable plutôt que de tout perdre", () => {
    write({ Jean: 3, Cassé: null, Marie: "?" });
    expect(Object.keys(getPlayerStats())).toEqual(["Jean"]);
  });

  it("renvoie un objet vide quand rien n'est stocké", () => {
    expect(getPlayerStats()).toEqual({});
  });
});

describe("recordGameResult", () => {
  it("compte une partie et cumule les points classiques", () => {
    recordGameResult([{ name: "Jean", classiqueScore: 200 }]);
    recordGameResult([{ name: "Jean", classiqueScore: 240 }]);
    expect(getPlayerStats().Jean).toEqual(
      stat({ games: 2, classiqueGames: 2, classiquePoints: 440, classiqueBest: 240 }),
    );
  });

  it("compte la partie mais pas la moyenne quand il n'y a pas de Classique", () => {
    recordGameResult([{ name: "Jean", classiqueScore: null }]);
    expect(getPlayerStats().Jean).toEqual(stat({ games: 1 }));
  });

  it("garde le meilleur score classique, même si la partie suivante est moins bonne", () => {
    recordGameResult([{ name: "Jean", classiqueScore: 250 }]);
    recordGameResult([{ name: "Jean", classiqueScore: 90 }]);
    expect(getPlayerStats().Jean.classiqueBest).toBe(250);
  });

  it("n'ouvre pas une seconde entrée quand la casse diffère", () => {
    write({ Jean: stat({ games: 3 }) });
    recordGameResult([{ name: "jean", classiqueScore: 100 }]);
    expect(Object.keys(getPlayerStats())).toEqual(["Jean"]);
    expect(getPlayerStats().Jean.games).toBe(4);
  });
});

describe("removePlayerStats", () => {
  it("supprime l'entrée du joueur", () => {
    write({ Jean: stat({ games: 3 }), Marie: stat({ games: 1 }) });
    removePlayerStats("Jean");
    expect(Object.keys(getPlayerStats())).toEqual(["Marie"]);
  });

  it("emporte toutes les variantes de casse d'anciennes données", () => {
    write({ Jean: stat({ games: 3 }), jean: stat({ games: 2 }) });
    removePlayerStats("JEAN");
    expect(getPlayerStats()).toEqual({});
  });

  it("ne touche à rien quand le nom est inconnu", () => {
    write({ Jean: stat({ games: 3 }) });
    removePlayerStats("Marie");
    expect(getPlayerStats().Jean.games).toBe(3);
  });
});

describe("renamePlayerStats", () => {
  it("déplace les statistiques sous le nouveau nom", () => {
    write({ Jean: stat({ games: 3, classiqueBest: 210 }) });
    renamePlayerStats("Jean", "Jeanne");
    expect(getPlayerStats()).toEqual({ Jeanne: stat({ games: 3, classiqueBest: 210 }) });
  });

  it("fusionne quand le nom cible existe déjà", () => {
    write({
      Jean: stat({ games: 3, classiqueGames: 2, classiquePoints: 400, classiqueBest: 210 }),
      Marie: stat({ games: 1, classiqueGames: 1, classiquePoints: 150, classiqueBest: 150 }),
    });
    renamePlayerStats("Jean", "Marie");
    expect(getPlayerStats()).toEqual({
      Marie: stat({ games: 4, classiqueGames: 3, classiquePoints: 550, classiqueBest: 210 }),
    });
  });

  it("corrige la casse sans perdre les statistiques", () => {
    write({ jean: stat({ games: 3, classiqueBest: 210 }) });
    renamePlayerStats("jean", "Jean");
    expect(getPlayerStats()).toEqual({ Jean: stat({ games: 3, classiqueBest: 210 }) });
  });

  it("ne laisse pas d'entrée orpheline quand la casse diffère", () => {
    write({ Jean: stat({ games: 3 }), jean: stat({ games: 2 }) });
    renamePlayerStats("Jean", "Jeanne");
    expect(Object.keys(getPlayerStats())).toEqual(["Jeanne"]);
    expect(getPlayerStats().Jeanne.games).toBe(5);
  });

  it("ne fait rien si le joueur n'a pas de statistiques", () => {
    renamePlayerStats("Jean", "Jeanne");
    expect(getPlayerStats()).toEqual({});
  });
});

describe("dedupePlayerStats", () => {
  it("fusionne les clés qui ne diffèrent que par la casse ou les espaces", () => {
    const merged = dedupePlayerStats({
      Jean: stat({ games: 3, classiqueGames: 2, classiquePoints: 400, classiqueBest: 210 }),
      jean: stat({ games: 2, classiqueGames: 1, classiquePoints: 150, classiqueBest: 240 }),
      "Jean ": stat({ games: 1 }),
    });
    expect(merged).toEqual({
      Jean: stat({ games: 6, classiqueGames: 3, classiquePoints: 550, classiqueBest: 240 }),
    });
  });

  it("garde la première forme rencontrée comme nom d'affichage", () => {
    expect(Object.keys(dedupePlayerStats({ jean: stat(), Jean: stat() }))).toEqual(["jean"]);
  });

  it("laisse intactes des entrées réellement distinctes", () => {
    const stats = { Jean: stat({ games: 1 }), Marie: stat({ games: 2 }) };
    expect(dedupePlayerStats(stats)).toEqual(stats);
  });
});
