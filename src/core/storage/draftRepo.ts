// Brouillon d'avant-partie : le jeu visé, les joueurs ajoutés et la
// configuration choisie sur l'écran du jeu, le temps de passer de cet écran à
// la sélection des joueurs puis à la partie. Converti en partie réelle au
// lancement (chaque jeu écrit la sienne), puis effacé.
//
// `config` est volontairement opaque ici : le brouillon transporte ce que le
// jeu y a mis (les variantes pour le Yams, les réglages pour le 5000) sans
// jamais le regarder. C'est ce qui permet à l'écran de sélection des joueurs
// d'être commun à tous les jeux.

import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson, removeKey } from "./localStore";

export interface GameDraft {
  gameId: string;
  playerNames: string[];
  config: unknown;
}

function isDraft(value: unknown): value is GameDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.gameId === "string" &&
    d.gameId.length > 0 &&
    Array.isArray(d.playerNames) &&
    d.playerNames.every((n) => typeof n === "string")
  );
}

export function getDraft(): GameDraft | null {
  return readJson(STORAGE_KEYS.draft, isDraft);
}

export function saveDraft(draft: GameDraft): void {
  writeJson(STORAGE_KEYS.draft, draft);
}

export function clearDraft(): void {
  removeKey(STORAGE_KEYS.draft);
}

// Roster de la dernière partie lancée, pour proposer « les mêmes joueurs ».
// Commun aux jeux : on enchaîne souvent un 5000 après un Yams avec les mêmes
// personnes autour de la table.
const isNameList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

export function getLastRoster(): string[] {
  return readJson(STORAGE_KEYS.lastRoster, isNameList) ?? [];
}

export function saveLastRoster(names: string[]): void {
  writeJson(STORAGE_KEYS.lastRoster, names);
}
