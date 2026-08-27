// Toutes les clés localStorage de l'application, à un seul endroit.
// (bestScores / worstScores n'ont pas le préfixe "yams-" pour rester
// compatibles avec les données déjà enregistrées sur les appareils.)

export const STORAGE_KEYS = {
  draft: "yams-draft",
  savedGame: "yams-saved-game",
  knownNames: "yams-player-names",
  playerStats: "yams-player-stats",
  bestScores: "bestScores",
  worstScores: "worstScores",
} as const;
