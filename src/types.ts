// Types partagés du domaine.

export type Variant = "Classique" | "Montante" | "Descendante" | "One Shot";

export interface VariantConfig {
  value: Variant;
  label: string;
  icon: string;
  color: string; // couleur de la puce quand la variante est sélectionnée
  default?: boolean;
}

// Nom d'une ligne de la grille ("1".."6", "Bonus", "Total Haut", "Brelan (Σ)", …).
export type LineName = string;

// Scores d'un joueur : par variante, puis par ligne. Les valeurs stockées sont
// toujours des nombres (les totaux dérivés sont mémorisés au fil de la saisie).
export type PlayerScores = Record<Variant, Record<LineName, number>>;

export interface Player {
  name: string;
  color: string;
  scores: PlayerScores;
}

// Règles réglables dans les paramètres, figées au lancement de chaque partie.
export type LineMode =
  | { type: "sum" } // somme des dés (0 à 30)
  | { type: "fixed"; points: number }; // valeur fixe (0 ou N)

export interface GameRules {
  bonus: number; // points du bonus de la section chiffres
  brelan: LineMode;
  full: LineMode;
  carre: LineMode;
  petiteSuite: LineMode;
  grandeSuite: LineMode;
  chance: boolean;
  yams: LineMode;
}

export interface SavedGame {
  players: Player[];
  selectedVariants: Variant[];
  currentPlayerIndex: number;
  rules: GameRules;
  // Posé par l'écran de fin une fois les scores versés au Hall of Fame et aux
  // stats : évite un double comptage si on y revient / rafraîchit.
  recorded?: boolean;
}

export interface ScoreEntry {
  name: string;
  score: number;
  date: string;
  // Détail de la partie (optionnel : absent des entrées d'avant cette version).
  variant?: Variant;
  sheet?: Record<LineName, number>;
  lineOrder?: LineName[];
}
