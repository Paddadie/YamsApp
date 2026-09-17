// Préférences d'affichage réglées dans les Paramètres.
//
// Volontairement séparées de GameRules : les règles sont recopiées dans chaque
// partie au lancement (SavedGame.rules) et n'y bougent plus, alors qu'un
// réglage d'affichage doit s'appliquer tout de suite, y compris à une partie
// déjà commencée.

import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./localStore";

export interface Prefs {
  // Indice du plan de bonus sur l'écran de jeu (cf. bonusPlan, scoring.ts).
  bonusHint: boolean;
}

export const DEFAULT_PREFS: Prefs = { bonusHint: true };

// Champ par champ plutôt qu'un guard de forme : une préférence absente ou
// abîmée retombe sur sa valeur par défaut au lieu de faire tomber tout l'objet.
export function getPrefs(): Prefs {
  const raw = readJson<unknown>(STORAGE_KEYS.prefs);
  const stored = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    bonusHint:
      typeof stored.bonusHint === "boolean"
        ? stored.bonusHint
        : DEFAULT_PREFS.bonusHint,
  };
}

export function savePrefs(prefs: Prefs): void {
  writeJson(STORAGE_KEYS.prefs, prefs);
}
