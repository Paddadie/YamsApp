// Règles de jeu réglées dans les paramètres.
// Copiées dans chaque partie au lancement (voir SavedGame.rules).

import type { GameRules } from "../types";
import { normalizeRules } from "../scoring";
import { STORAGE_KEYS } from "../../../core/storage/keys";
import { readJson, writeJson } from "../../../core/storage/localStore";

export function getRules(): GameRules {
  return normalizeRules(readJson<unknown>(STORAGE_KEYS.rules));
}

export function saveRules(rules: GameRules): void {
  writeJson(STORAGE_KEYS.rules, rules);
}
