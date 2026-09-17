// `downloadBackup` n'est pas couvert ici : c'est de la plomberie DOM (Blob,
// URL.createObjectURL, <a download>), rien à vérifier côté logique.

import { beforeEach, describe, expect, it } from "vitest";
import {
  exportAllData,
  importAllData,
  isValidBackupData,
  readBackupFile,
  type BackupData,
} from "./backup";
import { STORAGE_KEYS } from "./keys";
import { DEFAULT_RULES } from "../scoring";
import { createPlayers } from "../state";
import type { SavedGame } from "../types";

beforeEach(() => localStorage.clear());

const put = (key: string, value: unknown): void =>
  localStorage.setItem(key, JSON.stringify(value));
const read = <T>(key: string): T | null => {
  const raw = localStorage.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as T);
};

// Construite par le constructeur de l'appli : une partie ne porte que ses
// variantes sélectionnées, pas les quatre.
const players = createPlayers(["Jean"], ["Classique"], ["#FCC1C7"]);
players[0].scores.Classique["1"] = 3;

const savedGame: SavedGame = {
  players,
  selectedVariants: ["Classique"],
  currentPlayerIndex: 0,
  rules: DEFAULT_RULES,
};

function fillStorage(): void {
  put(STORAGE_KEYS.knownNames, ["Alice", "Jean"]);
  put(STORAGE_KEYS.playerStats, {
    Jean: { games: 3, classiqueGames: 2, classiquePoints: 400, classiqueBest: 210 },
  });
  put(STORAGE_KEYS.rules, DEFAULT_RULES);
  put(STORAGE_KEYS.prefs, { bonusHint: false });
  put(STORAGE_KEYS.bestScores, [{ name: "Jean", score: 250, date: "01/02/2026" }]);
  put(STORAGE_KEYS.worstScores, [{ name: "Alice", score: 60, date: "01/02/2026" }]);
  put(STORAGE_KEYS.savedGame, savedGame);
}

describe("exportAllData", () => {
  it("rassemble toutes les données de l'appareil", () => {
    fillStorage();
    const data = exportAllData();
    expect(data.knownNames).toEqual(["Alice", "Jean"]);
    expect(data.playerStats.Jean.games).toBe(3);
    expect(data.rules).toEqual(DEFAULT_RULES);
    expect(data.prefs).toEqual({ bonusHint: false });
    expect(data.bestScores).toHaveLength(1);
    expect(data.worstScores).toHaveLength(1);
    expect(data.savedGame).toEqual(savedGame);
  });

  it("exporte un appareil vierge sans planter", () => {
    const data = exportAllData();
    expect(data.knownNames).toEqual([]);
    expect(data.playerStats).toEqual({});
    expect(data.rules).toBeNull();
    expect(data.savedGame).toBeNull();
  });

  it("horodate l'export", () => {
    expect(Date.parse(exportAllData().exportedAt)).not.toBeNaN();
  });
});

describe("isValidBackupData", () => {
  it("accepte une sauvegarde produite par l'appli", () => {
    fillStorage();
    expect(isValidBackupData(exportAllData())).toBe(true);
  });

  it("refuse ce qui n'est pas une sauvegarde", () => {
    expect(isValidBackupData(null)).toBe(false);
    expect(isValidBackupData("sauvegarde")).toBe(false);
    expect(isValidBackupData({})).toBe(false);
    expect(isValidBackupData({ knownNames: ["Jean"] })).toBe(false);
  });

  it("refuse une sauvegarde dont la partie en cours est cassée", () => {
    const data = { ...exportAllData(), savedGame: { players: [] } };
    expect(isValidBackupData(data)).toBe(false);
  });

  it("accepte une sauvegarde sans partie en cours", () => {
    expect(isValidBackupData({ ...exportAllData(), savedGame: null })).toBe(true);
  });
});

describe("importAllData", () => {
  it("restitue à l'identique ce qui a été exporté", () => {
    fillStorage();
    const data = exportAllData();
    localStorage.clear();
    importAllData(data);
    expect(exportAllData()).toMatchObject({
      knownNames: data.knownNames,
      playerStats: data.playerStats,
      rules: data.rules,
      prefs: data.prefs,
      bestScores: data.bestScores,
      worstScores: data.worstScores,
      savedGame: data.savedGame,
    });
  });

  it("remplace les données de l'appareil au lieu de les compléter", () => {
    fillStorage();
    importAllData({ ...exportAllData(), knownNames: ["Marie"], bestScores: [] });
    expect(read<string[]>(STORAGE_KEYS.knownNames)).toEqual(["Marie"]);
    expect(read<unknown[]>(STORAGE_KEYS.bestScores)).toEqual([]);
  });

  it("efface les réglages absents du fichier plutôt que de garder ceux du téléphone", () => {
    fillStorage();
    importAllData({ ...exportAllData(), rules: null, prefs: null });
    expect(localStorage.getItem(STORAGE_KEYS.rules)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.prefs)).toBeNull();
  });

  it("efface la partie en cours quand le fichier n'en contient pas", () => {
    fillStorage();
    importAllData({ ...exportAllData(), savedGame: null });
    expect(localStorage.getItem(STORAGE_KEYS.savedGame)).toBeNull();
  });

  it("n'écrit pas une partie en cours de forme inattendue", () => {
    fillStorage();
    const data = exportAllData();
    importAllData({ ...data, savedGame: { players: [] } as unknown as SavedGame });
    expect(localStorage.getItem(STORAGE_KEYS.savedGame)).toBeNull();
  });

  it("force une re-migration au prochain lancement", () => {
    localStorage.setItem(STORAGE_KEYS.schemaVersion, "5");
    importAllData(exportAllData());
    expect(localStorage.getItem(STORAGE_KEYS.schemaVersion)).toBeNull();
  });

  it("accepte un fichier d'avant les préférences d'affichage", () => {
    const old = exportAllData() as Partial<BackupData>;
    delete old.prefs;
    importAllData(old as BackupData);
    expect(localStorage.getItem(STORAGE_KEYS.prefs)).toBeNull();
  });

  it("accepte un fichier d'avant les statistiques", () => {
    const old = exportAllData() as Partial<BackupData>;
    delete old.playerStats;
    importAllData(old as BackupData);
    expect(read(STORAGE_KEYS.playerStats)).toEqual({});
  });
});

describe("readBackupFile", () => {
  const asFile = (content: string): File =>
    new File([content], "yams-sauvegarde.json", { type: "application/json" });

  it("lit un fichier de sauvegarde valide", async () => {
    fillStorage();
    const result = await readBackupFile(asFile(JSON.stringify(exportAllData())));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.knownNames).toEqual(["Alice", "Jean"]);
  });

  it("signale un fichier qui n'est pas du JSON", async () => {
    const result = await readBackupFile(asFile("ceci n'est pas du json"));
    expect(result).toEqual({ ok: false, reason: "unreadable" });
  });

  it("signale un JSON qui n'est pas une sauvegarde Yams", async () => {
    const result = await readBackupFile(asFile(JSON.stringify({ hello: "world" })));
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("ne touche à rien : la lecture précède la confirmation", async () => {
    fillStorage();
    const before = localStorage.getItem(STORAGE_KEYS.knownNames);
    await readBackupFile(asFile(JSON.stringify({ ...exportAllData(), knownNames: ["Zoé"] })));
    expect(localStorage.getItem(STORAGE_KEYS.knownNames)).toBe(before);
  });
});
