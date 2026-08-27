// Toute la persistance localStorage passe par ce module :
// une seule liste de clés, et des accesseurs typés par usage.

const KEYS = {
  savedGame: "yams-saved-game",
  knownNames: "yams-player-names",
  bestScores: "bestScores",
  worstScores: "worstScores",
};

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---------- Partie en cours ---------- */

export function getSavedGame() {
  return read(KEYS.savedGame);
}

export function saveSavedGame(state) {
  write(KEYS.savedGame, state);
}

export function clearSavedGame() {
  localStorage.removeItem(KEYS.savedGame);
}

export function hasSavedGame() {
  return localStorage.getItem(KEYS.savedGame) !== null;
}

/* ---------- Joueurs connus ---------- */

export function getKnownNames() {
  return read(KEYS.knownNames) || [];
}

export function addKnownName(name) {
  const names = getKnownNames();
  if (names.includes(name)) return;
  names.push(name);
  names.sort((a, b) => a.localeCompare(b));
  write(KEYS.knownNames, names);
}

/* ---------- Hall of Fame ---------- */

export function getBestScores() {
  return read(KEYS.bestScores) || [];
}

export function getWorstScores() {
  return read(KEYS.worstScores) || [];
}

export function saveBestScores(list) {
  write(KEYS.bestScores, list);
}

export function saveWorstScores(list) {
  write(KEYS.worstScores, list);
}
