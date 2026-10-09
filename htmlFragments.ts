// Fragments HTML communs aux pages, injectés au build par le plugin
// `cornet-shared-head` de vite.config.ts (et par le harnais des tests de
// pages). Une page multi-pages n'a pas de gabarit : sans ça, chaque morceau
// commun serait recopié dans chaque fichier, et finirait par diverger.
//
//   <!--@head-->        le <head> commun (viewport, icône, réglages PWA iOS) ;
//   <!--@icon:nom-->    un pictogramme de src/core/iconPaths.ts (info, pause,
//                       home, trophy…), le même que ceux posés par les écrans.
//
// Les pictogrammes sont dessinés et non écrits : les caractères ⓘ ou ⏸ sont
// rendus par la police emoji de l'appareil, de taille variable, et ne
// s'affichaient pas du tout sur certains. `currentColor` leur fait suivre la
// couleur du texte de leur bouton.

import { iconMarkup, isIconName } from "./src/core/iconPaths";

// Le papier de l'application (--paper) : la barre d'adresse se confond avec
// le fond des écrans. Pendant une partie, l'écran la repeint à la couleur du
// joueur.
// Icônes (audit du 09/10) : le cornet du menu sur l'écran d'accueil
// (apple-touch-icon, et le manifeste dans vite.config.ts), le dé seul dans
// l'onglet du navigateur, où le cornet ne se lirait plus.
export const COMMON_HEAD = `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <link rel="icon" href="/favicon-48.png" sizes="48x48" type="image/png" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="theme-color" content="#f3efe6" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Cornet" />`;

// Un marqueur inconnu fait échouer le build plutôt que de laisser un trou dans
// la page.
export function expandFragments(html: string): string {
  return html
    .replace("<!--@head-->", COMMON_HEAD)
    .replace(/<!--@icon:([\w-]+)-->/g, (_, name: string) => {
      if (!isIconName(name)) throw new Error(`Pictogramme inconnu : <!--@icon:${name}-->`);
      return iconMarkup(name);
    });
}
