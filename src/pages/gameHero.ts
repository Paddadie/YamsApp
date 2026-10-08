// En-tête de l'accueil d'un jeu, et l'extrait de feuille qui illustre ce jeu
// au menu comme sur son accueil. Tout vient du registre (GameDef : nom,
// encre, accroche, extrait) : un jeu ajouté n'a rien à écrire ici.

import { dieFace } from "../core/dice";
import { handCircle } from "../core/icons";
import { diceScene } from "../core/illustrations";
import { playerDots, requireEl } from "../core/ui";
import { gameById } from "../games/registry";
import type { ResumeInfo, SheetSampleLine } from "../games/types";
import { setupGameSwitcher } from "./gameSwitcher";
import { applyGameTheme } from "./gameTheme";

// Quelques lignes d'une feuille du jeu, avec les gestes du marqueur : le 50
// entouré du Yams, la rature et le score surligné du 5000. Décoratif : le
// conteneur est masqué aux lecteurs d'écran.
export function sheetSample(lines: SheetSampleLine[]): HTMLElement {
  const column = lines.every((line) => line.label === undefined);
  const sample = document.createElement("div");
  sample.className = column ? "sheet-sample sheet-sample--column" : "sheet-sample";

  for (const line of lines) {
    const row = document.createElement("div");
    row.className = "sample-line";

    if (!column) {
      const label = document.createElement("span");
      label.className = "sample-label";
      if (line.die) label.appendChild(dieFace(line.die));
      label.append(line.label ?? "");
      row.appendChild(label);
    }

    const value = document.createElement("span");
    value.className = "sample-value";
    value.textContent = line.value;
    if (line.mark === "strike") value.classList.add("is-struck");
    if (line.mark === "live") value.classList.add("hl");
    if (line.mark === "circle") {
      value.classList.add("circled");
      value.appendChild(handCircle());
    }
    row.appendChild(value);
    sample.appendChild(row);
  }
  return sample;
}

// L'en-tête d'un accueil : le sélecteur de jeu (titre), l'accroche, l'extrait
// de feuille s'il y a sa place (le 5000 y met son objectif). L'encre du jeu
// est posée sur tout l'écran : titre, entourés et surlignés la reprennent.
export function setupGameHero(gameId: string): void {
  const game = gameById(gameId);
  if (!game) return;
  applyGameTheme(requireEl("home-screen"), game);
  requireEl("game-tagline").textContent = game.tagline;
  document.getElementById("game-sample")?.replaceChildren(sheetSample(game.sample));
  document.getElementById("game-scene")?.replaceChildren(diceScene(game.sceneDice));
  setupGameSwitcher(gameId);
}

// La carte « Partie en cours » de l'accueil : qui joue (pastilles de couleur
// et noms), et le bouton « Reprendre », que la page branche elle-même.
export function showResumeCard(resume: ResumeInfo | null): void {
  if (!resume) return;
  const names = document.createElement("span");
  names.className = "resume-names";
  names.textContent = resume.playerNames.join(", ");
  requireEl("resume-who").replaceChildren(playerDots(resume.playerColors), names);
  const progress = resumeProgress(resume);
  if (progress) requireEl("resume-who").after(progress);
  requireEl("resume-card").hidden = false;
}

// Où en est la partie : « Tour 6 sur 13 » ou « Bob mène · 3 100 », et une
// jauge fine à l'encre du jeu. Carte « Partie en cours » de l'accueil et du
// menu.
export function resumeProgress(resume: ResumeInfo): HTMLElement | null {
  if (!resume.progress) return null;
  const box = document.createElement("span");
  box.className = "resume-progress";
  const label = document.createElement("span");
  label.className = "resume-progress-label";
  label.textContent = resume.progress.label;
  const track = document.createElement("span");
  track.className = "resume-progress-track";
  track.setAttribute("aria-hidden", "true");
  const fill = document.createElement("i");
  fill.style.width = `${Math.round(Math.min(1, Math.max(0, resume.progress.ratio)) * 100)}%`;
  track.appendChild(fill);
  box.append(label, track);
  return box;
}
