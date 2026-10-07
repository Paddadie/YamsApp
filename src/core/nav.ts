// Navigation entre pages. Chaque écran est un vrai fichier HTML.
//
// Règle : une navigation SANS effet de bord se fait par un simple <a href> dans
// le HTML (marche même avant le chargement du JS). `goTo()` n'est utilisé que
// pour les navigations qui suivent une écriture (sauvegarde d'un brouillon,
// d'une partie, etc.).
//
// Les écrans propres à un jeu portent son préfixe (`yams…`), les écrans communs
// n'en ont pas : un nouveau jeu ajoute ses entrées sans toucher aux autres.

export type Page =
  | "home"
  | "players"
  | "settings"
  | "yamsHome"
  | "yamsGame"
  | "yamsEnd"
  | "yamsHall"
  | "g5000Home"
  | "g5000Game"
  | "g5000End"
  | "g5000Records";

const PAGE_FILES: Record<Page, string> = {
  home: "index.html",
  players: "players.html",
  settings: "settings.html",
  yamsHome: "yams.html",
  yamsGame: "yams-game.html",
  yamsEnd: "yams-end.html",
  yamsHall: "yams-hall.html",
  g5000Home: "5000.html",
  g5000Game: "5000-game.html",
  g5000End: "5000-end.html",
  g5000Records: "5000-records.html",
};

export function goTo(page: Page): void {
  location.href = PAGE_FILES[page];
}
