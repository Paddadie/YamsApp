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

export interface RulesSection {
  title: string;
  body?: string[];
  table?: RulesTable;
  // `variants` : encadré des variantes, distinct des règles de base.
  kind?: "variants";
}

// Partie en cours d'un jeu, telle que l'accueil et l'avertissement
// « une partie est en cours » la décrivent.
export interface ResumeInfo {
  playerNames: string[];
  // Récapitulatif détaillé : variantes du Yams, objectif du 5000…
  rows: SummaryRow[];
}

export interface GameDef {
  id: string;
  title: string;
  icon: string;
  // Teinte du jeu sur la tuile d'accueil. Distincte des couleurs de joueur.
  accent: string;
  // Une phrase sur la tuile d'accueil.
  tagline: string;

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
