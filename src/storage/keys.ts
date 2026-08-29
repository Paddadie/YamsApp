// Toutes les clés localStorage de l'application, à un seul endroit.
// (bestScores / worstScores n'ont pas le préfixe "yams-" pour rester
// compatibles avec les données déjà enregistrées sur les appareils.)

export const STORAGE_KEYS = {
  schemaVersion: "yams-schema-version",
  draft: "yams-draft",
  savedGame: "yams-saved-game",
  lastRoster: "yams-last-roster",
  knownNames: "yams-player-names",
  playerStats: "yams-player-stats",
  rules: "yams-rules",
  bestScores: "bestScores",
  worstScores: "worstScores",
} as const;
