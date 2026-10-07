// Fragments HTML communs aux pages, injectés au build par le plugin
// `cornet-shared-head` de vite.config.ts (et par le harnais des tests de
// pages). Une page multi-pages n'a pas de gabarit : sans ça, chaque morceau
// commun serait recopié dans chaque fichier, et finirait par diverger.
//
//   <!--@head-->        le <head> commun (viewport, icône, réglages PWA iOS) ;
//   <!--@icon:info-->   pictogramme ⓘ (règles, aide) ;
//   <!--@icon:pause-->  pictogramme pause.
//
// Les pictogrammes sont dessinés et non écrits : les caractères ⓘ ou ⏸ sont
// rendus par la police emoji de l'appareil, de taille variable, et ne
// s'affichaient pas du tout sur certains. `currentColor` leur fait suivre la
// couleur du texte de leur bouton.

export const COMMON_HEAD = `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <link rel="icon" href="/de.png" />
    <meta name="theme-color" content="#ffffff" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Cornet" />`;

const RING = `<circle cx="12" cy="12" r="10.6" fill="none" stroke="currentColor" stroke-width="2" />`;

export const ICONS: Record<string, string> = {
  info: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${RING}<circle cx="12" cy="6.9" r="1.45" fill="currentColor" /><line x1="12" y1="10.5" x2="12" y2="17.3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>`,
  pause: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${RING}<rect x="8.3" y="7.4" width="2.5" height="9.2" rx="1" fill="currentColor" /><rect x="13.2" y="7.4" width="2.5" height="9.2" rx="1" fill="currentColor" /></svg>`,
};

// Un marqueur inconnu fait échouer le build plutôt que de laisser un trou dans
// la page.
export function expandFragments(html: string): string {
  return html
    .replace("<!--@head-->", COMMON_HEAD)
    .replace(/<!--@icon:([\w-]+)-->/g, (_, name: string) => {
      const svg = ICONS[name];
      if (!svg) throw new Error(`Pictogramme inconnu : <!--@icon:${name}-->`);
      return svg;
    });
}
