// Toutes les clés localStorage de l'application, à un seul endroit.
//
// Le préfixe ne dit PAS à quel jeu la donnée appartient : `yams-player-names`
// et `yams-draft` sont communs à toute l'application, et `bestScores` /
// `worstScores` n'ont aucun préfixe alors qu'ils sont propres au Yams. Ces noms
// datent de l'époque où l'application ne portait qu'un jeu, et ils ne sont
// délibérément PAS renommés : les clés n'ont jamais changé depuis la première
// version, et renommer voudrait dire copier puis supprimer, donc risquer de
// perdre les données de tout le monde pour un gain purement cosmétique.
// Les commentaires ci-dessous font foi, pas les préfixes.

export const STORAGE_KEYS = {
  /* --- communs à toute l'application --- */
  schemaVersion: "yams-schema-version",
  draft: "yams-draft", //          brouillon d'avant-partie, porte le jeu visé
  lastRoster: "yams-last-roster", // derniers joueurs lancés
  knownNames: "yams-player-names", // référentiel des joueurs
  playerGames: "app-player-games", // parties terminées, tous jeux confondus
  lastWin: "app-last-win", //      dernière victoire, tous jeux (post-it du menu)

  /* --- Yams --- */
  savedGame: "yams-saved-game",
  playerStats: "yams-player-stats", // moyennes et records de la variante Classique
  rules: "yams-rules",
  prefs: "yams-prefs",
  bestScores: "bestScores",
  worstScores: "worstScores",

  /* --- 5000 --- */
  g5000SavedGame: "g5000-saved-game",
  g5000Rules: "g5000-rules",
  g5000Records: "g5000-records",
} as const;
