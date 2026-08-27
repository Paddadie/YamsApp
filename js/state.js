// Modèle de la partie en cours : joueurs, variantes retenues, joueur actif.
// Les modules d'écran lisent `game` et mutent via les fonctions ci-dessous.

const PLAYER_COLORS = [
  "#FADADD",
  "#AEC6CF",
  "#BFD8B8",
  "#FFFACD",
  "#E6E6FA",
  "#FFDAB9",
  "#AAF0D1",
  "#D8B7DD",
  "#FFBCB3",
  "#C1D3D8",
];

export const game = {
  players: [],
  variants: [],
  currentPlayerIndex: 0,
};

function emptyScores(variants) {
  const scores = {};
  for (const variant of variants) scores[variant] = {};
  return scores;
}

// Ajoute un joueur s'il n'est pas déjà présent. Renvoie true si ajouté.
export function addPlayer(name) {
  if (game.players.some((p) => p.name === name)) return false;
  game.players.push({
    name,
    color: PLAYER_COLORS[game.players.length % PLAYER_COLORS.length],
    scores: emptyScores(game.variants),
  });
  return true;
}

export function removePlayer(index) {
  game.players.splice(index, 1);
}

// Réinitialise les grilles des joueurs déjà saisis pour les variantes retenues.
export function resetPlayersScores() {
  for (const player of game.players) {
    player.scores = emptyScores(game.variants);
  }
}
