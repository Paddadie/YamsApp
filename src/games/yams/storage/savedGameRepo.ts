// Partie en cours : une seule entrée, lue au démarrage ("Reprendre la partie")
// et écrite après chaque saisie.

import type { SavedGame } from "../types";
import { normalizeRules } from "../scoring";
import { sameName } from "../../../core/playerName";
import { STORAGE_KEYS } from "../../../core/storage/keys";
import { readJson, writeJson, removeKey } from "../../../core/storage/localStore";

export function isSavedGame(value: unknown): value is SavedGame {
  if (!value || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  return (
    Array.isArray(g.players) &&
    g.players.length > 0 &&
    g.players.every(isPlayerLike) &&
    Array.isArray(g.selectedVariants) &&
    g.selectedVariants.length > 0 &&
    typeof g.currentPlayerIndex === "number" &&
    g.currentPlayerIndex >= 0 &&
    g.currentPlayerIndex < g.players.length
  );
}

function isPlayerLike(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.name === "string" &&
    typeof p.color === "string" &&
    !!p.scores &&
    typeof p.scores === "object"
  );
}

export function getSavedGame(): SavedGame | null {
  const game = readJson(STORAGE_KEYS.savedGame, isSavedGame);
  if (!game) return null;
  // Les règles sont figées au lancement : on ne fait que les remettre en forme
  // au cas où elles viendraient d'une version antérieure.
  game.rules = normalizeRules(game.rules);
  return game;
}

export function saveSavedGame(game: SavedGame): void {
  writeJson(STORAGE_KEYS.savedGame, game);
}

export function clearSavedGame(): void {
  removeKey(STORAGE_KEYS.savedGame);
}

export function hasSavedGame(): boolean {
  return getSavedGame() !== null;
}

export function savedGameIncludes(name: string): boolean {
  return getSavedGame()?.players.some((p) => sameName(p.name, name)) ?? false;
}

// Renommage d'un joueur (Paramètres) : la partie en cours le suit. Sans ça, elle
// finirait par réécrire l'ancien nom dans les stats et le Hall of Fame — un
// joueur fantôme. L'impact déjà mesuré sur le Hall of Fame (écran de fin) est
// indexé par nom : il suit aussi.
export function renameInSavedGame(from: string, to: string): void {
  const game = getSavedGame();
  if (!game || !game.players.some((p) => sameName(p.name, from))) return;
  const swap = (name: string): string => (sameName(name, from) ? to : name);
  const impact = game.hofImpact;
  saveSavedGame({
    ...game,
    players: game.players.map((p) => ({ ...p, name: swap(p.name) })),
    ...(impact
      ? {
          hofImpact: {
            best: impact.best.map((key) => renameKey(key, swap)),
            worst: impact.worst.map((key) => renameKey(key, swap)),
            newRecord: impact.newRecord
              ? { ...impact.newRecord, name: swap(impact.newRecord.name) }
              : null,
          },
        }
      : {}),
  });
}

// Clé `nom|variante` de HallOfFameImpact.
function renameKey(key: string, swap: (name: string) => string): string {
  const at = key.lastIndexOf("|");
  return at < 0 ? key : `${swap(key.slice(0, at))}${key.slice(at)}`;
}
