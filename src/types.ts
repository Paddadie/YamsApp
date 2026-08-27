// Types partagés du domaine.

export type Variant = "Classique" | "Montante" | "Descendante" | "One Shot";

export interface VariantConfig {
  value: Variant;
  label: string;
  icon: string;
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

export interface SavedGame {
  players: Player[];
  selectedVariants: Variant[];
  currentPlayerIndex: number;
}

export interface ScoreEntry {
  name: string;
  score: number;
  date: string;
}
