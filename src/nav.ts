// Navigation entre pages. Chaque écran est un vrai fichier HTML ; on change
// de page par un chargement complet. Les URL sont relatives pour rester
// valides sous le préfixe /YamsApp/ de GitHub Pages.

export type Page = "home" | "players" | "game" | "end" | "hall";

const PAGE_FILES: Record<Page, string> = {
  home: "index.html",
  players: "players.html",
  game: "game.html",
  end: "end.html",
  hall: "hall.html",
};

export function goTo(page: Page): void {
  location.href = PAGE_FILES[page];
}
