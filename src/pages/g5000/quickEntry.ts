// La saisie manuelle du 5000 : « les paliers » (refonte du 08/10/2026). Pour
// qui a déjà compté son tour : il ne compose plus son score, il le choisit —
// le millier, puis la case. Deux touches au plus, une seule sous 1 000 (huit
// tours sur dix). L'ancienne « addition posée » demandait de décomposer le
// total (1 850 = 1 000 + 500 + 100 + 100 + 100 + 50) : de l'arithmétique à
// rebours, au moment où l'on veut juste écrire un nombre.
//
// Chaque case annonce ce qu'elle ferait : pile sur un adversaire (Sniper),
// victoire, ou refusée (entrée en jeu, Sans demi-mesure, Dans le mille). Les
// règles de la partie se voient au lieu d'arriver en message d'erreur. Elle ne
// connaît pas les mains pleines : on entre son total final (décision de Paul).
//
// L'écran de partie la crée, lui donne de quoi finir le tour, et lui demande
// son brouillon quand la main change.

import { requireEl } from "../../core/ui";
import { icon } from "../../core/icons";
import {
  bankOutcome,
  canBank,
  enterTurn,
  isOvershoot,
  tieTargets,
  type TurnFinish,
} from "../../games/g5000/engine";
import { highestThousand, SCORE_STEP } from "../../games/g5000/rules";
import type { G5000Game } from "../../games/g5000/types";
import { afterLine, bankLabel, potWarning, unbreakable } from "./calculator";

export interface QuickEntryHooks {
  // Le tour se termine, sur le pot de `game.turn` (cf. finishTurn du moteur).
  onFinish(how: TurnFinish): void;
  // Où le pot mènerait le joueur : en hachuré sur la jauge du bandeau.
  previewPot(pot: number): void;
  format(value: number): string;
}

// Une grille par millier : vingt scores de 50 en 50, deux centaines par ligne
// (x00, x50, y00, y50) — l'œil trouve les centaines, les « 50 » sont à côté.
const THOUSAND = 1000;
const OFFSETS = Array.from({ length: THOUSAND / SCORE_STEP }, (_, i) => i * SCORE_STEP);

const SVG_NS = "http://www.w3.org/2000/svg";

// Le score choisi est entouré au feutre, comme l'objectif sur l'accueil.
function handCircle(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "pal-circle");
  svg.setAttribute("viewBox", "0 0 100 60");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("pathLength", "1");
  path.setAttribute(
    "d",
    "M58 6 C 84 5, 97 17, 95 31 C 93 47, 72 56, 47 55 C 21 54, 4 45, 5 29 C 6 15, 25 6, 52 6 C 60 6, 66 8, 70 10",
  );
  svg.appendChild(path);
  return svg;
}

export function createQuickEntry(game: G5000Game, hooks: QuickEntryHooks) {
  const dialog = requireEl<HTMLDialogElement>("quick-dialog");
  const thousands = requireEl("quick-thousands");
  const grid = requireEl("quick-grid");
  const after = requireEl("quick-after");
  const bank = requireEl<HTMLButtonElement>("quick-bank");
  const bust = requireEl<HTMLButtonElement>("quick-bust");
  const fmt = hooks.format;

  // Le millier affiché, et la part choisie en dessous (0 à 950), ou rien.
  let base = 0;
  let picked: number | null = null;
  // Le brouillon survit à une saisie refermée par erreur (la flèche du haut) :
  // il appartient à ce joueur jusqu'à la fin de son tour.
  let owner: number | null = null;
  // Le cercle ne se trace qu'au moment du choix, pas à chaque rendu.
  let justPicked = false;

  const value = (): number => (picked === null ? 0 : base + picked);

  /* ---------- Les milliers ---------- */

  // De « moins de 1 000 » au plus haut millier permis : la rangée défile, le
  // suivant dépasse à moitié pour dire qu'il y a une suite.
  function buildThousands(): void {
    thousands.replaceChildren();
    for (let b = 0; b <= highestThousand(game.rules.target); b += THOUSAND) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pal-th";
      button.dataset.thousand = String(b);
      button.setAttribute("role", "radio");
      const small = document.createElement("small");
      if (b === 0) {
        small.textContent = "moins de";
        button.append(small, fmt(THOUSAND));
      } else {
        small.textContent = "et plus";
        button.append(fmt(b), small);
      }
      button.addEventListener("click", () => pickThousand(b));
      thousands.appendChild(button);
    }
  }

  // Le millier change, la case reste : 500 puis « 1 000 » donne 1 500.
  function pickThousand(b: number): void {
    if (b === base) return;
    base = b;
    if (picked !== null && value() === 0) picked = null;
    justPicked = picked !== null;
    grid.classList.remove("is-flip");
    void grid.offsetWidth; // relance le petit tressautement de la grille
    grid.classList.add("is-flip");
    render();
    showThousand("smooth");
  }

  // Le millier choisi reste en vue dans la rangée qui défile.
  function showThousand(behavior: ScrollBehavior): void {
    const button = thousands.querySelector<HTMLElement>(`[data-thousand="${base}"]`);
    if (!button) return;
    const left = button.offsetLeft - thousands.clientWidth / 2 + button.offsetWidth / 2;
    thousands.scrollTo({ left: Math.max(0, left), behavior });
  }

  /* ---------- La grille ---------- */

  function buildGrid(): void {
    grid.replaceChildren();
    for (const offset of OFFSETS) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.dataset.offset = String(offset);
      tile.setAttribute("role", "radio");
      tile.addEventListener("click", () => pickTile(offset));
      grid.appendChild(tile);
    }
  }

  // Toucher la case choisie la relâche.
  function pickTile(offset: number): void {
    picked = picked === offset ? null : offset;
    justPicked = picked !== null;
    render();
  }

  // Ce que la case ferait, d'avance : sur qui elle tombe pile, si elle gagne,
  // et pourquoi elle ne se banquerait pas.
  function renderTile(tile: HTMLButtonElement): void {
    const offset = Number(tile.dataset.offset);
    const points = base + offset;
    const chosen = picked === offset;
    tile.className = offset % 100 ? "pal-tile is-half" : "pal-tile";
    tile.replaceChildren();
    tile.setAttribute("aria-checked", String(chosen));
    // « 0 » sous 1 000 : pas un score, une case vide.
    tile.disabled = points === 0;
    if (points === 0) {
      tile.removeAttribute("aria-label");
      return;
    }

    const label = document.createElement("span");
    label.className = "pal-v";
    label.textContent = fmt(points);
    tile.appendChild(label);

    const notes: string[] = [];
    const marks = document.createElement("span");
    marks.className = "pal-marks";
    const hits = tieTargets(game, points).filter((t) => t.needed === 0);
    if (hits.length > 0) {
      tile.classList.add("is-aim");
      for (const hit of hits) {
        const dot = document.createElement("i");
        dot.className = "pal-dot";
        dot.style.background = game.players[hit.index].color;
        marks.appendChild(dot);
      }
      notes.push(`pile sur ${hits.map((h) => h.name).join(" et ")}`);
    }
    const bankable = canBank(game, points, false);
    if (bankable && bankOutcome(game, points)) {
      tile.classList.add("is-win");
      marks.appendChild(icon("trophy", "ic pal-trophy"));
      notes.push("objectif atteint");
    }
    if (!bankable) {
      tile.classList.add(isOvershoot(game, points) ? "is-over" : "is-blocked");
      notes.push("ne se banque pas");
    }
    if (marks.childElementCount > 0) tile.appendChild(marks);

    if (chosen) {
      tile.classList.add("is-picked");
      tile.appendChild(handCircle());
      if (justPicked) tile.classList.add("is-drawing");
    }
    tile.setAttribute("aria-label", [`${fmt(points)} points`, ...notes].join(", "));
  }

  /* ---------- Rendu ---------- */

  function render(): void {
    const me = game.players[game.currentPlayerIndex];
    const pot = value();
    requireEl("quick-title").textContent = `Tour de ${me.name}`;

    for (const button of thousands.querySelectorAll<HTMLButtonElement>(".pal-th")) {
      const on = Number(button.dataset.thousand) === base;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-checked", String(on));
    }
    for (const tile of grid.querySelectorAll<HTMLButtonElement>("button")) renderTile(tile);
    justPicked = false;

    renderAfter(pot);
    const bankable = pot > 0 && canBank(game, pot, false);
    bank.replaceChildren(...bankLabel(game, pot, fmt));
    bank.disabled = !bankable;
    bust.textContent = pot > 0 ? `Bust · ${fmt(pot)}` : "Bust";
    hooks.previewPot(pot);
  }

  // La ligne sous la grille : ce qui se passera si l'on banque, ou pourquoi on
  // ne peut pas. Tomber pile sur quelqu'un s'annonce (Sniper).
  function renderAfter(pot: number): void {
    after.className = "pot-after";
    if (pot === 0) {
      after.replaceChildren("Touchez votre score.");
      return;
    }
    const warning = potWarning(game, pot, fmt);
    if (warning) {
      after.replaceChildren(unbreakable(warning));
      after.classList.add("is-warning");
      return;
    }
    const hits = tieTargets(game, pot).filter((t) => t.needed === 0);
    if (hits.length > 0) {
      const names = hits.map((h) => h.name).join(" et ");
      after.replaceChildren(
        icon("crosshair"),
        unbreakable(`Pile sur ${names} : ${hits.length > 1 ? "ils redescendent" : "redescend"} !`),
      );
      after.classList.add("is-hit");
      return;
    }
    const line = afterLine(game, pot, fmt);
    const text = unbreakable(line.text);
    after.replaceChildren(...(line.win ? [icon("trophy"), text] : [text]));
    if (line.win) after.classList.add("is-win");
  }

  /* ---------- Ouvrir, finir ---------- */

  function open(): void {
    // Le brouillon d'un autre joueur ne se reprend pas.
    if (owner !== game.currentPlayerIndex) clear();
    owner = game.currentPlayerIndex;
    render();
    // Sans voile : posée en bas de l'écran (cf. game.ts).
    dialog.show();
    // L'ouverture donnerait le focus au premier millier, cerné comme s'il
    // venait d'être choisi : il va à la saisie elle-même (tabindex="-1").
    // Sans faire défiler l'écran pour l'amener en vue : la barre du haut
    // disparaissait (l'écran entier est la page).
    dialog.focus({ preventScroll: true });
    showThousand("instant");
  }

  // Le score choisi devient le pot du tour — perdu sur « Bust », il compte pour
  // le record du pot perdu comme celui de la calculette.
  function finish(how: TurnFinish): void {
    enterTurn(game, value());
    hooks.onFinish(how);
  }

  // Oublie le brouillon : fin du tour, main passée, tour repris.
  function clear(): void {
    base = 0;
    picked = null;
    owner = null;
    thousands.scrollLeft = 0;
  }

  // Le score choisi par le joueur qui a la main, s'il en a choisi un : un tour
  // entamé, que changer de joueur ou reprendre un tour ferait perdre.
  function draftPot(): number | null {
    return owner === game.currentPlayerIndex && picked !== null ? value() : null;
  }

  /* ---------- Mise en route ---------- */

  buildThousands();
  buildGrid();
  bank.addEventListener("click", () => {
    if (!bank.disabled) finish("bank");
  });
  bust.addEventListener("click", () => finish("bust"));
  requireEl("quick-close").addEventListener("click", () => dialog.close());
  // Saisie refermée sans banquer : plus de pot à montrer sur la jauge.
  dialog.addEventListener("close", () => hooks.previewPot(0));

  return {
    open,
    close: () => dialog.close(),
    clear,
    draftPot,
    // Le Bust de la barre du bas, quand un score est déjà choisi : il est perdu.
    bust: () => finish("bust"),
    dialog,
  };
}
