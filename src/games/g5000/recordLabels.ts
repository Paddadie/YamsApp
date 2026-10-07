// Nom, pictogramme et unité de chaque record du 5000 — partagé par l'écran de
// fin (records battus) et la page des records, pour qu'un record s'appelle
// partout de la même façon. Aucun accès au DOM.

import { formatScore } from "../../core/format";
import type { RecordKey } from "./records";

export interface RecordLabel {
  icon: string;
  title: string;
  // Une ligne sous le titre : ce que le record mesure au juste.
  hint: string;
  // Les records dont on rit, rangés à part des autres.
  worst: boolean;
  format(value: number): string;
}

const points = (n: number): string => `${formatScore(n)} points`;

// Accord à la main : « 2 mains pleines » s'accorde sur les deux mots, ce que
// le plural() de core/ui ne sait pas faire.
const count = (n: number, one: string, many = `${one}s`): string =>
  `${n} ${n > 1 ? many : one}`;

export const RECORD_LABELS: Record<RecordKey, RecordLabel> = {
  fastestWin: {
    icon: "🏁",
    title: "Victoire la plus rapide",
    hint: "le moins de tours joués pour gagner",
    worst: false,
    format: (n) => count(n, "tour"),
  },
  biggestBank: {
    icon: "💥",
    title: "Plus gros tour banqué",
    hint: "en un seul tour",
    worst: false,
    format: points,
  },
  longestHotStreak: {
    icon: "🔥",
    title: "Plus de mains pleines en un tour",
    hint: "enchaînées sans s'arrêter — comptées par la calculette",
    worst: false,
    format: (n) => count(n, "main pleine", "mains pleines"),
  },
  mostWins: {
    icon: "🏆",
    title: "Plus grand nombre de victoires",
    hint: "tous objectifs confondus, victoires partagées comprises",
    worst: false,
    format: (n) => count(n, "victoire"),
  },
  biggestBust: {
    icon: "💩",
    title: "Plus gros pot perdu sur un bust",
    hint: "tout ce qu'il y avait, parti d'un lancer",
    worst: true,
    format: points,
  },
  biggestFall: {
    icon: "😵",
    title: "Plus grosse chute subie",
    hint: "rattrapé ou pénalisé",
    worst: true,
    format: points,
  },
  slowestOpening: {
    icon: "🚪",
    title: "Plus long temps d'entrée en jeu",
    hint: "tours ratés d'affilée avant d'entrer",
    worst: true,
    format: (n) => count(n, "tour"),
  },
  longestGame: {
    icon: "🐌",
    title: "Partie la plus longue",
    hint: "en tours de table",
    worst: true,
    format: (n) => count(n, "tour"),
  },
};

// Ordre d'affichage : ce dont on est fier, puis ce dont on rit.
export const BEST_RECORDS: RecordKey[] = [
  "fastestWin",
  "biggestBank",
  "longestHotStreak",
  "mostWins",
];

export const WORST_RECORDS: RecordKey[] = [
  "biggestBust",
  "biggestFall",
  "slowestOpening",
  "longestGame",
];
