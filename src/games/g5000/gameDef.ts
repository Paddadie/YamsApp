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
import type { G5000Player } from "./types";
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

// Qui mène, pour la carte « Partie en cours » : « Bob mène · 3 100 », ou
// « Égalité en tête » quand plusieurs joueurs partagent le meilleur score.
function leadLabel(players: G5000Player[], leader: number): string {
  if (leader === 0) return "Personne n'est encore entré en jeu";
  const first = players.filter((p) => currentScore(p) === leader);
  const who = first.length === 1 ? `${first[0].name} mène` : "Égalité en tête";
  return `${who} · ${formatScore(leader)}`;
}

export const G5000: GameDef = {
  id: G5000_ID,
  title: "5000",
  icon: "bag",
  accent: "#bf4a26",
  accentPaper: "#fbe7dc",
  sceneDice: [1, 4, 1, 5, 1], // un brelan de 1 et un 5 : 1 050
  tagline: "Pousser sa chance, ou banquer à temps.",
  // La colonne d'un joueur : chaque total sous le précédent, une rature, le
  // score en vigueur surligné.
  sample: [
    { value: "500" },
    { value: "1 350" },
    { value: "2 000", mark: "strike" },
    { value: "2 450", mark: "live" },
  ],

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
    return {
      playerNames: saved.players.map((p) => p.name),
      playerColors: saved.players.map((p) => p.color),
      rows,
      progress: { label: leadLabel(saved.players, leader), ratio: Math.min(1, leader / saved.rules.target) },
    };
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
