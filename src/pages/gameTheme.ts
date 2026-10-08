// Les couleurs d'un jeu sur ses pages : son encre (`--accent` : titre de la
// barre, entourés, surlignés) et son papier (`--accent-paper` : fond des
// en-têtes). Posées sur l'écran, que tout ce qu'il contient en hérite.
//
// Un seul endroit, appelé par chaque page d'un jeu : posées à la main page par
// page, elles avaient été oubliées sur la grille du Yams (« YAMS » à l'encre
// noire quand « 5000 » était à la sienne), les joueurs, les fins de partie et
// le palmarès du Yams.

import type { GameDef } from "../games/types";

export function applyGameTheme(
  screen: HTMLElement,
  game: Pick<GameDef, "accent" | "accentPaper">,
): void {
  screen.style.setProperty("--accent", game.accent);
  screen.style.setProperty("--accent-paper", game.accentPaper);
}
