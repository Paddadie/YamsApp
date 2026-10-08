// L'« addition posée » de la saisie rapide du 5000, sans DOM : ce que le
// joueur a tapé et ce qu'on en déduit. L'écran (pages/g5000/quickEntry.ts) ne
// fait que l'afficher.
//
// Une seule liste, dans l'ordre de la frappe : des montants, et « main
// pleine », qui clôt une main (demande de Paul, 08/10 : une ligne par main
// pleine, comme on compte à la table). Effacer retire la dernière entrée ; les
// mains, la main en cours et le total s'en déduisent.

export type TapeEntry = number | "hand";

export interface Slip {
  hands: number[]; // le total de chaque main pleine, dans l'ordre
  current: number[]; // les montants de la main en cours
  pot: number; // le total du tour
}

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

export function slipOf(tape: TapeEntry[]): Slip {
  const hands: number[] = [];
  let current: number[] = [];
  for (const entry of tape) {
    if (entry === "hand") {
      hands.push(sum(current));
      current = [];
    } else {
      current.push(entry);
    }
  }
  return { hands, current, pot: sum(hands) + sum(current) };
}

// Juste après une main pleine : les cinq dés sont à relancer, on ne banque pas
// (sauf « Pas de zèle », que vérifie canBank).
export const endsOnFullHand = (tape: TapeEntry[]): boolean => tape.at(-1) === "hand";

// Une main pleine ne se déclare que sur une main commencée.
export const canCloseHand = (tape: TapeEntry[]): boolean => slipOf(tape).current.length > 0;

export const subtotal = sum;
