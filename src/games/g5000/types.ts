// Types du 5000. Le jeu n'a rien à voir avec la grille fermée du Yams : ici le
// score est une PROGRESSION, une suite de cumuls successifs, et deux règles
// (Sniper, tours sans marquer) la font redescendre d'un cran.

export type Face = 1 | 2 | 3 | 4 | 5 | 6;

// Nombre de dés de chaque face dans un lancer, indexé de 1 à 6.
export type DiceCounts = Record<Face, number>;

// Les variantes, cochées sur l'accueil du jeu avant chaque partie, comme celles
// du Yams. Sans aucune, on joue les règles de base : atteindre ou dépasser
// l'objectif, main pleine relancée, personne ne fait tomber personne.
export type G5000Variant =
  | "sniper" // tomber pile sur le score d'un adversaire le fait redescendre
  | "noFifty" // « Sans demi-mesure » : un tour qui finit par 50 ne se marque pas
  | "exact" // « Dans le mille » : il faut l'objectif exactement
  | "freeHotDice" // « Pas de zèle » : une main pleine peut se banquer
  | "combo"; // un brelan active son chiffre pour le reste du tour

// Brelan « classique » (trois 1 = 1 000, sinon le chiffre × 100) ou valeurs
// saisies une à une.
export type TripleKind = "classic" | "custom";
// Un carré vaut 1,5 ou 2 fois le brelan du même chiffre, ou une valeur saisie.
export type FourKind = "half" | "double" | "custom";
// Une quinte vaut le double du carré, le double du brelan, ou une valeur saisie.
export type FiveKind = "doubleFour" | "doubleThree" | "custom";

// Six valeurs, une par chiffre : l'indice 0 est le 1, l'indice 5 le 6.
export type FaceTable = number[];

// Réglages figés au lancement d'une partie, comme GameRules l'est au Yams.
// Deux origines : le barème et le déroulement viennent de ⚙️, l'objectif et
// les variantes de l'accueil du jeu.
export interface G5000Rules {
  target: number; // score à atteindre (multiple de 50)
  openAt: number; // minimum à marquer en un tour pour entrer en jeu (0 = aucun)
  runPoints: number; // valeur d'une suite de 5 dés (0 = les suites ne comptent pas)
  tripleKind: TripleKind;
  fourKind: FourKind;
  fiveKind: FiveKind;
  // Valeurs saisies, lues seulement en mode `custom`. `null` tant que le
  // joueur n'a jamais choisi « Perso » : ⚙️ les préremplit alors avec les
  // valeurs en vigueur au moment du choix.
  customTriples: FaceTable | null;
  customFours: FaceTable | null;
  customFives: FaceTable | null;
  // Nombre de tours sans marquer d'affilée avant de redescendre (0 = jamais).
  blankTurnsPenalty: number;
  // Riposte (défaut) : quand un joueur atteint l'objectif, chaque adversaire
  // rejoue une fois. Sinon, on termine seulement le tour de table.
  lastRound: boolean;
  variants: G5000Variant[];
}

// Pourquoi un score a été barré : rattrapé par un adversaire (Sniper) ou trop
// de tours sans marquer.
export interface Strike {
  kind: "tie" | "penalty";
  by?: number; // pour `tie` : l'index du joueur qui a égalisé
}

export interface SheetEntry {
  score: number; // un cumul, jamais un gain
  struck?: Strike;
}

export interface G5000Player {
  name: string;
  color: string;
  // La feuille du joueur, tenue comme sur papier : ses cumuls successifs, dans
  // l'ordre où ils ont été écrits. Une entrée n'est ajoutée que lorsque le score
  // progresse : un bust ou un tour sous le seuil d'ouverture n'en crée aucune.
  // Une règle qui fait redescendre le joueur BARRE son dernier score en
  // vigueur au lieu de l'effacer. Le score actuel est le dernier non barré ; les
  // scores non barrés sont strictement croissants. Aucun score non barré = le
  // joueur n'est pas (ou plus) entré en jeu.
  sheet: SheetEntry[];
  // Tours consécutifs sans marquer, remis à zéro dès que le joueur marque.
  blankTurns: number;
}

// Tour en cours. Persisté avec la partie : en MPA, rien ne survit à une
// navigation, et un verrouillage d'écran en plein tour ne doit pas le perdre.
export interface G5000Turn {
  pot: number; // points accumulés, pas encore acquis
  diceLeft: number; // dés encore en main
  openDigits: Face[]; // chiffres activés ce tour (variante Combo)
  rolls: number;
  // Mains pleines enchaînées pendant ce tour, pour les records. Facultatif :
  // la saisie rapide ne le connaît pas.
  hotStreak?: number;
}

export interface G5000Game {
  players: G5000Player[];
  currentPlayerIndex: number;
  rules: G5000Rules;
  turn: G5000Turn;
  // Posé quand un joueur atteint la cible : la partie se termine à la fin du
  // tour de table, ou après la riposte.
  finishedBy?: number;
  // Joueurs qui doivent encore jouer une fois la cible atteinte (riposte ou fin
  // du tour de table). La partie s'achève quand la liste est vide.
  toPlay?: number[];
  // Ceux qui ont atteint la cible, dans l'ordre d'arrivée : à score final égal,
  // le premier arrivé passe devant. Absent des parties d'avant cette règle, où
  // l'égalité donnait une victoire partagée.
  arrivals?: number[];
  // Posé par closeTurn() quand le dernier tour est joué. Un fait enregistré, et
  // non déduit : les pages de jeu et de fin se redirigent l'une vers l'autre
  // sur ce seul champ.
  ended?: boolean;
  recorded?: boolean;
  // Ce que la partie retient pour les records, au fil des tours (cf. records.ts).
  // Facultatif : une partie commencée avant les records n'en porte pas.
  stats?: G5000GameStats;
  // Records battus par cette partie, mesurés AVANT d'écrire les records puis
  // mémorisés — même raison que `hofImpact` au Yams : recalculés après écriture,
  // ils se compareraient à eux-mêmes et ne verraient plus rien.
  recordsBroken?: string[];
}

// Un exploit de la partie, rattaché à son auteur.
export interface GameFeat {
  player: number;
  value: number;
  // Pour une chute : l'index de celui qui l'a provoquée (absent pour la
  // pénalité des tours sans marquer, qui n'a pas d'auteur).
  by?: number;
}

export interface G5000GameStats {
  turns: number[]; // tours joués, par joueur
  // Tours passés d'affilée sans parvenir à entrer en jeu : la série en cours,
  // et la plus longue de la partie. Un joueur retombé à zéro en recommence une.
  closedRun: number[];
  longestClosedRun: number[];
  biggestBank?: GameFeat; // plus gros tour banqué
  biggestBust?: GameFeat; // plus gros pot perdu sur un bust
  longestHotStreak?: GameFeat; // plus de mains pleines enchaînées dans un tour
  biggestFall?: GameFeat; // plus grosse chute subie
}
