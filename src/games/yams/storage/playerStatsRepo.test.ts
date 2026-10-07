import { beforeEach, describe, expect, it } from "vitest";
import {
  dedupePlayerStats,
  getPlayerStats,
  recordGameResult,
  removePlayerStats,
  renamePlayerStats,
  type PlayerStat,
} from "./playerStatsRepo";
import { STORAGE_KEYS } from "../../../core/storage/keys";

beforeEach(() => localStorage.clear());

const write = (stats: Record<string, unknown>): void =>
  localStorage.setItem(STORAGE_KEYS.playerStats, JSON.stringify(stats));

const stat = (over: Partial<PlayerStat> = {}): PlayerStat => ({
  classiqueGames: 0,
  classiquePoints: 0,
  classiqueBest: 0,
  ...over,
});

describe("getPlayerStats", () => {
  it("relit le format courant tel quel", () => {
    write({ Jean: stat({ classiqueGames: 2, classiquePoints: 400, classiqueBest: 230 }) });
    expect(getPlayerStats().Jean).toEqual(
      stat({ classiqueGames: 2, classiquePoints: 400, classiqueBest: 230 }),
    );
  });

  it("accepte l'ancien format « nom → nombre de parties »", () => {
    write({ Jean: 4 });
    expect(getPlayerStats().Jean).toEqual(stat());
  });

  it("complète un format intermédiaire sans classiqueBest", () => {
    write({ Jean: { classiqueGames: 1, classiquePoints: 180 } });
    expect(getPlayerStats().Jean).toEqual(
      stat({ classiqueGames: 1, classiquePoints: 180 }),
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
      stat({ classiqueGames: 2, classiquePoints: 440, classiqueBest: 240 }),
    );
  });

  it("compte la partie mais pas la moyenne quand il n'y a pas de Classique", () => {
    recordGameResult([{ name: "Jean", classiqueScore: null }]);
    expect(getPlayerStats().Jean).toEqual(stat());
  });

  it("garde le meilleur score classique, même si la partie suivante est moins bonne", () => {
    recordGameResult([{ name: "Jean", classiqueScore: 250 }]);
    recordGameResult([{ name: "Jean", classiqueScore: 90 }]);
    expect(getPlayerStats().Jean.classiqueBest).toBe(250);
  });

  it("n'ouvre pas une seconde entrée quand la casse diffère", () => {
    write({ Jean: stat({ classiqueGames: 3 }) });
    recordGameResult([{ name: "jean", classiqueScore: 100 }]);
    expect(Object.keys(getPlayerStats())).toEqual(["Jean"]);
    expect(getPlayerStats().Jean.classiqueGames).toBe(4);
  });
});

describe("removePlayerStats", () => {
  it("supprime l'entrée du joueur", () => {
    write({ Jean: stat(), Marie: stat() });
    removePlayerStats("Jean");
    expect(Object.keys(getPlayerStats())).toEqual(["Marie"]);
  });

  it("emporte toutes les variantes de casse d'anciennes données", () => {
    write({ Jean: stat(), jean: stat() });
    removePlayerStats("JEAN");
    expect(getPlayerStats()).toEqual({});
  });

  it("ne touche à rien quand le nom est inconnu", () => {
    write({ Jean: stat({ classiqueGames: 3 }) });
    removePlayerStats("Marie");
    expect(getPlayerStats().Jean.classiqueGames).toBe(3);
  });
});

describe("renamePlayerStats", () => {
  it("déplace les statistiques sous le nouveau nom", () => {
    write({ Jean: stat({ classiqueBest: 210 }) });
    renamePlayerStats("Jean", "Jeanne");
    expect(getPlayerStats()).toEqual({ Jeanne: stat({ classiqueBest: 210 }) });
  });

  it("fusionne quand le nom cible existe déjà", () => {
    write({
      Jean: stat({ classiqueGames: 2, classiquePoints: 400, classiqueBest: 210 }),
      Marie: stat({ classiqueGames: 1, classiquePoints: 150, classiqueBest: 150 }),
    });
    renamePlayerStats("Jean", "Marie");
    expect(getPlayerStats()).toEqual({
      Marie: stat({ classiqueGames: 3, classiquePoints: 550, classiqueBest: 210 }),
    });
  });

  it("corrige la casse sans perdre les statistiques", () => {
    write({ jean: stat({ classiqueBest: 210 }) });
    renamePlayerStats("jean", "Jean");
    expect(getPlayerStats()).toEqual({ Jean: stat({ classiqueBest: 210 }) });
  });

  it("ne laisse pas d'entrée orpheline quand la casse diffère", () => {
    write({ Jean: stat({ classiqueGames: 3 }), jean: stat({ classiqueGames: 2 }) });
    renamePlayerStats("Jean", "Jeanne");
    expect(Object.keys(getPlayerStats())).toEqual(["Jeanne"]);
    expect(getPlayerStats().Jeanne.classiqueGames).toBe(5);
  });

  it("ne fait rien si le joueur n'a pas de statistiques", () => {
    renamePlayerStats("Jean", "Jeanne");
    expect(getPlayerStats()).toEqual({});
  });
});

describe("dedupePlayerStats", () => {
  it("fusionne les clés qui ne diffèrent que par la casse ou les espaces", () => {
    const merged = dedupePlayerStats({
      Jean: stat({ classiqueGames: 2, classiquePoints: 400, classiqueBest: 210 }),
      jean: stat({ classiqueGames: 1, classiquePoints: 150, classiqueBest: 240 }),
      "Jean ": stat(),
    });
    expect(merged).toEqual({
      Jean: stat({ classiqueGames: 3, classiquePoints: 550, classiqueBest: 240 }),
    });
  });

  it("garde la première forme rencontrée comme nom d'affichage", () => {
    expect(Object.keys(dedupePlayerStats({ jean: stat(), Jean: stat() }))).toEqual(["jean"]);
  });

  it("laisse intactes des entrées réellement distinctes", () => {
    const stats = { Jean: stat(), Marie: stat() };
    expect(dedupePlayerStats(stats)).toEqual(stats);
  });
});
