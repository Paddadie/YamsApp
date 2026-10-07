// Faces de dé dessinées, communes aux jeux : le Yams s'en sert pour libeller sa
// section « Chiffres », le 5000 pour montrer les dés d'un lancer.
//
// SVG inline et non un caractère Unicode (⚀⚁⚂…) : ces glyphes sont rendus par
// la police emoji du système, donc minuscules sur iOS et différents d'un
// appareil à l'autre. Ici la face est dessinée, elle suit la taille du texte qui
// l'entoure et reste nette à tout zoom. C'est la même raison qui vaut pour le
// chevron du sélecteur de jeu et le pictogramme des règles.

const SVG_NS = "http://www.w3.org/2000/svg";

// Rayon commun à tous les points : une face 1 avec un gros point serait plus
// fidèle à un vrai dé, mais côte à côte dans une colonne les six faces doivent
// se lire comme un même dé qu'on retourne.
const PIP_RADIUS = 10;

// Points de chaque face, dans un carré de 100×100. Colonnes et rangées sont aux
// mêmes coordonnées d'une face à l'autre — c'est ce qui fait qu'on lit un même
// dé et non six dessins. Seule la face 6 écarte ses rangées : à trois points par
// colonne, l'écart standard les laissait se frôler.
const DIE_PIPS: Record<string, [number, number][]> = {
  "1": [[50, 50]],
  "2": [[30, 30], [70, 70]],
  "3": [[30, 30], [50, 50], [70, 70]],
  "4": [[30, 30], [70, 30], [30, 70], [70, 70]],
  "5": [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  "6": [[30, 25], [70, 25], [30, 50], [70, 50], [30, 75], [70, 75]],
};

// `label` : ce que le dé remplace pour un lecteur d'écran. Au Yams c'est le nom
// de la ligne, au 5000 la valeur du dé.
export function dieFace(value: string | number, label = String(value)): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "die");
  svg.setAttribute("viewBox", "0 0 100 100");
  // Le dé remplace un texte : sans ça la ligne n'a plus de libellé annoncé.
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);

  const face = document.createElementNS(SVG_NS, "rect");
  face.setAttribute("class", "die-face");
  // Le contour est centré sur le bord : on rentre la face d'une demi-épaisseur,
  // sinon il est rogné par la boîte du SVG.
  face.setAttribute("x", "3");
  face.setAttribute("y", "3");
  face.setAttribute("width", "94");
  face.setAttribute("height", "94");
  face.setAttribute("rx", "20");
  svg.appendChild(face);

  for (const [cx, cy] of DIE_PIPS[String(value)] ?? []) {
    const pip = document.createElementNS(SVG_NS, "circle");
    pip.setAttribute("class", "die-pip");
    pip.setAttribute("cx", String(cx));
    pip.setAttribute("cy", String(cy));
    pip.setAttribute("r", String(PIP_RADIUS));
    svg.appendChild(pip);
  }
  return svg;
}
