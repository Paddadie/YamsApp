// Ouvrir un écran sous jsdom : son <body> tel qu'écrit dans le .html, l'URL
// demandée, puis le module d'entrée importé à neuf. Les modules sont rechargés
// à chaque ouverture (une page = un chargement, comme en MPA) ; l'état ne passe
// d'un écran à l'autre que par localStorage, comme dans le vrai navigateur.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi } from "vitest";
import { expandFragments } from "../../../htmlFragments";

export type PageName =
  | "home"
  | "players"
  | "settings"
  | "rules"
  | "yamsHome"
  | "yamsGame"
  | "yamsEnd"
  | "yamsHall"
  | "g5000Home"
  | "g5000Game"
  | "g5000End"
  | "g5000Records";

const HTML_FILES: Record<PageName, string> = {
  home: "index.html",
  players: "players.html",
  settings: "settings.html",
  rules: "rules.html",
  yamsHome: "yams.html",
  yamsGame: "yams-game.html",
  yamsEnd: "yams-end.html",
  yamsHall: "yams-hall.html",
  g5000Home: "5000.html",
  g5000Game: "5000-game.html",
  g5000End: "5000-end.html",
  g5000Records: "5000-records.html",
};

// Chemins LITTÉRAUX : un import construit à l'exécution n'est pas résolu par
// Vite.
const ENTRIES: Record<PageName, () => Promise<unknown>> = {
  home: () => import("../../pages/home"),
  players: () => import("../../pages/players"),
  settings: () => import("../../pages/settings"),
  rules: () => import("../../pages/rules"),
  yamsHome: () => import("../../pages/yams/home"),
  yamsGame: () => import("../../pages/yams/game"),
  yamsEnd: () => import("../../pages/yams/end"),
  yamsHall: () => import("../../pages/yams/hall"),
  g5000Home: () => import("../../pages/g5000/home"),
  g5000Game: () => import("../../pages/g5000/game"),
  g5000End: () => import("../../pages/g5000/end"),
  g5000Records: () => import("../../pages/g5000/records"),
};

export interface OpenedPage {
  // Erreur levée au chargement : une garde qui redirige en lève une
  // volontairement, une page cassée aussi.
  error: unknown;
}

export const htmlFile = (page: PageName): string => HTML_FILES[page];

function loadBody(page: PageName): void {
  // Racine du projet : Vitest y lance les tests (sous jsdom, import.meta.url
  // ne pointe pas sur le disque).
  const path = resolve(process.cwd(), HTML_FILES[page]);
  // Fragments communs injectés comme au build (pictogrammes…).
  const html = expandFragments(readFileSync(path, "utf-8"));
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("script").forEach((s) => s.remove());
  document.body.replaceChildren(
    ...[...parsed.body.childNodes].map((node) => document.importNode(node, true)),
  );
}

// `search` : la chaîne de requête, `?` compris (« ?game=yams »).
export async function openPage(page: PageName, search = ""): Promise<OpenedPage> {
  vi.resetModules();
  navigations().length = 0;
  loadBody(page);
  history.replaceState(null, "", `/YamsApp/${HTML_FILES[page]}${search}`);
  try {
    await ENTRIES[page]();
    return { error: undefined };
  } catch (error) {
    return { error };
  }
}

// Pages vers lesquelles l'écran a voulu naviguer (goTo), dans l'ordre.
export function navigations(): string[] {
  const g = globalThis as { __navigations?: string[] };
  g.__navigations ??= [];
  return g.__navigations;
}

/* ---------- Gestes ---------- */

export function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Introuvable : ${selector}`);
  return found;
}

export function click(target: string | HTMLElement): void {
  (typeof target === "string" ? el(target) : target).click();
}

// Bouton dont le texte contient `text` (les boutons construits par le code
// n'ont pas d'id).
export function button(text: string, root: ParentNode = document): HTMLButtonElement {
  const found = [...root.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
    b.textContent?.includes(text),
  );
  if (!found) throw new Error(`Bouton introuvable : « ${text} »`);
  return found;
}

export function hasButton(text: string, root: ParentNode = document): boolean {
  return [...root.querySelectorAll("button")].some((b) => b.textContent?.includes(text));
}
