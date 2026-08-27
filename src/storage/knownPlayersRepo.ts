// Noms de joueurs déjà saisis au moins une fois, pour les reproposer d'une
// partie à l'autre. Liste triée, sans doublon.

import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./localStore";

export function getKnownNames(): string[] {
  return readJson<string[]>(STORAGE_KEYS.knownNames) ?? [];
}

export function addKnownName(name: string): void {
  const names = getKnownNames();
  if (names.includes(name)) return;
  names.push(name);
  names.sort((a, b) => a.localeCompare(b));
  writeJson(STORAGE_KEYS.knownNames, names);
}
