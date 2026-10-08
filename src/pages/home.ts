// Menu des jeux : une carte par entrée du registre, avec sa partie en cours
// quand il y en a une. C'est le seul écran qui connaisse la liste des jeux —
// ajouter un troisième jeu ne demande pas d'y toucher.
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).

import { bootstrap } from "../core/bootstrap";
import { icon } from "../core/icons";
import { cornetIllustration } from "../core/illustrations";
import { playerDots, requireEl } from "../core/ui";
import { GAMES, gameById } from "../games/registry";
import { getLastWin } from "../core/storage/lastWinRepo";
import { formatDate } from "../core/dates";
import { formatScore } from "../core/format";
import type { GameDef } from "../games/types";
import { resumeProgress, sheetSample } from "./gameHero";
import { applyGameTheme } from "./gameTheme";

bootstrap();

const list = requireEl<HTMLUListElement>("game-list");

function span(className: string, text: string): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  return el;
}

// Une carte = un feuillet du bloc de ce jeu : son nom à son encre, son
// accroche, un extrait de sa feuille.
function buildTile(game: GameDef): HTMLLIElement {
  const resume = game.resume();

  const tile = document.createElement("li");
  tile.className = "game-tile sheet perf-top";
  applyGameTheme(tile, game);

  const link = document.createElement("a");
  link.className = "game-link";
  link.href = game.pages.home;

  const text = document.createElement("span");
  text.className = "game-text";
  text.append(span("game-title", game.title), span("game-tagline", game.tagline));

  const sample = sheetSample(game.sample);
  sample.setAttribute("aria-hidden", "true");

  link.append(text, sample);
  tile.appendChild(link);

  // La reprise est une seconde entrée, sous la carte : elle mène directement à
  // l'écran de partie, sans repasser par l'accueil du jeu.
  if (resume) {
    const resumeLink = document.createElement("a");
    resumeLink.className = "game-resume";
    resumeLink.href = game.pages.play;
    resumeLink.setAttribute(
      "aria-label",
      `Reprendre la partie de ${game.title} : ${resume.playerNames.join(", ")}` +
        (resume.progress ? `. ${resume.progress.label}` : ""),
    );
    const go = span("game-resume-go", "Reprendre");
    go.appendChild(icon("chevronRight"));
    // Les noms, et dessous où en est la partie.
    const text = span("game-resume-text", "");
    text.appendChild(span("game-resume-names", resume.playerNames.join(", ")));
    const progress = resumeProgress(resume);
    if (progress) text.appendChild(progress);
    resumeLink.append(playerDots(resume.playerColors), text, go);
    tile.appendChild(resumeLink);
  }

  return tile;
}

// Le post-it « Dernière victoire » : qui, à quel jeu, avec combien, et quand.
// Le menu raconte la soirée en cours. Absent tant qu'aucune partie n'est
// finie (ou si le jeu n'existe plus).
function renderLastWin(): void {
  const win = getLastWin();
  const game = win ? gameById(win.gameId) : undefined;
  if (!win || !game) return;
  const box = requireEl("last-win");
  const who = document.createElement("strong");
  who.className = "last-win-who";
  // « Alice », « Alice et Bob », « Alice, Bob et Chloé ».
  const names = win.winners;
  who.textContent =
    names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}` : names[0];
  box.replaceChildren(
    span("last-win-label", "Dernière victoire"),
    who,
    ` au ${game.title} · ${formatScore(win.score)}`,
    span("last-win-date", formatDate(win.date)),
  );
  box.hidden = false;
}

/* ---------- Mise en route ---------- */

requireEl("brand-mark").appendChild(cornetIllustration());
list.replaceChildren(...GAMES.map(buildTile));
renderLastWin();
