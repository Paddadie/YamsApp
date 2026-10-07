// Couleurs attribuées aux joueurs d'une partie, communes à tous les jeux : le
// fond plein écran du tour est la signature visuelle de l'application, le 5000
// la reprend telle quelle.
//
// Palette construite, pas choisie teinte par teinte : dix teintes réparties
// tous les 36°, à deux niveaux de clarté qui alternent (OKLab L = 0,865 et
// 0,935), chroma poussé au maximum que le sRGB accepte à cette clarté. Ces
// couleurs servent de fond plein écran pendant le tour d'un joueur : elles
// doivent rester très claires (contraste ≥ 13:1 avec le texte noir) et
// régulières, sinon un joueur hérite d'un écran blanc et un autre d'un écran
// franchement teinté. L'ordre avance de 144° d'un joueur au suivant pour que
// les premiers de la table tombent sur des teintes très éloignées.
export const PLAYER_COLORS = [
  "#FCC1C7", // rose
  "#A5E4BB", // vert
  "#DAC8FC", // violet
  "#EDCF92", // miel
  "#9ADEFC", // cyan
  "#FEE3D6", // abricot
  "#A4FCF8", // menthe
  "#FEDFF5", // framboise
  "#E2F3B2", // olive
  "#E0EAFE", // bleu
];
