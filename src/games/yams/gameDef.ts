// Ce que le Yams déclare au reste de l'application (cf. games/types). Sans
// DOM : les récapitulatifs sont des données, que les écrans mettent en forme.

import type { GameDef, ResumeInfo } from "../types";
import type { GameDraft } from "../../core/storage/draftRepo";
import { goTo } from "../../core/nav";
import { plural } from "../../core/ui";
import { variantBadgeData } from "./variantBadge";
import { PLAYER_COLORS } from "../../core/playerColors";
import { STORAGE_KEYS } from "../../core/storage/keys";
import { saveLastRoster } from "../../core/storage/draftRepo";
import { createPlayers } from "./players";
import { getRules } from "./storage/rulesRepo";
import { yamsRulesDoc } from "./rulesDoc";
import {
  getSavedGame,
  saveSavedGame,
  clearSavedGame,
  isSavedGame,
  renameInSavedGame,
  savedGameIncludes,
} from "./storage/savedGameRepo";
import {
  getPlayerStats,
  removePlayerStats,
  renamePlayerStats,
} from "./storage/playerStatsRepo";
import {
  hallOfFameCount,
  hallOfFameNames,
  removeFromHallOfFame,
  renameInHallOfFame,
} from "./hallOfFame";
import { sameName } from "../../core/playerName";
import type { Variant } from "./types";

// Ce que le Yams range dans `GameDraft.config` : les variantes cochées sur son
// écran d'accueil.
export interface YamsConfig {
  variants: Variant[];
}

export function yamsConfigOf(draft: GameDraft): YamsConfig {
  const config = draft.config as YamsConfig | undefined;
  const variants = Array.isArray(config?.variants) ? config.variants : [];
  return { variants: variants as Variant[] };
}


export const YAMS: GameDef = {
  id: "yams",
  title: "Yams",
  icon: "🍀",
  accent: "#3d9142",
  tagline: "Remplir sa grille, décrocher le bonus.",

  pages: {
    home: "yams.html",
    play: "yams-game.html",
  },

  // Lues au moment de l'affichage : la page des règles montre le barème tel
  // qu'il est réglé maintenant, pas celui d'une partie passée.
  rulesDoc: () => yamsRulesDoc(getRules()),

  resume(): ResumeInfo | null {
    const saved = getSavedGame();
    if (!saved) return null;
    return {
      playerNames: saved.players.map((p) => p.name),
      rows: [
        { term: "Joueurs", value: saved.players.map((p) => p.name).join(", ") },
        { term: "Variantes", value: { badges: saved.selectedVariants.map(variantBadgeData) } },
      ],
    };
  },

  startGame(draft, colorOf) {
    const { variants } = yamsConfigOf(draft);
    saveLastRoster(draft.playerNames.slice());
    saveSavedGame({
      players: createPlayers(
        draft.playerNames,
        variants,
        draft.playerNames.map((name) => colorOf.get(name) ?? PLAYER_COLORS[0]),
      ),
      selectedVariants: variants,
      currentPlayerIndex: 0,
      rules: getRules(), // règles figées pour toute la partie
    });
    goTo("yamsGame");
  },

  clearSaved: clearSavedGame,

  renamePlayer(oldName, newName) {
    renamePlayerStats(oldName, newName);
    renameInHallOfFame(oldName, newName);
    renameInSavedGame(oldName, newName);
  },

  removePlayer(name) {
    removePlayerStats(name);
    removeFromHallOfFame(name);
    if (savedGameIncludes(name)) clearSavedGame();
  },

  playerNames: () => [
    ...(getSavedGame()?.players.map((p) => p.name) ?? []),
    ...Object.keys(getPlayerStats()),
    ...hallOfFameNames(),
  ],

  describePlayer(name) {
    const stat = Object.entries(getPlayerStats()).find(([k]) => sameName(k, name))?.[1];
    const rows = [
      {
        term: "Moyenne classique",
        value:
          stat && stat.classiqueGames > 0
            ? String(Math.round(stat.classiquePoints / stat.classiqueGames))
            : "—",
      },
      { term: "Palmarès du Yams", value: plural(hallOfFameCount(name), "entrée") },
    ];
    if (savedGameIncludes(name)) {
      rows.push({ term: "Partie de Yams en cours", value: "sera abandonnée" });
    }
    return rows;
  },

  storageKeys: [
    STORAGE_KEYS.savedGame,
    STORAGE_KEYS.playerStats,
    STORAGE_KEYS.rules,
    STORAGE_KEYS.prefs,
    STORAGE_KEYS.bestScores,
    STORAGE_KEYS.worstScores,
  ],

  savedGameKey: STORAGE_KEYS.savedGame,
  guards: { [STORAGE_KEYS.savedGame]: isSavedGame },
};
