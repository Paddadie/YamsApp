// Les pictogrammes en éléments SVG, pour les écrans qui construisent leur DOM.
// Les tracés sont dans iconPaths.ts, partagés avec les pages HTML.

import { ICON_PATHS, type IconName } from "./iconPaths";

export type { IconName } from "./iconPaths";

const SVG_NS = "http://www.w3.org/2000/svg";

// Décoratif par défaut (aria-hidden) : le bouton ou le texte qui le porte dit
// déjà ce qu'il fait. Un pictogramme seul dans un bouton demande donc un
// aria-label sur le bouton.
export function icon(name: IconName, className = "ic"): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("data-icon", name);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.innerHTML = ICON_PATHS[name];
  return svg;
}

// Le trait du feutre qui entoure une valeur (objectif choisi, 50 du Yams) :
// une ellipse tracée à la main, étirée à la taille de ce qu'elle entoure.
export function handCircle(className = "hand-circle"): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 100 50");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.innerHTML =
    '<path d="M14 30C10 14 46 4 78 8s22 22 4 32-60 10-74-4C2 28 18 12 44 8" pathLength="1" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
  return svg;
}

// Gommette de rang : une pastille ronde collée, or, argent ou bronze, blanche
// au-delà du podium. Les mêmes chez les meilleurs et chez les pires (demande
// de Paul, 08/10). Remplace les médailles emoji, partout : podium,
// classements, palmarès.
export function gommette(rank: number, { big = false }: { big?: boolean } = {}): HTMLElement {
  const el = document.createElement("span");
  const tone = rank <= 3 ? String(rank) : "n";
  el.className = `gommette gommette--${tone}${big ? " gommette--big" : ""}`;
  el.textContent = String(rank);
  return el;
}

// Pictogramme sur gommette (fiches des records du 5000) : la pastille prend la
// couleur de sa famille (--gom, posée par la feuille de style).
export function iconGommette(name: IconName): HTMLElement {
  const el = document.createElement("span");
  el.className = "gommette gommette--icon";
  el.appendChild(icon(name));
  return el;
}

// Les confettis de papier de la fin de partie : des petits morceaux de couleur
// qui tombent une fois dans l'en-tête, puis restent posés. Positions fixes
// (pas de hasard) : l'écran est le même à chaque rafraîchissement.
const CONFETTI: [color: string, x: number, y: number, turn: number, round?: boolean][] = [
  ["#e9b52f", 4, 8, 20],
  ["#c2462b", 20, 12, -25, true],
  ["#2f6fb5", 37, 6, 40],
  ["#3d9142", 55, 14, -10],
  ["#c97e1c", 70, 26, 60, true],
  ["#6a1b9a", 82, 50, 15],
  ["#e9b52f", 91, 14, -35],
  ["#2f6fb5", 78, 72, 10, true],
  ["#c2462b", 93, 82, 70],
  ["#3d9142", 72, 92, -50, true],
  ["#c97e1c", 87, 104, 25],
];

export function confetti(): HTMLElement {
  const box = document.createElement("div");
  box.className = "confetti";
  box.setAttribute("aria-hidden", "true");
  CONFETTI.forEach(([color, x, y, turn, round], i) => {
    const bit = document.createElement("i");
    if (round) bit.className = "round";
    bit.style.setProperty("--c", color);
    bit.style.setProperty("--x", `${x}%`);
    bit.style.setProperty("--y", `${y}px`);
    bit.style.setProperty("--turn", `${turn}deg`);
    bit.style.setProperty("--d", `${(i % 6) * 0.07}s`);
    box.appendChild(bit);
  });
  return box;
}
