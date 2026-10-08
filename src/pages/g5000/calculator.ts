// La calculette du 5000 : on lui dit les faces obtenues, elle dit ce qui
// marque et ce que ça vaut. Les règles du tour sont dans le moteur (keepDice,
// finishTurn) : ici, on ne fait que les dérouler à l'écran.
//
// C'est elle qui justifie l'application. Un joueur sait compter un brelan, mais
// pas tenir de tête : les chiffres activés (Combo), le pot du tour, l'écart exact vers
// le score de chaque adversaire, et ce qu'une main pleine lui permet ou
// l'oblige à faire. La saisie rapide reste là pour qui n'en a pas besoin.
//
// Le tour est persisté à chaque étape : en MPA rien ne survit à une navigation,
// et un écran verrouillé au milieu d'un tour ne doit pas le perdre.

import { makeDismissible, plural, requireEl, summaryRow } from "../../core/ui";
import { dieFace } from "../../core/dice";
import { icon } from "../../core/icons";
import {
  combosOf,
  emptyCounts,
  FACES,
  pickCombo,
  totalDice,
  type Combo,
} from "../../games/g5000/rules";
import {
  bankOutcome,
  canBank,
  canReroll,
  currentScore,
  hasOpened,
  isOvershoot,
  isUnround,
  keepDice,
  reroll,
  startTurn,
  turnStarted,
  type TurnFinish,
} from "../../games/g5000/engine";
import type { DiceCounts, Face, G5000Game } from "../../games/g5000/types";
import { hasVariant } from "../../games/g5000/variants";

export interface CalculatorHooks {
  // Le tour se termine, sur le pot de `game.turn` (cf. finishTurn du moteur).
  onFinish(how: TurnFinish): void;
  // Le tour avance (garde, relance) : à persister.
  onChange(): void;
  // Écart vers le score des adversaires, redessiné à chaque étape.
  renderTargets(container: HTMLElement, pot: number): void;
  // Où le pot mènerait le joueur : en hachuré sur la jauge du bandeau.
  previewPot(pot: number): void;
  format(value: number): string;
}

interface Stage {
  counts: DiceCounts;
  // Les faces saisies ont été validées : on passe au choix de ce qu'on garde.
  // Jamais automatiquement — une faute de frappe (un 2 de trop) fausserait
  // tout ce qui suit, jusqu'à faire croire à un bust.
  validated: boolean;
  // Combinaisons du lancer en cours, et celles que le joueur a retenues.
  combos: Combo[];
  picked: Combo[];
}

const freshStage = (): Stage => ({
  counts: emptyCounts(),
  validated: false,
  combos: [],
  picked: [],
});

// Le bouton « Banquer » annonce la victoire quand ce pot la donne : tomber pile
// sur l'objectif ne doit pas ressembler à un tour comme un autre (demande de
// Paul), trophée dessiné compris. Partagé avec la saisie rapide.
export function bankLabel(
  game: G5000Game,
  pot: number,
  format: (n: number) => string,
): (Node | string)[] {
  switch (bankOutcome(game, pot)) {
    case "win":
      return [icon("trophy"), `Banquer ${format(pot)} — victoire !`];
    case "reached":
      return [`Banquer ${format(pot)} — objectif atteint`];
    default:
      return [pot > 0 ? `Banquer ${format(pot)}` : "Banquer"];
  }
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
// explication. Partagé avec la saisie rapide.
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
  // déjà de relancer. La saisie rapide, elle, n'a que cette ligne pour le dire.
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

export function createCalculator(game: G5000Game, hooks: CalculatorHooks) {
  const dialog = requireEl<HTMLDialogElement>("calc-dialog");
  const title = requireEl("calc-title");
  const subtitle = requireEl("calc-sub");
  const potValue = requireEl("calc-pot");
  const potAfter = requireEl("calc-after");
  const targets = requireEl("calc-targets");
  const body = requireEl("calc-stage");
  const foot = requireEl("calc-foot");
  const restartDialog = requireEl<HTMLDialogElement>("restart-dialog");

  let stage: Stage = freshStage();

  const player = () => game.players[game.currentPlayerIndex];
  const entered = () => totalDice(stage.counts);
  const pickedPoints = () =>
    stage.picked.reduce((total, combo) => total + combo.points, 0);
  const pickedDice = () =>
    stage.picked.reduce((total, combo) => total + combo.dice.length, 0);
  // Ce que vaudrait le tour si le joueur s'arrêtait maintenant.
  const shownPot = () => game.turn.pot + pickedPoints();
  // Variante Combo : les chiffres activés ce tour, à mettre en valeur partout
  // où on les touche (pavé, plateau, combinaisons) — chacun de leurs dés vaut
  // 100 de plus, et c'est ce qu'on oublie de tête.
  const activeDigits = (): Face[] =>
    hasVariant(game.rules, "combo") ? game.turn.openDigits : [];
  const isActive = (face: Face): boolean => activeDigits().includes(face);

  // Les règles du tour (pot, chiffres activés, main pleine) sont dans le
  // moteur : la calculette ne fait que les dérouler à l'écran.
  function keepPicked(): void {
    keepDice(game, stage.picked);
    stage.picked = [];
  }

  function rollAgain(): void {
    keepPicked();
    reroll(game);
    stage = freshStage();
    hooks.onChange();
    render();
  }

  function bankTurn(): void {
    keepPicked();
    dialog.close();
    hooks.onFinish("bank");
  }

  // « Dans le mille », objectif dépassé : un bust. Les dés retenus rejoignent
  // le pot avant d'être perdus : c'est ce pot-là que le joueur abandonne (et
  // que retient le record du pot perdu).
  function forfeitTurn(): void {
    keepPicked();
    dialog.close();
    hooks.onFinish("bust");
  }

  function open(): void {
    // Un tour laissé en plan (« Fermer », écran verrouillé, retour arrière) se
    // reprend là où il en était plutôt que de repartir de zéro.
    if (game.turn.rolls === 0) startTurn(game);
    stage = freshStage();
    hooks.onChange();
    render();
    dialog.showModal();
  }

  /* ---------- Recommencer le tour ---------- */
  // Après une erreur de saisie déjà validée (mauvaises faces, mauvais dés
  // gardés) : le seul moyen de s'en sortir sans fausser le pot.


  function askRestart(): void {
    const summary = requireEl("restart-summary");
    summary.replaceChildren();
    summaryRow(summary, "Points du tour", hooks.format(game.turn.pot));
    summaryRow(summary, "Lancer", String(game.turn.rolls));
    summaryRow(summary, "Dés en main", String(game.turn.diceLeft));
    if (activeDigits().length > 0) {
      summaryRow(summary, "Chiffres activés", activeDigits().join(", "));
    }
    restartDialog.showModal();
  }

  function restart(): void {
    restartDialog.close();
    startTurn(game);
    stage = freshStage();
    hooks.onChange();
    render();
  }

  /* ---------- Rendu ---------- */

  function render(): void {
    const me = player();
    title.textContent = `Tour de ${me.name}`;
    subtitle.textContent = `Lancer ${game.turn.rolls} · ${plural(game.turn.diceLeft, "dé")}`;

    potValue.textContent = hooks.format(shownPot());
    renderAfter();
    hooks.renderTargets(targets, shownPot());
    hooks.previewPot(shownPot());

    if (stage.validated) renderPick();
    else renderInput();
  }

  function renderAfter(): void {
    const pot = shownPot();
    potAfter.className = "pot-after";
    if (pot === 0) {
      potAfter.textContent = "";
      return;
    }
    const warning = potWarning(game, pot, hooks.format);
    if (warning) {
      potAfter.replaceChildren(unbreakable(warning));
      potAfter.className = "pot-after is-warning";
      return;
    }
    const line = afterLine(game, pot, hooks.format);
    const text = unbreakable(line.text);
    potAfter.replaceChildren(...(line.win ? [icon("trophy"), text] : [text]));
    if (line.win) potAfter.className = "pot-after is-win";
  }

  /* ---------- Saisie des faces ---------- */
  // On touche les faces obtenues sur le pavé ; elles s'alignent au-dessus, et
  // toucher un dé saisi le retire. Quand le compte y est, on vérifie d'un coup
  // d'œil puis on valide.

  const complete = (): boolean => entered() === game.turn.diceLeft;

  function renderInput(): void {
    const hint = document.createElement("p");
    hint.className = "roll-hint";
    hint.textContent = complete()
      ? "Vérifiez vos dés, puis validez."
      : `Lancez vos ${plural(game.turn.diceLeft, "dé")}, puis touchez les faces obtenues.`;

    const pad = document.createElement("div");
    pad.className = "face-pad";
    for (const face of FACES) pad.appendChild(faceButton(face));

    const line = document.createElement("div");
    line.className = "roll-line";
    const count = document.createElement("span");
    count.className = "roll-count";
    count.textContent = `${entered()} / ${game.turn.diceLeft} dés saisis`;
    line.appendChild(count);
    if (entered() > 0) {
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "link-btn";
      reset.textContent = "tout effacer";
      reset.addEventListener("click", () => {
        stage.counts = emptyCounts();
        render();
      });
      line.appendChild(reset);
    }

    body.replaceChildren(...comboStrip(), hint, tray(), pad, line);

    // « Fermer » garde le tour tel quel, pour le reprendre à la réouverture.
    const close = button("Fermer", "btn-secondary", () => dialog.close());
    const secondary = turnStarted(game)
      ? [close, button("Recommencer le tour", "btn-danger btn-outline", askRestart)]
      : [close];
    // « Valider » reste toujours à la même place et ne s'active qu'une fois le
    // compte de dés atteint : un bouton qui apparaît et disparaît déplace tout
    // le bas de la fenêtre sous le doigt.
    const confirm = button([icon("check"), "Valider ces dés"], "btn-primary", validate);
    confirm.disabled = !complete();
    const row = document.createElement("div");
    row.className = "btn-row";
    row.append(...secondary);
    foot.replaceChildren(confirm, row);
  }

  // Variante Combo : le rappel des chiffres activés, en tête de la fenêtre tant
  // qu'il y en a. Une ligne qui n'apparaît qu'entre deux lancers, jamais sous
  // le doigt pendant la saisie.
  function comboStrip(): HTMLElement[] {
    const digits = [...activeDigits()].sort((a, b) => a - b);
    if (digits.length === 0) return [];
    const strip = document.createElement("p");
    strip.className = "combo-strip";
    const dice = document.createElement("span");
    dice.className = "combo-strip-dice";
    for (const face of digits) dice.appendChild(dieFace(face));
    strip.append(
      icon("link"),
      `${digits.length > 1 ? "Activés" : "Activé"} `,
      dice,
      " : +100 par dé",
    );
    return [strip];
  }

  // Les dés saisis, du plus petit au plus grand. Un dé touché est retiré : c'est
  // la correction d'une faute de frappe, sans tout effacer.
  function tray(): HTMLElement {
    const el = document.createElement("div");
    el.className = "roll-tray";
    for (const face of FACES) {
      for (let k = 0; k < stage.counts[face]; k++) {
        const die = document.createElement("button");
        die.type = "button";
        die.className = isActive(face) ? "tray-die is-boosted" : "tray-die";
        die.dataset.face = String(face);
        die.setAttribute("aria-label", `Retirer un ${face}`);
        die.appendChild(dieFace(face));
        die.addEventListener("click", () => {
          stage.counts[face]--;
          render();
        });
        el.appendChild(die);
      }
    }
    if (el.children.length === 0) {
      const empty = document.createElement("span");
      empty.className = "roll-tray-empty";
      empty.textContent = "Aucun dé saisi";
      el.appendChild(empty);
    }
    return el;
  }

  function faceButton(face: Face): HTMLButtonElement {
    const el = document.createElement("button");
    el.type = "button";
    el.className = stage.counts[face] > 0 ? "face-btn has" : "face-btn";
    if (isActive(face)) el.classList.add("is-boosted");
    el.dataset.face = String(face);
    el.setAttribute("aria-label", `Ajouter un ${face}`);
    el.disabled = complete();

    const count = document.createElement("span");
    count.className = "face-count";
    count.textContent = stage.counts[face] > 0 ? `×${stage.counts[face]}` : "";

    el.append(dieFace(face), count);
    el.addEventListener("click", () => {
      if (complete()) return;
      stage.counts[face]++;
      render();
    });
    return el;
  }

  function validate(): void {
    if (!complete()) return;
    stage.combos = combosOf(stage.counts, game.turn.openDigits, game.rules);
    stage.picked = [];
    stage.validated = true;
    render();
  }

  // Retour à la saisie, faces conservées : l'erreur ne se voit parfois qu'au
  // moment de choisir (une combinaison qui manque, un bust inattendu).
  function correctionLink(): HTMLButtonElement {
    const link = document.createElement("button");
    link.type = "button";
    link.className = "link-btn";
    link.append(icon("chevronLeft"), "Corriger les dés");
    link.addEventListener("click", () => {
      stage = { ...stage, validated: false, combos: [], picked: [] };
      render();
    });
    return link;
  }

  /* ---------- Ce qu'on garde ---------- */

  function renderPick(): void {
    if (stage.combos.length === 0) return renderBust();

    const head = document.createElement("div");
    head.className = "pick-head";
    const hint = document.createElement("p");
    hint.className = "roll-hint";
    hint.textContent = "Touchez ce que vous gardez.";
    head.append(hint, correctionLink());

    const list = document.createElement("div");
    list.className = "combos";
    for (const combo of stage.combos) list.appendChild(comboRow(combo));

    body.replaceChildren(...comboStrip(), keptTray(), head, list);
    renderPickActions();
  }

  // Le lancer, en lecture seule pendant le choix : les dés que prennent les
  // combinaisons retenues sont cerclés d'or, on voit ce qu'on met de côté et ce
  // qu'on relancera.
  function keptTray(): HTMLElement {
    const kept = emptyCounts();
    for (const die of stage.picked.flatMap((c) => c.dice)) kept[die]++;
    const el = document.createElement("div");
    el.className = "roll-tray roll-tray--pick";
    for (const face of FACES) {
      for (let k = 0; k < stage.counts[face]; k++) {
        const die = document.createElement("span");
        die.className = k < kept[face] ? "tray-die is-kept" : "tray-die";
        die.appendChild(dieFace(face));
        el.appendChild(die);
      }
    }
    return el;
  }

  function comboRow(combo: Combo): HTMLButtonElement {
    const el = document.createElement("button");
    el.type = "button";
    const chosen = stage.picked.includes(combo);
    el.className = chosen ? "combo picked" : "combo";
    if (combo.boosted) el.classList.add("is-boosted");
    el.dataset.combo = combo.id;

    const dice = document.createElement("span");
    dice.className = "combo-dice";
    for (const die of combo.dice) dice.appendChild(dieFace(die));

    const label = document.createElement("span");
    label.className = "combo-label";
    // Le libellé dans un <span> : retenu, c'est lui que le feutre surligne.
    const labelText = document.createElement("span");
    labelText.textContent = combo.label;
    if (combo.boosted) label.appendChild(icon("link"));
    label.appendChild(labelText);
    // Incompatible avec ce qui est retenu : la toucher remplacera, on le dit
    // avant le toucher (c'est au joueur de choisir, pas à la calculette).
    if (!chosen) {
      const replaced = stage.picked.filter(
        (c) => !pickCombo(stage.picked, combo, stage.counts).includes(c),
      );
      if (replaced.length > 0) {
        const swap = document.createElement("small");
        swap.className = "combo-swap";
        swap.textContent = `à la place de ${replaced.map((c) => c.label).join(", ")}`;
        label.appendChild(swap);
      }
    }

    const points = document.createElement("span");
    points.className = "combo-points";
    points.textContent = `${chosen ? "+" : ""}${hooks.format(combo.points)}`;

    el.append(dice, label, points);
    el.addEventListener("click", () => toggle(combo));
    return el;
  }

  // Toucher une combinaison retenue la lâche ; toucher une autre la retient, et
  // celles qui partagent ses dés sont lâchées d'elles-mêmes (cf. pickCombo).
  function toggle(combo: Combo): void {
    stage.picked = stage.picked.includes(combo)
      ? stage.picked.filter((c) => c !== combo)
      : pickCombo(stage.picked, combo, stage.counts);
    render();
  }

  function renderPickActions(): void {
    if (stage.picked.length === 0) {
      const disabled = button("Choisissez au moins un dé", "", () => {});
      disabled.disabled = true;
      foot.replaceChildren(disabled);
      return;
    }

    const left = game.turn.diceLeft - pickedDice();
    const hot = left === 0;
    const pot = shownPot();

    // Objectif dépassé avec « Dans le mille » : le tour est un bust. Le joueur
    // peut encore toucher une autre combinaison (plus petite) avant de s'y
    // résoudre.
    if (!canReroll(game, pot)) {
      foot.replaceChildren(button("Bust — passer la main", "btn-danger", forfeitTurn));
      return;
    }

    const bank = button(bankLabel(game, pot, hooks.format), "btn-primary", bankTurn);

    if (hot) {
      // Main pleine : le joueur récupère les 5 dés et relance. C'est obligatoire
      // — c'est alors la seule action, d'où le bouton plein ; si « Pas de
      // zèle » permet aussi de banquer, la relance redevient l'action
      // secondaire, en contour.
      if (canBank(game, pot, true)) {
        const again = button(
          [icon("flame"), "Main pleine — relancer 5 dés"],
          "btn-primary btn-outline",
          rollAgain,
        );
        foot.replaceChildren(again, bank);
      } else {
        foot.replaceChildren(
          button([icon("flame"), "Main pleine — relancer 5 dés"], "btn-primary", rollAgain),
        );
      }
      return;
    }

    const again = button(`Relancer ${plural(left, "dé")}`, "btn-primary btn-outline", rollAgain);
    bank.disabled = !canBank(game, pot, false);
    foot.replaceChildren(again, bank);
  }

  /* ---------- Bust et dépassement ---------- */

  function renderBust(): void {
    const overshoot = isOvershoot(game, game.turn.pot);
    const box = document.createElement("div");
    box.className = "bust-msg";

    const burst = icon("burst", "ic bust-icon");

    const text = document.createElement("p");
    text.textContent = overshoot
      ? `Aucun dé gardable sans dépasser ${hooks.format(game.rules.target)} : c'est un bust.`
      : `Aucun dé ne marque — vous perdez les ${hooks.format(game.turn.pot)} points du tour.`;

    box.append(burst, text, correctionLink());
    body.replaceChildren(box);
    foot.replaceChildren(
      button("Passer la main", "btn-danger", () => {
        dialog.close();
        hooks.onFinish("bust");
      }),
    );
  }

  // `label` : un texte, ou un texte précédé de son pictogramme.
  function button(
    label: string | (Node | string)[],
    variant: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const el = document.createElement("button");
    el.type = "button";
    el.className = variant ? `btn ${variant}` : "btn";
    el.append(...(typeof label === "string" ? [label] : label));
    el.addEventListener("click", onClick);
    return el;
  }

  makeDismissible(restartDialog, "restart-cancel");
  requireEl("restart-confirm").addEventListener("click", restart);

  return { open, dialog };
}
