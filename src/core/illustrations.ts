// Illustrations : des dessins, pas des pictogrammes. Les pictogrammes
// (iconPaths.ts) sont des traits d'un seul ton qui suivent la couleur du texte ;
// ici, des objets du monde des dés à taille réelle — le cornet du menu, les dés
// lancés des accueils — pour que la place libre devienne une scène plutôt
// qu'un vide sur le quadrillage (direction « La table de jeu », 08/10).
// Purement décoratives : masquées aux lecteurs d'écran.
//
// Les faces viennent de dice.ts : ce sont les mêmes dés que dans la grille et
// la calculette.

import { dieFace } from "./dice";

const SVG_NS = "http://www.w3.org/2000/svg";

// Un dé posé dans un dessin : la face de dice.ts, placée et tournée.
function placedDie(face: number, x: number, y: number, size: number, turn: number): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("transform", `rotate(${turn} ${x + size / 2} ${y + size / 2})`);
  const die = dieFace(face);
  die.removeAttribute("role");
  die.removeAttribute("aria-label");
  die.setAttribute("x", String(x));
  die.setAttribute("y", String(y));
  die.setAttribute("width", String(size));
  die.setAttribute("height", String(size));
  g.appendChild(die);
  return g;
}

// Le cornet renversé, trois dés qui en sortent : la marque, à côté du nom.
// L'ouverture est tournée vers la droite, du côté des dés, un peu penchée vers
// la table : on vient de les lancer (tournée vers la gauche, elle tournait le
// dos aux dés — vu par Paul).
export function cornetIllustration(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "cornet-illustration");
  svg.setAttribute("viewBox", "0 0 90 60");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.innerHTML =
    '<ellipse class="cornet-shadow" cx="46" cy="55" rx="40" ry="3.2"/>' +
    '<g transform="rotate(100 24 37)">' +
    '<path class="cornet-cup" d="M10 22 L38 22 L33 52 L15 52 Z"/>' +
    '<path class="cornet-rim" d="M9 22 h30"/>' +
    '<path class="cornet-band" d="M13 30h22M14 37h20"/>' +
    "</g>";
  svg.append(placedDie(6, 45, 37, 14, 18), placedDie(3, 61, 33, 14, -12), placedDie(5, 75, 40, 14, 30));
  return svg;
}

// Cinq dés lancés sur la table, dans l'en-tête d'un accueil. Positions et
// angles fixes : la scène est la même à chaque visite, comme une affiche.
const SCENE_SPOTS: [left: number, top: number, turn: number][] = [
  [3, 34, -14],
  [22, 6, 9],
  [42, 40, 22],
  [61, 10, -8],
  [79, 38, 14],
];

export function diceScene(faces: number[]): HTMLElement {
  const scene = document.createElement("div");
  scene.className = "dice-scene";
  scene.setAttribute("aria-hidden", "true");
  faces.slice(0, SCENE_SPOTS.length).forEach((face, i) => {
    const [left, top, turn] = SCENE_SPOTS[i];
    const spot = document.createElement("span");
    spot.className = "scene-die";
    spot.style.left = `${left}%`;
    spot.style.top = `${top}%`;
    spot.style.setProperty("--turn", `${turn}deg`);
    const die = dieFace(face);
    die.removeAttribute("role");
    die.removeAttribute("aria-label");
    spot.appendChild(die);
    scene.appendChild(spot);
  });
  return scene;
}
