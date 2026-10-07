// Ce que le 5000 déclare au reste de l'application (cf. games/types).

import type { GameDef, ResumeInfo, SummaryRow } from "../types";
import { variantDef } from "./variants";
import { goTo } from "../../core/nav";
import { formatScore } from "../../core/format";
import { sameName } from "../../core/playerName";
import { PLAYER_COLORS } from "../../core/playerColors";
import { STORAGE_KEYS } from "../../core/storage/keys";
import { saveLastRoster } from "../../core/storage/draftRepo";
import { createGame, currentScore } from "./engine";
import { g5000RulesDoc } from "./rulesDoc";
import {
  getRules,
  getSavedGame,
  saveSavedGame,
  clearSavedGame,
  isG5000Game,
  getRecords,
  saveRecords,
  renameInSavedGame,
  savedGameIncludes,
} from "./repo";
import {
  recordNames,
  recordsHeldBy,
  removeFromRecords,
  renameInRecords,
} from "./records";
import { plural } from "../../core/ui";

export const G5000_ID = "g5000";

export const G5000: GameDef = {
  id: G5000_ID,
  title: "5000",
  icon: "💰",
  accent: "#c9552f",
  tagline: "Pousser sa chance, ou banquer à temps.",

  pages: {
    home: "5000.html",
    play: "5000-game.html",
  },

  // Depuis une partie : ses réglages figés et ses seules variantes. Depuis le
  // menu : les réglages actuels et toutes les variantes (demande de Paul).
  rulesDoc({ inGame }) {
    const saved = inGame ? getSavedGame() : null;
    return saved ? g5000RulesDoc(saved.rules, "game") : g5000RulesDoc(getRules(), "all");
  },

  resume(): ResumeInfo | null {
    const saved = getSavedGame();
    if (!saved) return null;
    const leader = Math.max(0, ...saved.players.map(currentScore));
    const rows: SummaryRow[] = [
      { term: "Joueurs", value: saved.players.map((p) => p.name).join(", ") },
      {
        term: "Objectif",
        value: `${formatScore(saved.rules.target)} points`,
      },
    ];
    if (saved.rules.variants.length > 0) {
      rows.push({
        term: "Variantes",
        value: {
          badges: saved.rules.variants.map(variantDef).map((v) => ({
            icon: v.icon,
            color: v.color,
            title: v.label,
          })),
        },
      });
    }
    rows.push({ term: "Meilleur score", value: formatScore(leader) });
    return { playerNames: saved.players.map((p) => p.name), rows };
  },

  startGame(draft, colorOf) {
    saveLastRoster(draft.playerNames.slice());
    saveSavedGame(
      createGame(
        draft.playerNames,
        draft.playerNames.map((name) => colorOf.get(name) ?? PLAYER_COLORS[0]),
        getRules(), // réglages figés pour toute la partie
      ),
    );
    goTo("g5000Game");
  },

  clearSaved: clearSavedGame,

  // Les records suivent le joueur quand on le renomme, et disparaissent avec
  // lui quand on le supprime.
  renamePlayer(oldName, newName) {
    saveRecords(renameInRecords(getRecords(), oldName, newName));
    renameInSavedGame(oldName, newName);
  },

  removePlayer(name) {
    saveRecords(removeFromRecords(getRecords(), name));
    if (savedGameIncludes(name)) clearSavedGame();
  },

  playerNames: () => [
    ...(getSavedGame()?.players.map((p) => p.name) ?? []),
    ...recordNames(getRecords()),
  ],

  describePlayer(name) {
    const records = getRecords();
    const wins = Object.entries(records.wins)
      .filter(([n]) => sameName(n, name))
      .reduce((total, [, count]) => total + count, 0);
    const rows = [
      { term: "Palmarès du 5000", value: plural(recordsHeldBy(records, name), "record") },
      { term: "Victoires au 5000", value: String(wins) },
    ];
    if (savedGameIncludes(name)) {
      rows.push({ term: "Partie de 5000 en cours", value: "sera abandonnée" });
    }
    return rows;
  },

  storageKeys: [
    STORAGE_KEYS.g5000SavedGame,
    STORAGE_KEYS.g5000Rules,
    STORAGE_KEYS.g5000Records,
  ],

  savedGameKey: STORAGE_KEYS.g5000SavedGame,
  guards: { [STORAGE_KEYS.g5000SavedGame]: isG5000Game },
};
