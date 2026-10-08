// Stockage du 5000 : la partie en cours et les réglages.
//
// La partie porte le tour en cours (pot, dés restants, chiffres activés) et pas
// seulement les scores : en MPA rien ne survit à une navigation, et un écran
// verrouillé au milieu d'un tour ne doit pas le perdre.

import { STORAGE_KEYS } from "../../core/storage/keys";
import { readJson, writeJson, removeKey } from "../../core/storage/localStore";
import { normalizeRules } from "./rules";
import { normalizeRecords, type G5000Records } from "./records";
import { sheetFrom } from "./engine";
import type { G5000Game, G5000Player, G5000Rules, G5000Turn } from "./types";
import { sameName } from "../../core/playerName";

/* ---------- Réglages ---------- */

// Des réglages enregistrés avant les variantes portent encore les anciens
// interrupteurs (égalité, score exact…). Pour une partie en cours,
// normalizeRules les convertit en variantes ; ici on les ignore : les
// variantes se cochent désormais sur l'accueil, et on y arrive sans aucune
// (choix de Paul, 07/10/2026).
export function getRules(): G5000Rules {
  const raw = readJson<unknown>(STORAGE_KEYS.g5000Rules);
  const settings =
    raw && typeof raw === "object" && !("variants" in raw)
      ? { ...raw, variants: [] }
      : raw;
  return normalizeRules(settings);
}

export function saveRules(rules: G5000Rules): void {
  writeJson(STORAGE_KEYS.g5000Rules, rules);
}

/* ---------- Partie en cours ---------- */

function isTurn(value: unknown): value is G5000Turn {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.pot === "number" &&
    typeof t.diceLeft === "number" &&
    Array.isArray(t.openDigits) &&
    typeof t.rolls === "number"
  );
}

function isEntry(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  if (typeof e.score !== "number") return false;
  if (e.struck === undefined) return true;
  const s = e.struck as Record<string, unknown> | null;
  return !!s && typeof s === "object" && (s.kind === "tie" || s.kind === "penalty");
}

// `history` : le format d'avant la feuille raturée (cf. upgradePlayer), encore
// accepté pour une partie en cours ou une sauvegarde importée.
function isPlayer(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  const scores =
    Array.isArray(p.sheet)
      ? p.sheet.every(isEntry)
      : Array.isArray(p.history) && p.history.every((n) => typeof n === "number");
  return (
    typeof p.name === "string" &&
    typeof p.color === "string" &&
    scores &&
    typeof p.blankTurns === "number"
  );
}

// Jusqu'au 07/10/2026, un joueur ne gardait que ses scores en vigueur
// (`history`) : une redescente les effaçait. Ils deviennent sa feuille, sans
// rature — ce qui avait été effacé l'est pour de bon. Mis à jour à la lecture,
// comme les réglages : pas de migration de schéma.
function upgradePlayer(player: G5000Player): G5000Player {
  if (Array.isArray(player.sheet)) return player;
  const { history = [], ...rest } = player as Omit<G5000Player, "sheet"> & {
    history?: number[];
  };
  return { ...rest, sheet: sheetFrom(history) };
}

export function isG5000Game(value: unknown): value is G5000Game {
  if (!value || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  return (
    Array.isArray(g.players) &&
    g.players.length > 0 &&
    g.players.every(isPlayer) &&
    typeof g.currentPlayerIndex === "number" &&
    g.currentPlayerIndex >= 0 &&
    g.currentPlayerIndex < g.players.length &&
    isTurn(g.turn)
  );
}

export function getSavedGame(): G5000Game | null {
  const game = readJson(STORAGE_KEYS.g5000SavedGame, isG5000Game);
  if (!game) return null;
  // Les réglages sont figés au lancement, comme au Yams : on ne fait que les
  // remettre en forme au cas où ils viendraient d'une version antérieure.
  game.rules = normalizeRules(game.rules);
  game.players = game.players.map(upgradePlayer);
  // La partie d'avant le dernier tour (« Corriger ») : abîmée, on la laisse
  // tomber — le tour ne se corrigera pas, mais la partie continue.
  if (game.previous && isG5000Game(game.previous)) {
    game.previous.rules = game.rules;
    game.previous.players = game.previous.players.map(upgradePlayer);
  } else {
    delete game.previous;
    delete game.lastTurn;
  }
  return game;
}

export function saveSavedGame(game: G5000Game): void {
  writeJson(STORAGE_KEYS.g5000SavedGame, game);
}

export function clearSavedGame(): void {
  removeKey(STORAGE_KEYS.g5000SavedGame);
}

export function hasSavedGame(): boolean {
  return getSavedGame() !== null;
}

export function savedGameIncludes(name: string): boolean {
  return getSavedGame()?.players.some((p) => sameName(p.name, name)) ?? false;
}

// Renommage d'un joueur (Paramètres) : la partie en cours le suit, sinon elle
// réécrirait l'ancien nom dans les records à la fin.
// La partie d'avant le dernier tour suit aussi : sinon « Corriger » ferait
// revenir l'ancien nom.
export function renameInSavedGame(from: string, to: string): void {
  const game = getSavedGame();
  if (!game || !game.players.some((p) => sameName(p.name, from))) return;
  const rename = (players: G5000Player[]): G5000Player[] =>
    players.map((p) => (sameName(p.name, from) ? { ...p, name: to } : p));
  saveSavedGame({
    ...game,
    players: rename(game.players),
    ...(game.previous ? { previous: { ...game.previous, players: rename(game.previous.players) } } : {}),
  });
}

/* ---------- Records ---------- */

export function getRecords(): G5000Records {
  return normalizeRecords(readJson<unknown>(STORAGE_KEYS.g5000Records));
}

export function saveRecords(records: G5000Records): void {
  writeJson(STORAGE_KEYS.g5000Records, records);
}
