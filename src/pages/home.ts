// Menu des jeux : une tuile par entrée du registre, avec sa partie en cours
// quand il y en a une. C'est le seul écran qui connaisse la liste des jeux —
// ajouter un troisième jeu ne demande pas d'y toucher.
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).

import { bootstrap } from "../core/bootstrap";
import { requireEl } from "../core/ui";
import { GAMES } from "../games/registry";
import type { GameDef } from "../games/types";

bootstrap();

const list = requireEl<HTMLUListElement>("game-list");

function buildTile(game: GameDef): HTMLLIElement {
  const resume = game.resume();

  const tile = document.createElement("li");
  tile.className = "game-tile";
  tile.style.setProperty("--accent", game.accent);

  const link = document.createElement("a");
  link.className = "game-link";
  link.href = game.pages.home;

  const icon = document.createElement("span");
  icon.className = "game-icon";
  icon.textContent = game.icon;
  icon.setAttribute("aria-hidden", "true");

  const title = document.createElement("span");
  title.className = "game-title";
  title.textContent = game.title;

  const tagline = document.createElement("span");
  tagline.className = "game-tagline";
  tagline.textContent = game.tagline;

  const text = document.createElement("span");
  text.className = "game-text";
  text.append(title, tagline);

  link.append(icon, text);
  tile.appendChild(link);

  // La reprise est une seconde entrée, sous la tuile : elle mène directement à
  // l'écran de partie, sans repasser par l'accueil du jeu.
  if (resume) {
    const resumeLink = document.createElement("a");
    resumeLink.className = "game-resume";
    resumeLink.href = game.pages.play;
    resumeLink.append("▶ Reprendre · ", resume.playerNames.join(", "));
    tile.appendChild(resumeLink);
  }

  return tile;
}

/* ---------- Mise en route ---------- */

list.replaceChildren(...GAMES.map(buildTile));
