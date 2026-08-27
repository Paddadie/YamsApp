// Toutes les clés localStorage de l'application, à un seul endroit.
// (Les deux dernières n'ont pas le préfixe "yams-" pour rester compatibles
// avec les données déjà enregistrées sur les appareils des utilisateurs.)

export const STORAGE_KEYS = {
  savedGame: "yams-saved-game",
  knownNames: "yams-player-names",
  bestScores: "bestScores",
  worstScores: "worstScores",
} as const;
