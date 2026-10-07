// `downloadBackup` n'est pas couvert ici : c'est de la plomberie DOM (Blob,
// URL.createObjectURL, <a download>), rien à vérifier côté logique.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportAllData,
  importAllData,
  parseBackup,
  readBackupFile,
  summarize,
  type BackupData,
} from "./backup";
import { STORAGE_KEYS } from "./keys";
import { DEFAULT_RULES } from "../../games/yams/scoring";
import { createPlayers } from "../../games/yams/players";
import type { SavedGame } from "../../games/yams/types";

beforeEach(() => localStorage.clear());

// Le fichier est-il reconnu comme une sauvegarde ? (cf. parseBackup)
const isBackup = (value: unknown): boolean => parseBackup(value) !== null;

const put = (key: string, value: unknown): void =>
  localStorage.setItem(key, JSON.stringify(value));
const read = <T>(key: string): T | null => {
  const raw = localStorage.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as T);
};

// Construite par le constructeur de l'appli : une partie ne porte que ses
// variantes sélectionnées, pas les quatre.
const players = createPlayers(["Jean"], ["Classique"], ["#FCC1C7"]);
players[0].scores.Classique!["1"] = 3;

const savedGame: SavedGame = {
  players,
  selectedVariants: ["Classique"],
  currentPlayerIndex: 0,
  rules: DEFAULT_RULES,
};

function fillStorage(): void {
  put(STORAGE_KEYS.knownNames, ["Alice", "Jean"]);
  put(STORAGE_KEYS.playerGames, { Jean: 3, Alice: 1 });
  put(STORAGE_KEYS.lastRoster, ["Jean", "Alice"]);
  put(STORAGE_KEYS.playerStats, {
    Jean: { classiqueGames: 2, classiquePoints: 400, classiqueBest: 210 },
  });
  put(STORAGE_KEYS.rules, DEFAULT_RULES);
  put(STORAGE_KEYS.prefs, { bonusHint: false });
  put(STORAGE_KEYS.bestScores, [{ name: "Jean", score: 250, date: "01/02/2026" }]);
  put(STORAGE_KEYS.worstScores, [{ name: "Alice", score: 60, date: "01/02/2026" }]);
  put(STORAGE_KEYS.savedGame, savedGame);
}

// Remplace une donnée dans une sauvegarde sans toucher au reste.
const withData = (backup: BackupData, key: string, value: unknown): BackupData => ({
  ...backup,
  data: { ...backup.data, [key]: value },
});

describe("exportAllData", () => {
  it("rassemble toutes les données de l'appareil", () => {
    fillStorage();
    const { data } = exportAllData();
    expect(data[STORAGE_KEYS.knownNames]).toEqual(["Alice", "Jean"]);
    expect(data[STORAGE_KEYS.playerGames]).toEqual({ Jean: 3, Alice: 1 });
    expect(data[STORAGE_KEYS.rules]).toEqual(DEFAULT_RULES);
    expect(data[STORAGE_KEYS.prefs]).toEqual({ bonusHint: false });
    expect(data[STORAGE_KEYS.bestScores]).toHaveLength(1);
    expect(data[STORAGE_KEYS.worstScores]).toHaveLength(1);
    expect(data[STORAGE_KEYS.savedGame]).toEqual(savedGame);
  });

  it("exporte un appareil vierge sans planter", () => {
    expect(exportAllData().data).toEqual({});
  });

  it("horodate l'export", () => {
    expect(Date.parse(exportAllData().exportedAt)).not.toBeNaN();
  });

  // Le marqueur de schéma est volontairement absent : à l'import on le retire
  // pour forcer une re-migration.
  it("n'embarque pas le marqueur de version de schéma", () => {
    localStorage.setItem(STORAGE_KEYS.schemaVersion, "6");
    expect(exportAllData().data).not.toHaveProperty(STORAGE_KEYS.schemaVersion);
  });
});

describe("reconnaître une sauvegarde (parseBackup)", () => {
  it("accepte une sauvegarde produite par l'appli", () => {
    fillStorage();
    expect(isBackup(exportAllData())).toBe(true);
  });

  it("refuse ce qui n'est pas une sauvegarde", () => {
    expect(isBackup(null)).toBe(false);
    expect(isBackup("sauvegarde")).toBe(false);
    expect(isBackup({})).toBe(false);
    expect(isBackup({ hello: "world" })).toBe(false);
  });

  it("refuse une sauvegarde dont la partie en cours est cassée", () => {
    fillStorage();
    const broken = withData(exportAllData(), STORAGE_KEYS.savedGame, {
      players: [],
    });
    expect(isBackup(broken)).toBe(false);
  });

  it("accepte une sauvegarde sans partie en cours", () => {
    fillStorage();
    expect(
      isBackup(withData(exportAllData(), STORAGE_KEYS.savedGame, null)),
    ).toBe(true);
  });
});

describe("compatibilité avec les fichiers d'avant la v5", () => {
  // Format nommé champ par champ, tel que l'appli l'écrivait jusqu'à la v4.
  const legacy = {
    version: 4,
    exportedAt: "2026-02-01T10:00:00.000Z",
    knownNames: ["Alice", "Jean"],
    playerStats: { Jean: { games: 3, classiqueGames: 2 } },
    rules: DEFAULT_RULES,
    prefs: { bonusHint: false },
    bestScores: [{ name: "Jean", score: 250, date: "01/02/2026" }],
    worstScores: [],
    savedGame,
  };

  it("relit un fichier au format nommé", () => {
    expect(isBackup(legacy)).toBe(true);
  });

  it("l'installe sous les bonnes clés", () => {
    const result = readBackupFileSync(legacy);
    importAllData(result);
    expect(read<string[]>(STORAGE_KEYS.knownNames)).toEqual(["Alice", "Jean"]);
    expect(read(STORAGE_KEYS.rules)).toEqual(DEFAULT_RULES);
    expect(read(STORAGE_KEYS.savedGame)).toEqual(savedGame);
  });

  // Ce compteur n'existait pas dans l'ancien format : il est reconstruit par la
  // migration v6, qui repasse justement après tout import.
  it("laisse le compteur commun absent, la migration le reconstruira", () => {
    importAllData(readBackupFileSync(legacy));
    expect(localStorage.getItem(STORAGE_KEYS.playerGames)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.schemaVersion)).toBeNull();
  });

  it("refuse un ancien fichier dont la partie en cours est cassée", () => {
    expect(isBackup({ ...legacy, savedGame: { players: [] } })).toBe(false);
  });
});

// Petit raccourci : parseBackup passe par readBackupFile dans l'appli, on veut
// juste la même conversion sans passer par un File.
function readBackupFileSync(raw: unknown): BackupData {
  const parsed = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  const fields: Record<string, string> = {
    knownNames: STORAGE_KEYS.knownNames,
    playerStats: STORAGE_KEYS.playerStats,
    rules: STORAGE_KEYS.rules,
    prefs: STORAGE_KEYS.prefs,
    bestScores: STORAGE_KEYS.bestScores,
    worstScores: STORAGE_KEYS.worstScores,
    savedGame: STORAGE_KEYS.savedGame,
  };
  for (const [field, key] of Object.entries(fields)) {
    if (parsed[field] != null) data[key] = parsed[field];
  }
  return { version: 4, exportedAt: String(parsed.exportedAt ?? ""), data };
}

describe("importAllData", () => {
  it("restitue à l'identique ce qui a été exporté", () => {
    fillStorage();
    const backup = exportAllData();
    localStorage.clear();
    importAllData(backup);
    expect(exportAllData().data).toEqual(backup.data);
  });

  it("remplace les données de l'appareil au lieu de les compléter", () => {
    fillStorage();
    const backup = exportAllData();
    importAllData(
      withData(withData(backup, STORAGE_KEYS.knownNames, ["Marie"]),
      STORAGE_KEYS.bestScores, []),
    );
    expect(read<string[]>(STORAGE_KEYS.knownNames)).toEqual(["Marie"]);
    expect(read<unknown[]>(STORAGE_KEYS.bestScores)).toEqual([]);
  });

  it("efface les réglages absents du fichier plutôt que de garder ceux du téléphone", () => {
    fillStorage();
    const backup = exportAllData();
    delete backup.data[STORAGE_KEYS.rules];
    delete backup.data[STORAGE_KEYS.prefs];
    importAllData(backup);
    expect(localStorage.getItem(STORAGE_KEYS.rules)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.prefs)).toBeNull();
  });

  it("efface la partie en cours quand le fichier n'en contient pas", () => {
    fillStorage();
    importAllData(withData(exportAllData(), STORAGE_KEYS.savedGame, null));
    expect(localStorage.getItem(STORAGE_KEYS.savedGame)).toBeNull();
  });

  it("n'écrit pas une partie en cours de forme inattendue", () => {
    fillStorage();
    const broken = withData(exportAllData(), STORAGE_KEYS.savedGame, {
      players: [],
    });
    importAllData(broken);
    expect(localStorage.getItem(STORAGE_KEYS.savedGame)).toBeNull();
  });

  it("force une re-migration au prochain lancement", () => {
    localStorage.setItem(STORAGE_KEYS.schemaVersion, "6");
    importAllData(exportAllData());
    expect(localStorage.getItem(STORAGE_KEYS.schemaVersion)).toBeNull();
  });

  it("remet les données d'avant si une écriture échoue en route", () => {
    fillStorage();
    localStorage.setItem(STORAGE_KEYS.schemaVersion, "6");
    const before = { ...exportAllData().data };
    const incoming = withData(exportAllData(), STORAGE_KEYS.knownNames, ["Marie"]);

    // Stockage plein à la troisième écriture du fichier.
    const realSetItem = localStorage.setItem.bind(localStorage);
    let writes = 0;
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (++writes === 3) throw new DOMException("plein", "QuotaExceededError");
      realSetItem(key, value);
    });

    expect(() => importAllData(incoming)).toThrow("plein");
    spy.mockRestore();
    expect(exportAllData().data).toEqual(before);
    expect(localStorage.getItem(STORAGE_KEYS.schemaVersion)).toBe("6");
  });
});

describe("summarize", () => {
  it("compte ce que l'utilisateur voit avant d'écraser ses données", () => {
    fillStorage();
    expect(summarize(exportAllData())).toEqual({
      players: 2,
      scores: 2, // un meilleur score + un pire score
      savedGames: 1,
    });
  });

  it("annonce un fichier vide sans planter", () => {
    expect(summarize(exportAllData())).toEqual({
      players: 0,
      scores: 0,
      savedGames: 0,
    });
  });
});

describe("readBackupFile", () => {
  const asFile = (content: string): File =>
    new File([content], "cornet-sauvegarde.json", { type: "application/json" });

  it("lit un fichier de sauvegarde valide", async () => {
    fillStorage();
    const result = await readBackupFile(asFile(JSON.stringify(exportAllData())));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.data[STORAGE_KEYS.knownNames]).toEqual(["Alice", "Jean"]);
    }
  });

  it("signale un fichier qui n'est pas du JSON", async () => {
    const result = await readBackupFile(asFile("ceci n'est pas du json"));
    expect(result).toEqual({ ok: false, reason: "unreadable" });
  });

  it("signale un JSON qui n'est pas une sauvegarde de l'appli", async () => {
    const result = await readBackupFile(asFile(JSON.stringify({ hello: "world" })));
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("ne touche à rien : la lecture précède la confirmation", async () => {
    fillStorage();
    const before = localStorage.getItem(STORAGE_KEYS.knownNames);
    const other = withData(exportAllData(), STORAGE_KEYS.knownNames, ["Zoé"]);
    await readBackupFile(asFile(JSON.stringify(other)));
    expect(localStorage.getItem(STORAGE_KEYS.knownNames)).toBe(before);
  });
});
