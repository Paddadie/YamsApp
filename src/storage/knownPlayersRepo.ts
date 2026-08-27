// Noms de joueurs déjà saisis au moins une fois, pour les reproposer d'une
// partie à l'autre. Liste triée, sans doublon (comparaison insensible à la
// casse et aux espaces de bord).

import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./localStore";

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

const fold = (name: string): string => name.trim().toLowerCase();

export function getKnownNames(): string[] {
  return readJson(STORAGE_KEYS.knownNames, isStringArray) ?? [];
}

// Renvoie le nom déjà connu correspondant (à la casse / aux espaces près),
// sinon le nom saisi nettoyé. Sert de forme canonique dans toute l'appli.
export function resolveName(raw: string): string {
  const key = fold(raw);
  return getKnownNames().find((n) => fold(n) === key) ?? raw.trim();
}

export function addKnownName(raw: string): void {
  const name = raw.trim();
  if (!name) return;
  const names = getKnownNames();
  if (names.some((n) => fold(n) === fold(name))) return;
  names.push(name);
  names.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  writeJson(STORAGE_KEYS.knownNames, names);
}
