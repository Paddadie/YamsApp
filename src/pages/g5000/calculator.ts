// La calculette du 5000 : on lui dit les faces obtenues, elle dit ce qui
// marque et ce que ça vaut. Les règles du tour sont dans le moteur (keepDice,
// finishTurn) : ici, on ne fait que les dérouler à l'écran.
//
// C'est elle qui justifie l'application. Un joueur sait compter un brelan, mais
// pas tenir de tête : les chiffres activés (Combo), le pot du tour, l'écart exact vers
// le score de chaque adversaire, et ce qu'une main pleine lui permet ou
// l'oblige à faire. La saisie manuelle (les paliers) reste là pour qui n'en a
// pas besoin.
//
// Le tour est persisté à chaque étape : en MPA rien ne survit à une navigation,
// et un écran verrouillé au milieu d'un tour ne doit pas le perdre.

import { plural, requireEl } from "../../core/ui";
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
  undoRoll,
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

export function createCalculator(game: G5000Game, hooks: CalculatorHooks) {
  const dialog = requireEl<HTMLDialogElement>("calc-dialog");
  const title = requireEl("calc-title");
  const subtitle = requireEl("calc-sub");
  const potValue = requireEl("calc-pot");
  const potAfter = requireEl("calc-after");
  const targets = requireEl("calc-targets");
  const body = requireEl("calc-stage");
  const foot = requireEl("calc-foot");

  let stage: Stage = freshStage();
  // « Recommencer le tour » demande confirmation sur place, sans seconde
  // fenêtre par-dessus le pupitre.
  let confirmRestart = false;
  // Le dernier dé saisi se pose avec un petit rebond ; le pot tressaute quand
  // il change. Seulement le temps d'un rendu.
  let justAdded: Face | null = null;
  let lastPot = -1;

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
  // Le lancer accompagne ce qui est gardé : le tour s'en souvient, pour le
  // montrer à gauche de la bande et pouvoir y revenir.
  function keepPicked(): void {
    keepDice(game, stage.picked, stage.counts);
    stage.picked = [];
  }

  // Revenir au lancer précédent : il se rouvre tel qu'il était, faces et
  // choix compris, pour en garder autre chose. Le lancer en cours est oublié.
  function backToPreviousRoll(): void {
    const roll = undoRoll(game);
    if (!roll) return;
    const combos = combosOf(roll.roll, game.turn.openDigits, game.rules);
    stage = {
      counts: { ...roll.roll },
      validated: true,
      combos,
      picked: roll.picked
        .map((id) => combos.find((c) => c.id === id))
        .filter((c): c is Combo => c !== undefined),
    };
    confirmRestart = false;
    hooks.onChange();
    render();
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
    // Un tour laissé en plan (refermé, écran verrouillé, retour arrière) se
    // reprend là où il en était plutôt que de repartir de zéro.
    if (game.turn.rolls === 0) startTurn(game);
    stage = freshStage();
    confirmRestart = false;
    hooks.onChange();
    render();
    // Sans voile : posée en bas de l'écran, la feuille reste visible (cf.
    // game.ts, qui range la barre du bas le temps de la saisie).
    dialog.show();
    // L'ouverture donne le focus au premier bouton, la flèche du haut, qui
    // s'affichait cerclée : il va au pupitre lui-même, comme la saisie
    // manuelle — sans faire défiler l'écran pour l'amener en vue.
    dialog.focus({ preventScroll: true });
  }

  /* ---------- Recommencer le tour ---------- */
  // Après une erreur de saisie déjà validée (mauvaises faces, mauvais dés
  // gardés) : le seul moyen de s'en sortir sans fausser le pot. Confirmé sur
  // place, en disant ce qui sera perdu.

  function restart(): void {
    confirmRestart = false;
    startTurn(game);
    stage = freshStage();
    hooks.onChange();
    render();
  }

  function restartControl(): HTMLElement | null {
    if (!turnStarted(game)) return null;
    if (!confirmRestart) {
      return linkButton([icon("reset"), "Recommencer le tour"], "link-plain", () => {
        confirmRestart = true;
        render();
      });
    }
    const ask = document.createElement("span");
    ask.className = "restart-ask";
    ask.append(
      game.turn.pot > 0 ? `Effacer le tour (${hooks.format(game.turn.pot)}) ?` : "Effacer le tour ?",
      linkButton(["Oui, recommencer"], "link-danger", restart),
      linkButton(["Non"], "link-plain", () => {
        confirmRestart = false;
        render();
      }),
    );
    return ask;
  }

  /* ---------- Rendu ---------- */

  function render(): void {
    const me = player();
    title.textContent = `Tour de ${me.name}`;
    subtitle.textContent = `Lancer ${game.turn.rolls} · ${plural(game.turn.diceLeft, "dé")}`;

    // Le pot, en tête du pupitre : le chiffre qu'on surveille.
    const pot = shownPot();
    potValue.textContent = hooks.format(pot);
    if (lastPot >= 0 && pot !== lastPot) {
      potValue.classList.remove("is-tick");
      void potValue.offsetWidth; // relance le tressautement
      potValue.classList.add("is-tick");
    }
    lastPot = pot;
    renderAfter();
    hooks.renderTargets(targets, pot);
    hooks.previewPot(pot);

    if (stage.validated) renderPick();
    else renderInput();
    justAdded = null;
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

  // La ligne des petites actions, sous le lancer : une consigne ou « Corriger
  // les dés » à gauche, « Recommencer le tour » à droite.
  function linksRow(left: HTMLElement): HTMLElement {
    const row = document.createElement("div");
    row.className = "calc-links";
    const restartEl = restartControl();
    // La question « Effacer le tour ? » prend toute la ligne : à côté, la
    // consigne s'écrasait en une colonne d'un mot par ligne.
    if (confirmRestart && restartEl) row.append(restartEl);
    else row.append(left, ...(restartEl ? [restartEl] : []));
    return row;
  }

  /* ---------- Saisie des faces ---------- */
  // On touche les faces obtenues sur le pavé ; elles se posent sur la bande du
  // lancer, et toucher un dé posé le retire. Quand le compte y est, on vérifie
  // d'un coup d'œil puis on valide.

  const complete = (): boolean => entered() === game.turn.diceLeft;

  function renderInput(): void {
    const hint = document.createElement("p");
    hint.className = "roll-hint";
    hint.textContent =
      entered() === 0
        ? `Lancez vos ${plural(game.turn.diceLeft, "dé")}, puis touchez les faces obtenues.`
        : complete()
          ? "Vérifiez vos dés, puis validez."
          : "Touchez un dé posé pour le retirer.";

    const pad = document.createElement("div");
    pad.className = "face-pad";
    for (const face of FACES) pad.appendChild(faceButton(face));

    body.replaceChildren(...comboStrip(), tray(), linksRow(hint), pad);

    // « Valider » reste toujours à la même place et ne s'active qu'une fois le
    // compte de dés atteint : un bouton qui apparaît et disparaît déplace tout
    // le bas du pupitre sous le doigt.
    const confirm = button([icon("check"), "Valider ces dés"], "btn-primary", validate);
    confirm.disabled = !complete();
    foot.replaceChildren(confirm);
  }

  // Variante Combo : le rappel des chiffres activés, en tête du pupitre tant
  // qu'il y en a.
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

  // Un dé posé sur la bande, un peu de travers comme s'il venait d'être jeté.
  const TILT = [-7, 5, -3, 6, -5];
  function placedDie(face: Face, index: number, tag: "button" | "span"): HTMLElement {
    const die = document.createElement(tag);
    die.className = isActive(face) ? "tray-die is-boosted" : "tray-die";
    die.style.setProperty("--t", `${TILT[index % TILT.length]}deg`);
    die.dataset.face = String(face);
    die.appendChild(dieFace(face));
    return die;
  }

  // Les dés déjà gardés ce tour, posés à gauche de la bande comme à la table :
  // chaque lancer avec son gain, une main pleine finie résumée en une pastille
  // (pour que la bande reste courte sur un long tour). En tête, la flèche
  // pour revenir au lancer précédent. Rien n'ajoute de ligne au pupitre.
  function aside(): HTMLElement | null {
    const history = game.turn.history ?? [];
    if (history.length === 0) return null;
    const el = document.createElement("div");
    el.className = "roll-aside";
    el.setAttribute("aria-label", "Déjà gardé ce tour");

    const back = document.createElement("button");
    back.type = "button";
    back.className = "aside-back";
    back.setAttribute("aria-label", `Revenir au lancer ${history.length}`);
    back.title = `Revenir au lancer ${history.length}`;
    back.appendChild(icon("undo"));
    back.addEventListener("click", backToPreviousRoll);
    el.appendChild(back);

    // Une main pleine se ferme quand ce lancer a gardé tous les dés en main.
    let handsPoints = 0;
    let hands = 0;
    let current: typeof history = [];
    for (const roll of history) {
      current.push(roll);
      if (roll.kept.length >= roll.before.diceLeft) {
        hands++;
        handsPoints += current.reduce((total, r) => total + r.points, 0);
        current = [];
      }
    }
    if (hands > 0) {
      const hand = document.createElement("span");
      hand.className = "aside-hand";
      hand.title = hands > 1 ? `${hands} mains pleines` : "1 main pleine";
      hand.appendChild(icon("flame"));
      if (hands > 1) {
        const times = document.createElement("i");
        times.textContent = `×${hands}`;
        hand.appendChild(times);
      }
      const points = document.createElement("b");
      points.textContent = hooks.format(handsPoints);
      hand.appendChild(points);
      el.appendChild(hand);
    }
    for (const roll of current) {
      const group = document.createElement("span");
      group.className = "aside-roll";
      const dice = document.createElement("span");
      dice.className = "aside-dice";
      for (const face of [...roll.kept].sort((a, b) => a - b)) {
        const die = dieFace(face);
        if (roll.before.openDigits.includes(face) && hasVariant(game.rules, "combo")) {
          die.classList.add("is-boosted");
        }
        dice.appendChild(die);
      }
      const points = document.createElement("small");
      points.textContent = `+${hooks.format(roll.points)}`;
      group.append(dice, points);
      el.appendChild(group);
    }
    return el;
  }

  // La bande du lancer : la réserve à gauche s'il y en a une, puis les dés.
  function band(className: string, dice: HTMLElement[]): HTMLElement {
    const el = document.createElement("div");
    el.className = className;
    const reserve = aside();
    if (!reserve) {
      el.append(...dice);
      return el;
    }
    el.classList.add("has-aside");
    const now = document.createElement("div");
    now.className = "roll-now";
    now.append(...dice);
    el.append(reserve, now);
    return el;
  }

  // Le lancer en cours de saisie, du plus petit au plus grand, et en
  // pointillé les dés qui restent à saisir. Toucher un dé le retire : c'est la
  // correction d'une faute de frappe, sans tout effacer.
  function tray(): HTMLElement {
    const dice: HTMLElement[] = [];
    let index = 0;
    for (const face of FACES) {
      for (let k = 0; k < stage.counts[face]; k++) {
        const die = placedDie(face, index++, "button") as HTMLButtonElement;
        die.type = "button";
        die.setAttribute("aria-label", `Retirer un ${face}`);
        if (face === justAdded && k === stage.counts[face] - 1) die.classList.add("is-new");
        die.addEventListener("click", () => {
          stage.counts[face]--;
          render();
        });
        dice.push(die);
      }
    }
    for (let k = entered(); k < game.turn.diceLeft; k++) {
      const slot = document.createElement("span");
      slot.className = "roll-slot";
      slot.setAttribute("aria-hidden", "true");
      dice.push(slot);
    }
    return band("roll-tray", dice);
  }

  function faceButton(face: Face): HTMLButtonElement {
    const el = document.createElement("button");
    el.type = "button";
    el.className = stage.counts[face] > 0 ? "face-btn has" : "face-btn";
    if (isActive(face)) el.classList.add("is-boosted");
    el.dataset.face = String(face);
    el.setAttribute("aria-label", `Ajouter un ${face}`);
    el.disabled = complete();
    el.appendChild(dieFace(face));
    // Combien de dés de cette face sont posés : une pastille d'encre au coin.
    if (stage.counts[face] > 0) {
      const count = document.createElement("span");
      count.className = "face-count";
      count.textContent = String(stage.counts[face]);
      el.appendChild(count);
    }
    el.addEventListener("click", () => {
      if (complete()) return;
      stage.counts[face]++;
      justAdded = face;
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
    return linkButton([icon("chevronLeft"), "Corriger les dés"], "link-btn", () => {
      stage = { ...stage, validated: false, combos: [], picked: [] };
      render();
    });
  }

  /* ---------- Ce qu'on garde ---------- */

  function renderPick(): void {
    if (stage.combos.length === 0) return renderBust();

    const list = document.createElement("div");
    list.className = "combos";
    for (const combo of stage.combos) list.appendChild(comboRow(combo));

    body.replaceChildren(...comboStrip(), keptTray(), linksRow(correctionLink()), list);
    renderPickActions();
  }

  // Le lancer, en lecture seule pendant le choix : les dés que prennent les
  // combinaisons retenues se soulèvent, cerclés d'or ; les autres restent sur
  // la table, pâlis — on voit ce qu'on met de côté et ce qu'on relancera.
  function keptTray(): HTMLElement {
    const kept = emptyCounts();
    for (const die of stage.picked.flatMap((c) => c.dice)) kept[die]++;
    const dice: HTMLElement[] = [];
    let index = 0;
    for (const face of FACES) {
      for (let k = 0; k < stage.counts[face]; k++) {
        const die = placedDie(face, index++, "span");
        die.classList.add(k < kept[face] ? "is-kept" : "is-left");
        dice.push(die);
      }
    }
    return band("roll-tray roll-tray--pick", dice);
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
    if (combo.boosted) labelText.appendChild(icon("link"));
    labelText.append(combo.label);
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

  // Le pied : une seule ligne, deux boutons au plus, l'action principale à
  // droite sous le pouce.
  function footRow(...buttons: HTMLButtonElement[]): void {
    const row = document.createElement("div");
    row.className = "btn-row calc-row";
    row.append(...buttons);
    foot.replaceChildren(row);
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

    const bank = button(bankLabel(game, pot, hooks.format), "btn-primary calc-bank", bankTurn);

    if (hot) {
      // Main pleine : le joueur récupère les 5 dés et relance. C'est obligatoire
      // — c'est alors la seule action, d'où le bouton plein ; si « Pas de
      // zèle » permet aussi de banquer, la relance redevient l'action
      // secondaire, en contour.
      if (canBank(game, pot, true)) {
        footRow(
          button([icon("flame"), "Relancer 5 dés"], "btn-primary btn-outline", rollAgain),
          bank,
        );
      } else {
        foot.replaceChildren(
          button([icon("flame"), "Main pleine — relancer 5 dés"], "btn-primary", rollAgain),
        );
      }
      return;
    }

    bank.disabled = !canBank(game, pot, false);
    footRow(button(`Relancer ${plural(left, "dé")}`, "btn-primary btn-outline", rollAgain), bank);
  }

  /* ---------- Bust et dépassement ---------- */

  function renderBust(): void {
    const overshoot = isOvershoot(game, game.turn.pot);
    const box = document.createElement("div");
    box.className = "bust-msg";

    const burst = icon("burst", "ic bust-icon");

    const text = document.createElement("p");
    const lost = game.turn.pot;
    text.textContent = overshoot
      ? `Aucun dé gardable sans dépasser ${hooks.format(game.rules.target)} : c'est un bust.`
      : lost > 0
        ? `Aucun dé ne marque : les ${hooks.format(lost)} points du tour sont perdus.`
        : "Aucun dé ne marque : bust.";

    box.append(burst, text);
    body.replaceChildren(keptTray(), box, linksRow(correctionLink()));
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

  // Les petites actions du corps (corriger, recommencer) : des liens, pas des
  // boutons du pied.
  function linkButton(
    content: (Node | string)[],
    variant: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const el = document.createElement("button");
    el.type = "button";
    el.className = variant;
    el.append(...content);
    el.addEventListener("click", onClick);
    return el;
  }

  requireEl("calc-close").addEventListener("click", () => dialog.close());

  return { open, dialog };
}
