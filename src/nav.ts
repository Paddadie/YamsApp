// Navigation entre pages. Chaque écran est un vrai fichier HTML.
//
// Règle : une navigation SANS effet de bord se fait par un simple <a href> dans
// le HTML (marche même avant le chargement du JS). `goTo()` n'est utilisé que
// pour les navigations qui suivent une écriture (sauvegarde d'un brouillon,
// d'une partie, etc.).

export type Page = "home" | "players" | "game" | "end" | "hall" | "settings";

export const PAGE_FILES: Record<Page, string> = {
  home: "index.html",
  players: "players.html",
  game: "game.html",
  end: "end.html",
  hall: "hall.html",
  settings: "settings.html",
};

export function goTo(page: Page): void {
  location.href = PAGE_FILES[page];
}
