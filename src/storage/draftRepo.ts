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

export function getDraft(): GameDraft | null {
  return readJson<GameDraft>(STORAGE_KEYS.draft);
}

export function saveDraft(draft: GameDraft): void {
  writeJson(STORAGE_KEYS.draft, draft);
}

export function clearDraft(): void {
  removeKey(STORAGE_KEYS.draft);
}
