// La dernière victoire, TOUS JEUX CONFONDUS : le post-it du menu (« Dernière
// victoire : Chloé au 5000, hier · 6 300 »). Le menu raconte ainsi la soirée en
// cours, au lieu d'être une simple liste de jeux.
//
// Écrite par les écrans de fin, une seule fois par partie (dans leur bloc
// `recorded`). Suit les renommages et suppressions de joueurs
// (games/playerAdmin.ts), sans quoi un ancien nom reviendrait sur le menu.
// Hors sauvegarde : c'est un rappel, pas une donnée à restaurer.

import { sameName } from "../playerName";
import { STORAGE_KEYS } from "./keys";
import { readJson, removeKey, writeJson } from "./localStore";

export interface LastWin {
  gameId: string;
  winners: string[]; // plusieurs à égalité de premier rang
  score: number;
  date: string; // ISO local, comme les dates du palmarès (core/dates.ts)
}

const isLastWin = (v: unknown): v is LastWin => {
  if (!v || typeof v !== "object") return false;
  const w = v as Partial<LastWin>;
  return (
    typeof w.gameId === "string" &&
    Array.isArray(w.winners) &&
    w.winners.length > 0 &&
    w.winners.every((n) => typeof n === "string") &&
    typeof w.score === "number" &&
    typeof w.date === "string"
  );
};

export function getLastWin(): LastWin | null {
  return readJson(STORAGE_KEYS.lastWin, isLastWin);
}

export function saveLastWin(win: LastWin): void {
  writeJson(STORAGE_KEYS.lastWin, win);
}

export function renameInLastWin(from: string, to: string): void {
  const win = getLastWin();
  if (!win || !win.winners.some((n) => sameName(n, from))) return;
  saveLastWin({ ...win, winners: win.winners.map((n) => (sameName(n, from) ? to : n)) });
}

// Un vainqueur supprimé disparaît du post-it ; s'il était seul, le post-it aussi.
export function removeFromLastWin(name: string): void {
  const win = getLastWin();
  if (!win || !win.winners.some((n) => sameName(n, name))) return;
  const winners = win.winners.filter((n) => !sameName(n, name));
  if (winners.length === 0) removeKey(STORAGE_KEYS.lastWin);
  else saveLastWin({ ...win, winners });
}
