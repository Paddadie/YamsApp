// Classement de fin de partie, commun aux jeux : deux joueurs à égalité
// partagent le même rang, et le rang suivant est sauté (1, 1, 3) — c'est ce qui
// donne deux 🥇 à une victoire partagée au lieu de départager au hasard de
// l'ordre de passage.

// Rangs d'une liste de scores DÉJÀ triée par ordre décroissant.
export function sharedRanks(sortedScores: number[]): number[] {
  const ranks: number[] = [];
  sortedScores.forEach((score, i) => {
    ranks.push(i > 0 && score === sortedScores[i - 1] ? ranks[i - 1] : i + 1);
  });
  return ranks;
}

// Les trois premiers du classement dans l'ordre où le podium les pose : 2e à
// gauche, 1er au centre, 3e à droite. Une place de podium n'est pas un rang :
// à égalité, deux vainqueurs occupent le centre et la gauche, et c'est leur
// rang (pas leur place) qui décide de la médaille et de la hauteur de marche.
export function podiumOrder<T>(sortedRows: T[]): T[] {
  return [sortedRows[1], sortedRows[0], sortedRows[2]].filter(
    (row): row is T => row !== undefined,
  );
}
