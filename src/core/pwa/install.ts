// Installer Cornet sur l'écran d'accueil.
//
// Tout vit dans localStorage, sur l'appareil. Sur iPhone, Safari efface les
// données d'un site NON installé après sept jours sans visite — joueurs,
// palmarès, partie en cours — et persist() n'y est pas garanti. Installée,
// l'appli y échappe, et s'ouvre comme les autres, plein écran, hors ligne.
// D'où une fenêtre au menu (pages/home.ts) et une ligne dans Paramètres ›
// Sauvegarde (audit du 09/10, choix de Paul).
//
// Deux cas seulement :
//   « native » — Android, Chrome ou Edge annoncent qu'ils savent installer
//     (`beforeinstallprompt`) : notre bouton « Installer » ouvre leur boîte ;
//   « ios » — aucune page ne peut déclencher l'installation sur iPhone : on
//     montre les deux gestes (Partager › Sur l'écran d'accueil).
// Ailleurs (Firefox…), rien : on ne saurait pas dire comment faire.

import { icon } from "../icons";
import { neverOfferInstall } from "../storage/installPromptRepo";

export type InstallWay = "native" | "ios";

// L'invitation du navigateur (Chromium), qu'il nous laisse présenter.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let watching = false;
const listeners = new Set<() => void>();

// Lancée depuis l'écran d'accueil : plus rien à proposer.
export function isInstalled(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

// iPhone et iPad (un iPad récent se présente comme un Mac, mais tactile).
function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// Comment installer ici, ou null : déjà installée, ou on ne sait pas.
export function installWay(): InstallWay | null {
  if (isInstalled()) return null;
  if (deferred) return "native";
  return isIos() ? "ios" : null;
}

// Le navigateur annonce qu'il sait installer après le chargement, à son
// rythme : `onChange` est rappelé à ce moment-là, et une fois l'appli
// installée. On garde son invitation pour notre bouton, au lieu de sa
// bannière à lui.
export function watchInstall(onChange: () => void): void {
  listeners.add(onChange);
  if (watching) return;
  watching = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    for (const listener of listeners) listener();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    neverOfferInstall();
    for (const listener of listeners) listener();
  });
}

// Ouvre la boîte d'installation du navigateur (« native » seulement). Elle ne
// sert qu'une fois : le navigateur en renverra une autre s'il le juge utile.
export async function installNow(): Promise<boolean> {
  const invitation = deferred;
  if (!invitation) return false;
  deferred = null;
  await invitation.prompt();
  const { outcome } = await invitation.userChoice;
  if (outcome === "accepted") neverOfferInstall();
  return outcome === "accepted";
}

// Les deux gestes sur iPhone, dessinés comme dans Safari.
export function iosSteps(): HTMLOListElement {
  const list = document.createElement("ol");
  list.className = "install-steps";
  const step = (...content: (Node | string)[]): HTMLLIElement => {
    const li = document.createElement("li");
    li.append(...content);
    return li;
  };
  const strong = (text: string): HTMLElement => {
    const b = document.createElement("strong");
    b.textContent = text;
    return b;
  };
  list.append(
    step("Touchez ", icon("share"), " ", strong("Partager"), " dans la barre de Safari ;"),
    step("puis ", icon("addSquare"), " ", strong("Sur l'écran d'accueil"), "."),
  );
  return list;
}
