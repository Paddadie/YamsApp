// Données de départ des scénarios de pages, écrites avec les vrais dépôts : les
// écrans les relisent ensuite depuis localStorage, comme en vrai.

import { PLAYER_COLORS } from "../../core/playerColors";
import { saveDraft } from "../../core/storage/draftRepo";
import { addKnownName } from "../../core/storage/knownPlayersRepo";
import { createPlayers, sheetOf } from "../../games/yams/players";
import { DEFAULT_RULES, buildGrid, writeDerived } from "../../games/yams/scoring";
import { getSavedGame, saveSavedGame } from "../../games/yams/storage/savedGameRepo";
import type { GameRules, SavedGame, Variant } from "../../games/yams/types";
import { createGame } from "../../games/g5000/engine";
import { DEFAULT_RULES as G5000_DEFAULT_RULES } from "../../games/g5000/rules";
import {
  getSavedGame as getG5000Game,
  saveSavedGame as saveG5000Game,
} from "../../games/g5000/repo";
import type { G5000Game, G5000Rules } from "../../games/g5000/types";

const colors = (n: number): string[] => PLAYER_COLORS.slice(0, n);

export function knownPlayers(...names: string[]): void {
  for (const name of names) addKnownName(name);
}

export function draft(gameId: string, playerNames: string[], config: unknown = {}): void {
  saveDraft({ gameId, playerNames, config });
}

/* ---------- Yams ---------- */

export function yamsGame(
  names: string[] = ["Alice", "Bob"],
  variants: Variant[] = ["Classique"],
  rules: GameRules = DEFAULT_RULES,
): SavedGame {
  const game: SavedGame = {
    players: createPlayers(names, variants, colors(names.length)),
    selectedVariants: variants,
    currentPlayerIndex: 0,
    rules,
  };
  saveSavedGame(game);
  return game;
}

// Toutes les cases remplies, sauf `leave` cases du dernier joueur : `leave = 0`
// donne une partie terminée. Chaque case prend la plus grande valeur permise,
// moins `handicap` crans pour les joueurs suivants (des totaux différents).
export function filledYamsGame(
  names: string[] = ["Alice", "Bob"],
  variants: Variant[] = ["Classique"],
  leave = 0,
): SavedGame {
  const game = yamsGame(names, variants);
  const grid = buildGrid(game.rules);
  const lines = grid.sections.flatMap((s) => Object.entries(s.lines));
  game.players.forEach((player, p) => {
    for (const variant of variants) {
      const sheet = sheetOf(player, variant);
      for (const [line, values] of lines) {
        if (values.length === 0) continue;
        sheet[line] = values[Math.max(0, values.length - 1 - p)];
      }
      writeDerived(sheet, grid);
    }
  });
  if (leave > 0) {
    const last = sheetOf(game.players[game.players.length - 1], variants[0]);
    for (const line of grid.allScoringNames.slice(-leave)) delete last[line];
    writeDerived(last, grid);
  }
  saveSavedGame(game);
  return game;
}

export const savedYams = (): SavedGame | null => getSavedGame();

/* ---------- 5000 ---------- */

export function g5000Game(
  names: string[] = ["Alice", "Bob"],
  rules: Partial<G5000Rules> = {},
  edit?: (game: G5000Game) => void,
): G5000Game {
  const game = createGame(names, colors(names.length), { ...G5000_DEFAULT_RULES, ...rules });
  edit?.(game);
  saveG5000Game(game);
  return game;
}

export const savedG5000 = (): G5000Game | null => getG5000Game();
