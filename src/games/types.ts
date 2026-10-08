// Ce qu'un jeu doit déclarer pour que le reste de l'application sache
// l'afficher, y entrer et nettoyer ses données.
//
// C'est volontairement court, et ça doit le rester : le catalogue des jeux est
// abstrait, les jeux ne le sont pas. Rien ici ne décrit comment on joue, comment
// on compte les points ou à quoi ressemble un écran de partie — chaque jeu
// l'écrit chez lui, en dur, sans passer par cette interface. On ne trouve ici
// que ce dont l'accueil, l'écran de sélection des joueurs et la sauvegarde ont
// réellement besoin.

import type { GameDraft } from "../core/storage/draftRepo";
import type { SummaryValue } from "../core/ui";
import type { IconName } from "../core/iconPaths";

// Ligne d'un récapitulatif <dl> (cf. summaryRow dans core/ui). En données, pas
// en DOM : un jeu décrit, l'écran construit — et resume() / describePlayer()
// restent testables sans navigateur.
export interface SummaryRow {
  term: string;
  value: SummaryValue;
}

/* ---------- Règles du jeu, telles qu'on les explique ---------- */
// Décrites en données et non en HTML, pour deux raisons : la page des règles
// n'a alors rien à savoir des jeux, et surtout les valeurs sont celles des
// réglages en vigueur. Une page de règles qui annonce un barème que la partie
// n'applique pas est pire que pas de page du tout.
//
// Volontairement pauvre : un titre, des paragraphes, un tableau. Ce n'est pas
// un langage de mise en page, et ça ne doit pas le devenir.

export interface RulesTable {
  head: [string, string];
  rows: [string, string][];
  // Mention discrète sous le tableau, du genre « d'après vos réglages ».
  note?: string;
}

// Une entrée d'une liste illustrée (les variantes) : son pictogramme dessiné,
// son nom, ce qu'elle change.
export interface RulesItem {
  icon: IconName;
  color: string;
  title: string;
  text: string;
}

// Un exemple en vrais dés (dessinés) : la main, les dés qui comptent, ce que
// ça rapporte. Le résultat est calculé par le barème du jeu, jamais écrit à
// la main.
export interface RulesExample {
  dice: number[];
  // Indices des dés qui comptent ; les autres sont pâlis. Absent : tous.
  counted?: number[];
  result: string;
}

export interface RulesSection {
  title: string;
  body?: string[];
  examples?: RulesExample[];
  table?: RulesTable;
  items?: RulesItem[];
  // `variants` : encadré des variantes, distinct des règles de base.
  kind?: "variants";
}

// Quelques lignes d'une feuille de ce jeu, en filigrane de sa carte au menu et
// de son accueil : un jeu se reconnaît à sa feuille. Une ligne porte un
// libellé (grille du Yams, face de dé facultative) ou non (colonne de cumuls du
// 5000) ; `mark` est le geste du marqueur posé dessus.
export interface SheetSampleLine {
  label?: string;
  die?: number;
  value: string;
  mark?: "circle" | "strike" | "live";
}

// Partie en cours d'un jeu, telle que l'accueil et l'avertissement
// « une partie est en cours » la décrivent.
export interface ResumeInfo {
  playerNames: string[];
  // Leurs couleurs de partie, dans le même ordre : les pastilles de la reprise.
  playerColors: string[];
  // Récapitulatif détaillé : variantes du Yams, objectif du 5000…
  rows: SummaryRow[];
  // Où en est la partie, sur la carte « Partie en cours » : une phrase
  // (« Tour 6 sur 13 », « Bob mène · 3 100 ») et une jauge de 0 à 1.
  progress?: { label: string; ratio: number };
}

export interface GameDef {
  id: string;
  title: string;
  // Emblème dessiné (sélecteur de jeu, onglets des Paramètres).
  icon: IconName;
  // Encre du jeu : son titre, ses entourés, sa carte au menu. Distincte des
  // couleurs de joueur, qui seules colorent le fond d'un écran de partie.
  accent: string;
  // Le papier du jeu : l'accent très éclairci, fond des en-têtes de ses pages
  // et du haut de sa carte au menu (cf. pages/gameTheme.ts).
  accentPaper: string;
  // Les cinq dés lancés de l'illustration de son accueil : un coup qui dit le
  // jeu (un Yams de 6, un brelan de 1…). Purement décoratif.
  sceneDice: number[];
  // Une phrase sur la tuile d'accueil.
  tagline: string;
  // L'extrait de feuille de la carte du menu et de l'accueil (cf.
  // SheetSampleLine).
  sample: SheetSampleLine[];

  // Les liens vers les records et les règles sont écrits dans le HTML de
  // l'accueil du jeu : seuls ces deux-là sont construits par le code.
  pages: {
    home: string; // écran d'accueil du jeu (menu, retours, sélecteur de jeu)
    play: string; // reprise d'une partie en cours (menu des jeux)
  };

  // Les règles telles qu'on les explique au joueur, construites à partir des
  // réglages en vigueur (cf. RulesSection). `inGame` : la page est ouverte
  // pendant une partie, elle peut s'en tenir à ce que cette partie joue (au
  // 5000 : ses variantes seulement, et les réglages figés à son lancement).
  rulesDoc(context: { inGame: boolean }): RulesSection[];

  // `null` s'il n'y a pas de partie en cours à reprendre.
  resume(): ResumeInfo | null;
  // Convertit le brouillon en partie réelle et navigue vers l'écran de jeu.
  // `colorOf` : la couleur attribuée à chaque joueur sur l'écran de sélection.
  startGame(draft: GameDraft, colorOf: Map<string, string>): void;
  // Efface la partie en cours (« commencer une nouvelle partie »).
  clearSaved(): void;

  // Administration des joueurs (écran Paramètres, via games/playerAdmin) :
  // chaque jeu reporte ou efface TOUT ce qu'il conserve sous ce nom, partie en
  // cours comprise — renommer la fait suivre, supprimer l'abandonne si elle
  // compte ce joueur. Casse et espaces ignorés.
  renamePlayer(oldName: string, newName: string): void;
  removePlayer(name: string): void;
  // Tous les noms que le jeu conserve (partie en cours, stats, classements,
  // records) : l'administration doit pouvoir montrer et nettoyer un reliquat.
  playerNames(): string[];
  // Ce que la suppression de ce joueur emporterait dans ce jeu, pour le
  // récapitulatif de confirmation. Vide si le jeu ne garde rien à son nom.
  describePlayer(name: string): SummaryRow[];

  // Clés localStorage à embarquer dans la sauvegarde complète.
  storageKeys: string[];
  // Celle des `storageKeys` qui porte la partie en cours. Nommée explicitement
  // plutôt que devinée sur le nom de la clé : les préfixes ne veulent rien dire
  // (cf. core/storage/keys).
  savedGameKey: string;
  // Contrôles de forme appliqués à l'import d'une sauvegarde : une donnée qui
  // ne passe pas n'est pas installée, et le fichier entier est refusé. Sans ça
  // on écrirait une partie en cours abîmée, qui serait ensuite silencieusement
  // ignorée à la lecture. Les clés sans contrôle sont écrites telles quelles.
  guards?: Record<string, (value: unknown) => boolean>;
}
