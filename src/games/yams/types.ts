// Types partagés du domaine.

export type Variant = "Classique" | "Montante" | "Descendante" | "One Shot";

export interface VariantConfig {
  value: Variant;
  label: string;
  icon: string;
  color: string; // couleur de la puce quand la variante est sélectionnée
  default?: boolean;
}

// Identifiant STABLE d'une ligne de la grille : "1".."6", "brelan", "full"…,
// "bonus", "scoreFinal" (cf. scoring.ts). C'est la clé des feuilles de score,
// partie en cours comme Hall of Fame ; le libellé affiché (« Full (25) ») se
// calcule à part, d'après le barème (lineLabel).
export type LineName = string;

// Feuille d'un joueur sur une variante. Les valeurs stockées sont toujours des
// nombres (les totaux dérivés sont mémorisés au fil de la saisie) ; une ligne
// absente est une case vide.
export type LineScores = Record<LineName, number>;

// Scores d'un joueur : une feuille par variante JOUÉE — une partie classique
// n'a pas de feuille Montante. Lire une feuille passe par sheetOf (players.ts).
export type PlayerScores = Partial<Record<Variant, LineScores>>;

export interface Player {
  name: string;
  color: string;
  scores: PlayerScores;
}

// Règles réglables dans les paramètres, figées au lancement de chaque partie.
export type LineMode =
  | { type: "sum" } // somme des 5 dés
  | { type: "fixed"; points: number }; // valeur fixe (0 ou N)

// Brelan et Carré connaissent un troisième mode, répandu en règle maison : ne
// compter que les dés de la combinaison (trois 5 = 15 au Brelan).
export type GroupMode = LineMode | { type: "dice" };

export interface GameRules {
  bonus: number; // points du bonus de la section chiffres
  brelan: GroupMode;
  full: LineMode;
  carre: GroupMode;
  petiteSuite: LineMode;
  grandeSuite: LineMode;
  chance: boolean;
  yams: LineMode;
}

// Effet d'une partie terminée sur le Hall of Fame (badges 🏆/💩 et bannière de
// record de l'écran de fin). Mesuré AVANT d'écrire les scores, puis mémorisé :
// une fois la partie versée au Hall of Fame, la recalculer comparerait ses
// scores à eux-mêmes et ne verrait plus aucun changement.
export interface HallOfFameImpact {
  best: string[]; // clés `nom|variante` entrant aux meilleurs scores
  worst: string[]; // idem pour les pires scores
  newRecord: { name: string; score: number; variant: Variant } | null;
}

export interface SavedGame {
  players: Player[];
  selectedVariants: Variant[];
  currentPlayerIndex: number;
  rules: GameRules;
  // Posé par l'écran de fin une fois les scores versés au Hall of Fame et aux
  // stats : évite un double comptage si on y revient / rafraîchit.
  recorded?: boolean;
  // Enregistré en même temps que `recorded` (voir HallOfFameImpact).
  hofImpact?: HallOfFameImpact;
}

export interface ScoreEntry {
  name: string;
  score: number;
  date: string;
  // Détail de la partie (optionnel : absent des entrées d'avant cette version).
  variant?: Variant;
  sheet?: LineScores;
  lineOrder?: LineName[];
  // Barème de la partie : il donne les libellés de la feuille (« Full (25) »).
  // Absent des entrées sans feuille.
  rules?: GameRules;
}
