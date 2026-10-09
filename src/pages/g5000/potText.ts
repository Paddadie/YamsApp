// Ce que les deux saisies du 5000 (calculette, paliers) disent du pot : le
// libellé de « Banquer », la ligne « si vous banquez », et pourquoi il ne se
// banque pas. Sorti de calculator.ts (audit du 09/10) : les paliers s'en
// servent autant qu'elle.

import { icon } from "../../core/icons";
import {
  bankOutcome,
  currentScore,
  hasOpened,
  isOvershoot,
  isUnround,
} from "../../games/g5000/engine";
import type { G5000Game } from "../../games/g5000/types";
import { hasVariant } from "../../games/g5000/variants";

// Le bouton « Banquer » annonce la victoire quand ce pot la donne : tomber pile
// sur l'objectif ne doit pas ressembler à un tour comme un autre (demande de
// Paul) — le trophée dessiné devant, et la ligne en or juste au-dessus le dit
// en toutes lettres (afterLine). « Banquer 1 500 — victoire ! » ne tenait plus
// à côté de « Relancer » ou du Bust sur un téléphone (pied d'une ligne, 08/10).
// Partagé par les deux saisies.
export function bankLabel(
  game: G5000Game,
  pot: number,
  format: (n: number) => string,
): (Node | string)[] {
  const text = pot > 0 ? `Banquer ${format(pot)}` : "Banquer";
  return bankOutcome(game, pot) === "win" ? [icon("trophy"), text] : [text];
}

// La ligne sous le pot, quand le tour peut être banqué : le score qu'on aurait,
// ou l'objectif atteint.
export function afterLine(
  game: G5000Game,
  pot: number,
  format: (n: number) => string,
): { text: string; win: boolean } {
  const after = currentScore(game.players[game.currentPlayerIndex]) + pot;
  return bankOutcome(game, pot)
    ? { text: `${format(after)} : objectif atteint !`, win: true }
    : { text: `si vous banquez : ${format(after)}`, win: false };
}

// La ligne sous le pot se replie quand la fenêtre est étroite, mais jamais au
// milieu d'un nombre (« 4 / 300 » : le séparateur de milliers est une espace
// ordinaire, cf. formatScore) ni devant une ponctuation double (« atteint /
// ! »). Ces morceaux passent dans un `.keep` ; le texte, lui, ne change pas.
// Le tout dans un seul élément : `.pot-after` est une boîte flex (pour le
// trophée), où chaque morceau deviendrait un bloc à part.
const UNBREAKABLE = /\d{1,3}(?: \d{3})*(?: [:!?])?|\S+ [:!?]/g;

export function unbreakable(text: string): HTMLSpanElement {
  const line = document.createElement("span");
  let from = 0;
  for (const match of text.matchAll(UNBREAKABLE)) {
    const at = match.index ?? 0;
    if (at > from) line.append(text.slice(from, at));
    const keep = document.createElement("span");
    keep.className = "keep";
    keep.textContent = match[0];
    line.append(keep);
    from = at + match[0].length;
  }
  if (from < text.length) line.append(text.slice(from));
  return line;
}

// Pourquoi ce pot ne peut pas être banqué tel quel, s'il y a une raison à
// dire : la ligne sous le pot l'annonce avant que le bouton reste grisé sans
// explication. Partagé avec la saisie manuelle.
export function potWarning(
  game: G5000Game,
  pot: number,
  format: (n: number) => string,
  hotDice = false,
): string | null {
  if (pot <= 0) return null;
  if (isOvershoot(game, pot)) {
    return `Au-delà de ${format(game.rules.target)} : ce serait un bust.`;
  }
  // La calculette ne le demande pas : sur une main pleine, son bouton dit
  // déjà de relancer.
  if (hotDice && !hasVariant(game.rules, "freeHotDice")) {
    return "Main pleine : relancez les cinq dés avant de banquer.";
  }
  if (!hasOpened(game.players[game.currentPlayerIndex]) && pot < game.rules.openAt) {
    return `Il faut ${format(game.rules.openAt)} pour entrer en jeu.`;
  }
  if (isUnround(game, pot)) {
    return `Sans demi-mesure : ${format(pot)} finit par 50, il faut un compte rond.`;
  }
  return null;
}
