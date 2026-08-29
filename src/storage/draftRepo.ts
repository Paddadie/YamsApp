// Brouillon d'avant-partie : variantes choisies sur l'accueil et noms des
// joueurs ajoutés, le temps de passer de l'accueil à l'écran joueurs puis au
// jeu. Converti en partie réelle (savedGameRepo) au lancement, puis effacé.

import type { Variant } from "../types";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson, removeKey } from "./localStore";

export interface GameDraft {
  variants: Variant[];
  playerNames: string[];
}

function isDraft(value: unknown): value is GameDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  return (
    Array.isArray(d.variants) &&
    d.variants.every((v) => typeof v === "string") &&
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
const isNameList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

export function getLastRoster(): string[] {
  return readJson(STORAGE_KEYS.lastRoster, isNameList) ?? [];
}

export function saveLastRoster(names: string[]): void {
  writeJson(STORAGE_KEYS.lastRoster, names);
}
