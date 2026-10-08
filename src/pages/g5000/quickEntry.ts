// La saisie rapide du 5000 : pour qui a déjà compté son tour. Une « addition
// posée » — chaque touche écrit une ligne sur un petit papier ligné, une ligne
// par main pleine, le total sous un double trait. Le calcul est dans
// games/g5000/tape.ts ; ici, on ne fait que l'afficher et le transmettre.
//
// Sortie de game.ts le 08/10 (lot D de l'audit), sur le modèle de
// calculator.ts : l'écran de partie la crée, lui donne de quoi finir le tour et
// montrer les cibles, et lui demande son brouillon quand la main change.

import { makeDismissible, requireEl } from "../../core/ui";
import { icon } from "../../core/icons";
import { canBank, enterTurn, type TurnFinish } from "../../games/g5000/engine";
import { SCORE_STEP } from "../../games/g5000/rules";
import {
  canCloseHand,
  endsOnFullHand,
  slipOf,
  subtotal,
  type TapeEntry,
} from "../../games/g5000/tape";
import type { G5000Game } from "../../games/g5000/types";
import { afterLine, bankLabel, potWarning, unbreakable } from "./calculator";

export interface QuickEntryHooks {
  // Le tour se termine, sur le pot de `game.turn` (cf. finishTurn du moteur).
  onFinish(how: TurnFinish): void;
  // Écart vers le score des adversaires, redessiné à chaque touche.
  renderTargets(container: HTMLElement, pot: number): void;
  // Où le pot mènerait le joueur : en hachuré sur la jauge du bandeau.
  previewPot(pot: number): void;
  format(value: number): string;
}

// Touches : peu nombreuses et grandes, pour qu'on ne rate pas sa cible au
// doigt (dix jetons serrés, de 100 à 1 000, l'étaient trop). Tous les scores du
// jeu sont des multiples de 50 : avec le +50, tout montant se compose — 300 en
// trois appuis, 1 850 en six. Rectangulaires, montants en grands chiffres : les
// jetons ronds n'étaient pas assez lisibles (Paul, 08/10). Deux par rangée, du
// plus petit au plus grand.
const CHIP_VALUES = [SCORE_STEP, 100, 500, 1000];

// Mains pleines visibles au-dessus du trait ; au-delà, « n plus haut ».
const SLIP_HANDS = 3;

export function createQuickEntry(game: G5000Game, hooks: QuickEntryHooks) {
  const dialog = requireEl<HTMLDialogElement>("quick-dialog");
  const potValue = requireEl("quick-pot");
  const after = requireEl("quick-after");
  const targets = requireEl("quick-targets");
  const chips = requireEl("quick-chips");
  const lines = requireEl("quick-lines");
  const bank = requireEl<HTMLButtonElement>("quick-bank");
  const bust = requireEl("quick-bust");
  const fmt = hooks.format;

  let tape: TapeEntry[] = [];
  // Le brouillon survit à une fenêtre refermée par erreur (fond touché,
  // Annuler) : il appartient à ce joueur jusqu'à la fin de son tour.
  let tapeOwner: number | null = null;
  // Ce qui vient d'être écrit s'anime, seul.
  let justWritten: "tap" | "hand" | null = null;

  /* ---------- Touches ---------- */

  function buildChips(): void {
    chips.replaceChildren();
    // Le +50 reste avec « Sans demi-mesure » : une main pleine peut finir par
    // 50, seul le total du tour doit être rond (Banquer le refuse sinon).
    for (const value of CHIP_VALUES) {
      const id = value === SCORE_STEP ? "fifty" : String(value);
      chips.appendChild(key(id, amount(value), () => add(value)));
    }
    // Les deux actions, sur une rangée plus fine que les montants. « Effacer »
    // dessiné plutôt que le caractère ⌫ : rendu par la police de l'appareil, il
    // n'avait ni la taille ni le centrage du reste. Son libellé dit ce qu'il va
    // défaire (`renderKeys`).
    chips.appendChild(
      key("hand", keyLabel(icon("flame"), "Main pleine"), closeHand, "key--action key--hand"),
    );
    chips.appendChild(key("back", [], undo, "key--action key--erase"));
  }

  // Le libellé dans son élément : c'est lui qui s'abrège (…) si la touche est
  // trop étroite, jamais sur deux lignes.
  function keyLabel(picto: SVGElement, text: string): (Node | string)[] {
    const label = document.createElement("span");
    label.className = "key-label";
    label.textContent = text;
    return [picto, label];
  }

  function chipKey(id: string): HTMLButtonElement {
    const button = chips.querySelector<HTMLButtonElement>(`[data-chip="${id}"]`);
    if (!button) throw new Error(`Touche absente : ${id}`);
    return button;
  }

  // « +1 000 » : le signe à l'encre du jeu, le montant en grands chiffres.
  function amount(value: number): (Node | string)[] {
    const plus = document.createElement("span");
    plus.className = "key-plus";
    plus.textContent = "+";
    return [plus, fmt(value)];
  }

  function key(
    id: string,
    content: (Node | string)[],
    onPress: () => void,
    extra = "",
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = extra ? `key ${extra}` : "key";
    button.dataset.chip = id;
    button.append(...content);
    button.addEventListener("click", onPress);
    return button;
  }

  function add(value: number): void {
    tape.push(value);
    justWritten = "tap";
    render();
  }

  // La main en cours passe au-dessus du trait, le compteur repart de zéro.
  function closeHand(): void {
    if (!canCloseHand(tape)) return;
    tape.push("hand");
    justWritten = "hand";
    render();
  }

  // Défait la dernière entrée, quelle qu'elle soit : un montant, ou une main
  // pleine, qui redescend alors sous le trait avec ses montants.
  function undo(): void {
    tape.pop();
    render();
  }

  /* ---------- Rendu ---------- */

  // L'addition posée : les mains pleines au-dessus du trait (les plus
  // anciennes repliées en « n plus haut », pour que la fenêtre ne grandisse
  // pas), la main en cours en dessous, sur une ligne.
  function renderSlip(): void {
    lines.replaceChildren();
    if (tape.length === 0) {
      const empty = document.createElement("li");
      empty.className = "slip-empty";
      empty.textContent = "Touchez les montants de votre tour.";
      lines.appendChild(empty);
      return;
    }
    const { hands, current } = slipOf(tape);
    const hidden = hands.length > SLIP_HANDS ? hands.length - (SLIP_HANDS - 1) : 0;
    if (hidden > 0) {
      const more = document.createElement("li");
      more.className = "slip-more";
      // Au moins deux : une seule repliée prendrait la place qu'elle libère.
      more.textContent = `${hidden} mains pleines plus haut`;
      lines.appendChild(more);
    }
    hands.forEach((points, i) => {
      if (i < hidden) return;
      const line = slipLine("slip-hand", justWritten === "hand" && i === hands.length - 1);
      const label = document.createElement("span");
      label.className = "slip-label";
      label.append(icon("flame"), `Main pleine ${i + 1}`);
      line.append(label, slipNum(points));
      lines.appendChild(line);
    });
    lines.appendChild(currentLine(current, hands.length > 0));
  }

  function slipLine(kind: string, isNew: boolean): HTMLLIElement {
    const line = document.createElement("li");
    line.className = `slip-line ${kind}`;
    if (isNew) line.classList.add("is-new");
    const plus = document.createElement("span");
    plus.className = "slip-plus";
    plus.textContent = "+";
    line.appendChild(plus);
    return line;
  }

  // Le montant dans son propre élément : c'est lui qui s'écrit (animer la ligne
  // entière rognerait le « + » posé dans la marge).
  function slipNum(points: number): HTMLSpanElement {
    const num = document.createElement("span");
    num.className = "slip-num";
    num.textContent = fmt(points);
    return num;
  }

  // La main en cours : ses montants à la suite (les plus anciens sortent par la
  // gauche si la ligne déborde), et son sous-total s'il y a des mains au-dessus
  // — sinon, c'est le total du tour, déjà écrit en gros.
  function currentLine(current: number[], afterHands: boolean): HTMLLIElement {
    const line = slipLine("slip-current", false);
    if (afterHands) line.classList.add("is-after-hands");
    const taps = document.createElement("span");
    taps.className = "slip-taps";
    if (current.length === 0) {
      line.classList.add("is-empty");
      taps.textContent = "Nouvelle main";
    }
    current.forEach((value, i) => {
      if (i > 0) taps.append(" + ");
      const tap = document.createElement("span");
      tap.className = "slip-tap";
      if (justWritten === "tap" && i === current.length - 1) tap.classList.add("is-new");
      tap.textContent = fmt(value);
      taps.appendChild(tap);
    });
    line.appendChild(taps);
    if (afterHands && current.length > 0) line.appendChild(slipNum(subtotal(current)));
    return line;
  }

  // « Effacer » dit ce qu'il va défaire ; « Main pleine » attend une main
  // commencée.
  function renderKeys(): void {
    const last = tape.at(-1);
    const erase = chipKey("back");
    erase.disabled = last === undefined;
    erase.replaceChildren(
      ...keyLabel(
        icon("erase"),
        last === undefined ? "Effacer" : last === "hand" ? "Rouvrir la main" : `Effacer ${fmt(last)}`,
      ),
    );
    chipKey("hand").disabled = !canCloseHand(tape);
  }

  function render(): void {
    const me = game.players[game.currentPlayerIndex];
    const { pot } = slipOf(tape);
    const hot = endsOnFullHand(tape);
    requireEl("quick-title").textContent = `Tour de ${me.name}`;
    potValue.textContent = fmt(pot);

    const warning = potWarning(game, pot, fmt, hot);
    after.replaceChildren();
    if (warning) {
      after.replaceChildren(unbreakable(warning));
      after.className = "pot-after is-warning";
    } else if (pot > 0) {
      const line = afterLine(game, pot, fmt);
      const text = unbreakable(line.text);
      after.replaceChildren(...(line.win ? [icon("trophy"), text] : [text]));
      after.className = line.win ? "pot-after is-win" : "pot-after";
    } else {
      after.className = "pot-after";
    }

    renderSlip();
    renderKeys();
    justWritten = null;

    const bankable = canBank(game, pot, hot);
    // Retenu par une main pleine, le bouton n'annonce pas de victoire : la
    // ligne au-dessus dit qu'il faut d'abord relancer.
    bank.replaceChildren(...(hot && !bankable ? [`Banquer ${fmt(pot)}`] : bankLabel(game, pot, fmt)));
    bust.textContent = pot > 0 ? `Bust — perdre ${fmt(pot)}` : "Bust — 0 pt";
    bank.disabled = !bankable;

    hooks.renderTargets(targets, pot);
    hooks.previewPot(pot);
  }

  /* ---------- Ouvrir, finir ---------- */

  function open(): void {
    // Le brouillon d'un autre joueur ne se reprend pas.
    if (tapeOwner !== game.currentPlayerIndex) clear();
    tapeOwner = game.currentPlayerIndex;
    render();
    dialog.showModal();
    // showModal() donne le focus à la première touche, « +50 », qui s'ouvrait
    // cernée de noir comme si elle était choisie. Le focus va à la fenêtre
    // elle-même (tabindex="-1"), comme pour la fenêtre de valeurs du Yams.
    dialog.focus();
  }

  // Le pot de la saisie rapide devient celui du tour — perdu sur « Bust », il
  // compte pour le record du pot perdu comme celui de la calculette ; ses mains
  // pleines, pour la plus longue série.
  function finish(how: TurnFinish): void {
    const { hands, pot } = slipOf(tape);
    enterTurn(game, pot, hands.length);
    hooks.onFinish(how);
  }

  // Oublie le brouillon : fin du tour, main passée, tour repris.
  function clear(): void {
    tape = [];
    tapeOwner = null;
  }

  // Le pot du brouillon du joueur qui a la main, s'il en a commencé un : un
  // tour entamé, que changer de joueur ou reprendre un tour ferait perdre.
  function draftPot(): number | null {
    return tapeOwner === game.currentPlayerIndex && tape.length > 0 ? slipOf(tape).pot : null;
  }

  /* ---------- Mise en route ---------- */

  buildChips();
  bank.addEventListener("click", () => finish("bank"));
  bust.addEventListener("click", () => finish("bust"));
  requireEl("quick-cancel").addEventListener("click", () => dialog.close());
  makeDismissible(dialog);
  // Fenêtre refermée sans banquer : plus de pot à montrer sur la jauge.
  dialog.addEventListener("close", () => hooks.previewPot(0));

  return { open, close: () => dialog.close(), clear, draftPot, dialog };
}
