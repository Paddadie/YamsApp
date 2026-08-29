// Noms de joueurs déjà saisis au moins une fois, pour les reproposer d'une
// partie à l'autre. Liste triée, sans doublon (comparaison insensible à la
// casse et aux espaces de bord).

import { compareNames, sameName } from "../playerName";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./localStore";

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

export function getKnownNames(): string[] {
  return readJson(STORAGE_KEYS.knownNames, isStringArray) ?? [];
}

// Renvoie le nom déjà connu correspondant (à la casse / aux espaces près),
// sinon le nom saisi nettoyé. Sert de forme canonique dans toute l'appli.
export function resolveName(raw: string): string {
  return getKnownNames().find((n) => sameName(n, raw)) ?? raw.trim();
}

export function addKnownName(raw: string): void {
  const name = raw.trim();
  if (!name) return;
  const names = getKnownNames();
  if (names.some((n) => sameName(n, name))) return;
  names.push(name);
  names.sort(compareNames);
  writeJson(STORAGE_KEYS.knownNames, names);
}

export function removeKnownName(raw: string): void {
  writeJson(
    STORAGE_KEYS.knownNames,
    getKnownNames().filter((n) => !sameName(n, raw)),
  );
}

// Correction de casse ou de faute de frappe. Refuse (renvoie false) si le
// nouveau nom est vide ou déjà porté par un autre joueur.
export function renameKnownName(oldName: string, newName: string): boolean {
  const next = newName.trim();
  if (!next) return false;
  const names = getKnownNames();
  if (names.some((n) => sameName(n, next) && !sameName(n, oldName))) return false;

  const updated = names.map((n) => (sameName(n, oldName) ? next : n));
  updated.sort(compareNames);
  writeJson(STORAGE_KEYS.knownNames, updated);
  return true;
}
