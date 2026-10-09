// La fenêtre « Installer Cornet » du menu (core/pwa/install.ts) : remise à
// plus tard, ou plus jamais. « Plus tard » la repropose une semaine après —
// le délai au bout duquel Safari efface un site non installé, celui qu'elle
// veut éviter.
//
// Propre à l'appareil : pas dans la sauvegarde (installer Cornet sur un
// téléphone ne dit rien d'un autre), comme la dernière victoire.

import { dateStamp } from "../dates";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./localStore";

export const INSTALL_SNOOZE_DAYS = 7;

interface InstallPromptState {
  snoozedUntil?: string; // ISO local (dateStamp)
  never?: boolean;
}

const isState = (v: unknown): v is InstallPromptState =>
  !!v && typeof v === "object" && !Array.isArray(v);

function read(): InstallPromptState {
  return readJson(STORAGE_KEYS.installPrompt, isState) ?? {};
}

export function shouldOfferInstall(now: Date = new Date()): boolean {
  const state = read();
  if (state.never === true) return false;
  return typeof state.snoozedUntil !== "string" || state.snoozedUntil <= dateStamp(now);
}

export function snoozeInstall(now: Date = new Date()): void {
  const until = new Date(now);
  until.setDate(until.getDate() + INSTALL_SNOOZE_DAYS);
  writeJson(STORAGE_KEYS.installPrompt, { ...read(), snoozedUntil: dateStamp(until) });
}

export function neverOfferInstall(): void {
  writeJson(STORAGE_KEYS.installPrompt, { ...read(), never: true });
}
