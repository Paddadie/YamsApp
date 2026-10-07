// Écran de partie du 5000.
//
// La feuille de progression est le sujet de l'écran : au 5000 le score n'est
// pas un nombre mais une suite de cumuls, et ce sont eux que les busts
// d'affilée et la variante Sniper mettent en jeu. Elle imite la feuille de
// papier qu'on tiendrait à la table : chacun écrit son total sous le précédent,
// et ce qui tombe est barré, pas effacé.
//
// Deux portes d'entrée en bas : la calculette assistée pour qui découvre le jeu,
// la saisie rapide pour qui sait déjà ce qu'il a marqué. Avec Sniper, les deux
// montent l'écart exact vers chaque adversaire, le seul service qu'un joueur ne
// peut pas se rendre de tête. Sans Sniper, ce tableau n'apparaît pas.
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).

import { bootstrap } from "../../core/bootstrap";
import { goTo } from "../../core/nav";
import {
  makeActivatable,
  makeDismissible,
  plural,
  requireEl,
  summaryRow,
  turnHintContent,
} from "../../core/ui";
import { onHorizontalSwipe } from "../../core/swipe";
import { keepScreenOn } from "../../core/wakeLock";
import { getSavedGame, saveSavedGame } from "../../games/g5000/repo";
import {
  canBank,
  canPlay,
  choosePlayer,
  currentScore,
  expectedPlayer,
  finishTurn,
  hasOpened,
  liveEntry,
  startTurn,
  tieTargets,
  turnStarted,
  type Move,
  type TurnFinish,
} from "../../games/g5000/engine";
import type { G5000Player, SheetEntry, Strike } from "../../games/g5000/types";
import { formatScore } from "../../core/format";
import { SCORE_STEP } from "../../games/g5000/rules";
import { afterLine, bankLabel, createCalculator, potWarning } from "./calculator";
import { hasVariant } from "../../games/g5000/variants";
import { G5000 } from "../../games/g5000/gameDef";

bootstrap();

const saved = getSavedGame();
if (!saved) {
  goTo("g5000Home");
  throw new Error("Aucune partie en cours : retour à l'accueil du 5000.");
}
const game = saved; // alias non-null

// Une partie finie ne se rejoue pas : on y revient par le geste retour depuis
// l'écran de fin, ou en rechargeant pendant l'annonce de la dernière cascade.
// `recorded` couvre les parties finies avant l'arrivée de `ended`.
if (game.ended || game.recorded) {
  goTo("g5000End");
  throw new Error("Partie terminée : passage à l'écran de fin.");
}

const screen = requireEl("g5000-screen");
const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const banner = requireEl("turn-banner");
const sheet = requireEl<HTMLTableElement>("score-sheet");
const sheetScroll = requireEl("sheet-scroll");

const quickDialog = requireEl<HTMLDialogElement>("quick-dialog");
const quickPot = requireEl("quick-pot");
const quickAfter = requireEl("quick-after");
const quickTargets = requireEl("quick-targets");
const quickChips = requireEl("quick-chips");
const quickTape = requireEl("quick-tape");
const quickBank = requireEl<HTMLButtonElement>("quick-bank");

const cascadeDialog = requireEl<HTMLDialogElement>("cascade-dialog");
const turnHint = requireEl<HTMLButtonElement>("turn-hint");
const switchDialog = requireEl<HTMLDialogElement>("switch-dialog");

// Jetons de la saisie rapide : peu nombreux et gros, pour qu'on ne rate pas sa
// cible au doigt (dix jetons serrés, de 100 à 1 000, l'étaient trop). Tous les
// scores du jeu sont des multiples de 50 : avec le +50 de la rangée du
// dessous, tout montant se compose — 300 en trois appuis, 1 850 en six.
const CHIP_VALUES = [100, 500, 1000];

const fmt = formatScore;

const player = () => game.players[game.currentPlayerIndex];

// Joueur à qui donner la main une fois le changement confirmé.
let pendingSwitch: number | null = null;

/* ---------- État de la saisie rapide ---------- */

let pot = 0;
let tape: number[] = [];

function persist(): void {
  saveSavedGame(game);
}

/* ---------- Bandeau du joueur ---------- */

function renderBanner(): void {
  const me = player();
  const score = currentScore(me);

  banner.style.background = me.color;
  screen.style.setProperty("--player-color", me.color);
  if (themeMeta) themeMeta.content = me.color;

  requireEl("turn-name").textContent = me.name;
  requireEl("gauge-score").textContent = fmt(score);
  requireEl("gauge-target").textContent = fmt(game.rules.target);
  requireEl("gauge-fill").style.width =
    `${Math.min(100, (score / game.rules.target) * 100)}%`;

  renderBlankTurns();
  renderTurnHint();
}

// « C'est à Marie › » quand la main a été donnée à un autre que celui dont
// c'est le tour en suivant la table (cf. expectedPlayer) : un toucher de
// travers sur un nom ne passe pas inaperçu, et un toucher sur la pastille y
// ramène (avec confirmation si un tour est entamé, comme tout changement).
function renderTurnHint(): void {
  const index = expectedPlayer(game);
  turnHint.hidden = index === null || index === game.currentPlayerIndex;
  if (index === null || turnHint.hidden) return;
  const name = game.players[index].name;
  turnHint.replaceChildren(...turnHintContent(name));
  turnHint.setAttribute("aria-label", `C'est à ${name} de jouer : lui donner la main`);
}

// Une pastille par tour toléré : c'est le compteur de tours sans marquer, et il
// doit se lire sans compter. Rouge dès l'avant-dernier, pour que le joueur sache que le
// prochain tour coûte cher.
function renderBlankTurns(): void {
  const el = requireEl("blank-turns");
  const max = game.rules.blankTurnsPenalty;
  el.replaceChildren();
  if (max <= 0) return;

  const count = player().blankTurns;
  const danger = count >= max - 1;

  for (let i = 0; i < max; i++) {
    const pip = document.createElement("span");
    pip.className = "pip";
    if (i < count) pip.classList.add(danger ? "pip--danger" : "pip--on");
    el.appendChild(pip);
  }

  const label = document.createElement("span");
  label.className = "blank-label";
  label.textContent =
    count === 0
      ? "aucun bust"
      : `${plural(count, "bust")} d'affilée${
          count === max - 1 ? " — le prochain coûte cher" : ""
        }`;
  if (danger) label.classList.add("is-danger");
  el.appendChild(label);
}

/* ---------- La feuille de progression ---------- */
// Tenue comme sur papier : une colonne par joueur, où chacun écrit son nouveau
// total sous le précédent, à son rythme. Les colonnes n'ont pas à être de même
// longueur : une ligne n'est pas un tour (un bust n'écrit rien). Un score
// qu'une règle fait tomber reste écrit, barré, avec la marque de ce qui
// l'a fait tomber. Le score en vigueur est surligné de la couleur du joueur :
// avec les ratures, ce n'est pas forcément le dernier de sa colonne.

// Ce que le dernier tour a changé sur la feuille, à animer : un score qui
// s'écrit, un trait qui barre. Seulement le temps d'un rendu.
interface SheetChanges {
  written?: Set<SheetEntry>;
  struck?: Set<SheetEntry>;
}

function renderSheet(changes: SheetChanges = {}): void {
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  // Les noms en tête de colonne servent d'onglets : toucher un joueur lui
  // donne la main. En fin de partie, ceux qui ne rejouent plus sont grisés.
  game.players.forEach((p, i) => {
    const th = document.createElement("th");
    th.style.setProperty("--col", p.color);
    // Le nom sur un onglet de sa couleur, le langage du bandeau : il doit se
    // lire avant les scores, pas après (demande de Paul).
    const tab = document.createElement("span");
    tab.className = "name-tab";
    tab.textContent = p.name;
    th.appendChild(tab);
    const pips = blankTurnPips(p);
    if (pips) th.appendChild(pips);
    if (i === game.currentPlayerIndex) {
      th.className = "is-current";
      th.setAttribute("aria-current", "true");
    } else if (canPlay(game, i)) {
      th.classList.add("is-choosable");
      makeActivatable(th, `Donner la main à ${p.name}`, () => requestPlayer(i));
    } else {
      th.classList.add("is-out");
    }
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  const started = game.players.some((p) => p.sheet.length > 0);
  // Un joueur sans score en vigueur a un tiret sous sa colonne : il n'est pas
  // (ou plus) entré en jeu. Il prend une ligne — sauf avant le premier score,
  // où un message remplace la feuille.
  const used = started
    ? Math.max(...game.players.map((p) => p.sheet.length + (hasOpened(p) ? 0 : 1)))
    : 0;

  if (!started) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = game.players.length;
    td.className = "sheet-empty";
    td.textContent =
      game.rules.openAt > 0
        ? `Personne n'est encore entré en jeu. Il faut ${fmt(game.rules.openAt)} points en un tour.`
        : "La partie commence.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  // Autant de lignes que la plus longue colonne, pas une de plus : la feuille
  // s'allonge au fil de la partie (choix de Paul, 07/10).
  for (let r = 0; r < used; r++) tbody.appendChild(sheetRow(r, changes));

  sheet.style.setProperty("--players", String(game.players.length));
  sheet.replaceChildren(thead, tbody);

  // Les colonnes s'élargissent pour le plus long prénom : « Mar… » pour Martin
  // à dix joueurs, c'était non (Paul, 07/10). Jusqu'à la largeur d'un prénom
  // de huit lettres larges ; au-delà, le nom est abrégé (…). Mesuré plutôt que
  // compté en lettres : un « M » est trois fois plus large qu'un « i », et la
  // police dépend de l'appareil. Rien à mesurer hors navigateur (tests).
  const tabs = [...sheet.querySelectorAll<HTMLElement>(".name-tab")];
  const widest = Math.min(
    Math.max(0, ...tabs.map((tab) => tab.scrollWidth)),
    longNameWidth(),
  );
  if (widest > 0) sheet.style.setProperty("--tab-width", `${widest}px`);
}

// Largeur d'un onglet portant un prénom de huit lettres larges : la limite
// d'élargissement des colonnes. Mesurée une fois, dans le style des onglets.
let longNameWidthCache = 0;
function longNameWidth(): number {
  if (longNameWidthCache > 0) return longNameWidthCache;
  const probe = document.createElement("span");
  probe.className = "name-tab";
  probe.textContent = "Mohammed";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  sheetScroll.appendChild(probe);
  longNameWidthCache = probe.scrollWidth;
  probe.remove();
  return longNameWidthCache;
}

function sheetRow(r: number, changes: SheetChanges): HTMLTableRowElement {
  const tr = document.createElement("tr");
  for (const [i, p] of game.players.entries()) {
    const td = document.createElement("td");
    td.style.setProperty("--col", p.color);
    if (i === game.currentPlayerIndex) td.className = "is-current";
    if (r < p.sheet.length) {
      fillEntry(td, p, p.sheet[r], changes);
    } else if (r === p.sheet.length && !hasOpened(p)) {
      td.classList.add("sheet-out");
      td.textContent = "—";
      td.title = p.sheet.length > 0 ? "Retombé à zéro" : "Pas encore entré en jeu";
    }
    tr.appendChild(td);
  }
  return tr;
}

function fillEntry(
  td: HTMLTableCellElement,
  p: G5000Player,
  entry: SheetEntry,
  changes: SheetChanges,
): void {
  const value = document.createElement(entry.struck ? "s" : "span");
  value.className = "entry";
  value.textContent = fmt(entry.score);
  if (changes.written?.has(entry)) value.classList.add("is-written");
  if (changes.struck?.has(entry)) value.classList.add("is-striking");
  td.appendChild(value);

  // La marque d'une rature se range contre le bord droit de la case, à l'écart
  // du score centré (demande de Paul).
  if (entry.struck) {
    td.appendChild(strikeMark(entry.struck));
  } else if (entry === liveEntry(p)) {
    td.classList.add("is-live");
    if (entry.score >= game.rules.target) td.classList.add("is-goal");
  }
}

// Sous le nom, les tours sans marquer du joueur : une pastille par tour
// toléré, comme dans le bandeau, pour voir d'un coup d'œil sur la feuille qui
// est en danger (demande de Paul). Toutes rouges dès l'avant-dernier : le
// prochain tour blanc le fera redescendre. Rien si la règle est désactivée.
function blankTurnPips(p: G5000Player): HTMLElement | null {
  const max = game.rules.blankTurnsPenalty;
  if (max <= 0) return null;
  const count = p.blankTurns;
  const danger = count >= max - 1;

  const row = document.createElement("span");
  row.className = "sheet-pips";
  row.setAttribute("role", "img");
  row.setAttribute("aria-label", `${plural(count, "bust")} d'affilée sur ${max}`);
  for (let k = 0; k < max; k++) {
    const pip = document.createElement("span");
    pip.className = "pip";
    if (k < count) pip.classList.add(danger ? "pip--danger" : "pip--on");
    row.appendChild(pip);
  }
  return row;
}

// Ce qui a fait tomber un score : un point à la couleur de celui qui a égalisé,
// ou le nombre de tours passés sans marquer.
function strikeMark(strike: Strike): HTMLElement {
  const mark = document.createElement("span");
  mark.className = `strike-mark strike-mark--${strike.kind}`;
  mark.setAttribute("role", "img");
  let label: string;
  if (strike.kind === "tie") {
    const author = game.players[strike.by ?? 0];
    mark.style.background = author.color;
    label = `rattrapé par ${author.name}`;
  } else {
    const count = game.rules.blankTurnsPenalty;
    mark.textContent = `${count}×`;
    label = `${plural(count, "bust")} d'affilée`;
  }
  mark.setAttribute("aria-label", label);
  mark.title = label;
  return mark;
}

// La feuille se lit par le bas : c'est là que s'écrit le prochain score.
function scrollSheetToEnd(): void {
  sheetScroll.scrollTop = sheetScroll.scrollHeight;
}

// Quand la feuille déborde à l'horizontale (beaucoup de joueurs), la colonne de
// celui qui joue est ramenée au milieu, ses voisins de part et d'autre : la
// main qui passe ne doit pas obliger à chercher sa colonne (demande de Paul).
// Le navigateur borne le défilement aux extrémités.
function centerCurrentColumn(behavior: ScrollBehavior): void {
  const th = sheet.tHead?.rows[0]?.cells[game.currentPlayerIndex];
  if (!th || sheetScroll.scrollWidth <= sheetScroll.clientWidth) return;
  const col = th.getBoundingClientRect();
  const view = sheetScroll.getBoundingClientRect();
  const delta = col.left + col.width / 2 - (view.left + view.width / 2);
  sheetScroll.scrollBy({ left: delta, behavior });
}

// Ce qu'un tour a changé sur les feuilles, par comparaison avec l'état d'avant.
function snapshotSheets(): { seen: Set<SheetEntry>; struck: Set<SheetEntry> } {
  const entries = game.players.flatMap((p) => p.sheet);
  return { seen: new Set(entries), struck: new Set(entries.filter((e) => e.struck)) };
}

function sheetChanges(before: ReturnType<typeof snapshotSheets>): SheetChanges {
  const entries = game.players.flatMap((p) => p.sheet);
  return {
    written: new Set(entries.filter((e) => !before.seen.has(e))),
    struck: new Set(entries.filter((e) => e.struck && !before.struck.has(e))),
  };
}

/* ---------- Choisir qui joue ---------- */
// « C'est à Marie, pas à Jean » : un onglet de la feuille ou un glissement
// donne la main à un autre joueur, et l'ordre repart de lui (cf. choosePlayer).

// Le joueur voisin qui peut jouer, dans le sens du geste ; null s'il n'y en a
// pas d'autre (riposte où il ne reste qu'un joueur, par exemple).
function neighbour(direction: 1 | -1): number | null {
  const n = game.players.length;
  for (let k = 1; k < n; k++) {
    const i = (game.currentPlayerIndex + direction * k + n * k) % n;
    if (canPlay(game, i)) return i;
  }
  return null;
}

// Un tour entamé serait perdu : on montre lequel avant, comme pour toute
// suppression de l'application.
function requestPlayer(index: number): void {
  if (index === game.currentPlayerIndex || !canPlay(game, index)) return;
  if (!turnStarted(game)) return switchTo(index);

  pendingSwitch = index;
  requireEl("switch-title").textContent = `Donner la main à ${game.players[index].name} ?`;
  const summary = requireEl("switch-summary");
  summary.replaceChildren();
  summaryRow(summary, "Tour entamé", player().name);
  summaryRow(summary, "Points du tour", fmt(game.turn.pot));
  summaryRow(summary, "Lancer", String(game.turn.rolls));
  switchDialog.showModal();
}

function switchTo(index: number): void {
  const before = game.currentPlayerIndex;
  if (!choosePlayer(game, index)) return;
  persist();
  renderBanner();
  renderSheet();
  centerCurrentColumn("smooth");
  animateName(index > before ? "next" : "prev");
}

// Seul le nom glisse, comme au Yams : le fond change de couleur en même temps,
// et animer tout le bandeau superposerait deux repeints plein écran.
function animateName(direction: "next" | "prev"): void {
  const name = requireEl("turn-name");
  name.classList.remove("name-enter", "name-enter--next", "name-enter--prev");
  void name.offsetWidth; // relance l'animation si on enchaîne vite
  name.classList.add("name-enter", `name-enter--${direction}`);
}

/* ---------- Cibles : la variante Sniper rendue jouable ---------- */

// Viser le score exact d'un adversaire est hors de portée de tête : c'est ce
// que l'application apporte vraiment. L'écart se met à jour à chaque appui.
function renderTargets(container: HTMLElement, currentPot: number): void {
  const rows = tieTargets(game, currentPot);
  container.replaceChildren();
  if (rows.length === 0) return;

  // Tous ceux qui sont devant, du plus proche au plus loin : ce qu'il manque
  // pour tomber pile sur leur score, où ils retomberaient, et ce qu'ils y
  // perdraient (demande de Paul, 07/10). Au-delà de quatre, le tableau défile
  // (cf. CSS) : la fenêtre ne doit pas grandir avec le nombre de joueurs.
  const table = document.createElement("table");
  table.className = "targets-table";
  const head = document.createElement("tr");
  for (const label of ["Devant vous", "Écart", "Retombe à", "Perd"]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    head.appendChild(th);
  }
  const thead = document.createElement("thead");
  thead.appendChild(head);

  const tbody = document.createElement("tbody");
  for (const target of rows) {
    const tr = document.createElement("tr");
    tr.className = "target-row";
    if (target.needed === 0) tr.classList.add("is-hit");
    else if (target.needed < 0) tr.classList.add("is-passed");
    else if (target.needed <= 600) tr.classList.add("is-near");

    const who = document.createElement("td");
    const name = document.createElement("span");
    name.className = "target-name";
    name.textContent = target.name;
    const score = document.createElement("span");
    score.className = "target-score";
    score.textContent = fmt(target.score);
    who.append(name, score);

    const gap = document.createElement("td");
    gap.className = "target-gap";
    gap.textContent =
      target.needed === 0
        ? "🎯 pile !"
        : target.needed > 0
          ? `+${fmt(target.needed)}`
          : "dépassé";

    const fallsTo = document.createElement("td");
    fallsTo.className = "target-falls";
    fallsTo.textContent = fmt(target.fallsTo);

    const drop = document.createElement("td");
    drop.className = "target-drop";
    drop.textContent = `−${fmt(target.score - target.fallsTo)}`;

    tr.append(who, gap, fallsTo, drop);
    tbody.appendChild(tr);
  }

  table.append(thead, tbody);
  container.appendChild(table);
}

/* ---------- Saisie rapide ---------- */

function buildChips(): void {
  quickChips.replaceChildren();
  for (const value of CHIP_VALUES) {
    quickChips.appendChild(chip(String(value), `+${fmt(value)}`, () => add(value)));
  }
  const row = document.createElement("div");
  row.className = "chips-row";
  // « Sans demi-mesure » : aucun tour ne se marque en finissant par 50, le
  // jeton n'aurait servi qu'à composer un total refusé.
  if (!hasVariant(game.rules, "noFifty")) {
    row.append(chip("fifty", `+${SCORE_STEP}`, () => add(SCORE_STEP), "chip--fifty"));
  }
  row.append(chip("back", backspaceIcon(), undo, "chip--back", "Effacer le dernier jeton"));
  quickChips.appendChild(row);
}

// `content` : un montant, ou un pictogramme dessiné — qui demande alors un
// `ariaLabel`, sans quoi le bouton n'a pas de nom pour un lecteur d'écran.
function chip(
  id: string,
  content: string | SVGSVGElement,
  onPress: () => void,
  extra = "",
  ariaLabel?: string,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = extra ? `chip ${extra}` : "chip";
  button.dataset.chip = id;
  button.append(content);
  if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
  button.addEventListener("click", onPress);
  return button;
}

// « Effacer » dessiné plutôt que le caractère ⌫ : rendu par la police de
// l'appareil, il n'avait ni la taille ni le centrage des autres jetons.
function backspaceIcon(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const shapes: [string, Record<string, string>][] = [
    ["path", { d: "M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z", "stroke-linejoin": "round" }],
    ["path", { d: "M12 9.5l5 5M17 9.5l-5 5", "stroke-linecap": "round" }],
  ];
  for (const [tag, attrs] of shapes) {
    const el = document.createElementNS(ns, tag);
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", "currentColor");
    el.setAttribute("stroke-width", "2");
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    svg.appendChild(el);
  }
  return svg;
}

function add(value: number): void {
  pot += value;
  tape.push(value);
  renderQuick();
}

function undo(): void {
  pot -= tape.pop() ?? 0;
  if (pot < 0) pot = 0;
  renderQuick();
}

function renderQuick(): void {
  const me = player();
  requireEl("quick-title").textContent = `Tour de ${me.name}`;
  quickPot.textContent = fmt(pot);

  const warning = potWarning(game, pot, fmt);

  quickAfter.replaceChildren();
  if (warning) {
    quickAfter.textContent = warning;
    quickAfter.className = "pot-after is-warning";
  } else if (pot > 0) {
    const line = afterLine(game, pot, fmt);
    quickAfter.textContent = line.text;
    quickAfter.className = line.win ? "pot-after is-win" : "pot-after";
  } else {
    quickAfter.className = "pot-after";
  }

  quickTape.textContent =
    tape.length > 1 ? tape.map((v) => `+${fmt(v)}`).join("  ") : "";

  quickBank.textContent = bankLabel(game, pot, fmt);
  requireEl("quick-bust").textContent =
    pot > 0 ? `Bust — perdre ${fmt(pot)}` : "Bust — 0 pt";
  quickBank.disabled = !canBank(game, pot, false);

  renderTargets(quickTargets, pot);
}

function openQuick(): void {
  pot = 0;
  tape = [];
  renderQuick();
  quickDialog.showModal();
}

// La saisie rapide annonce le tour d'un bloc : il remplace ce qu'une
// calculette ouverte puis fermée aurait laissé en cours (pot, série de mains
// pleines), et son pot devient celui du tour — perdu sur « Bust », il compte
// pour le record du pot perdu comme celui de la calculette.
function finishQuick(how: "bank" | "bust"): void {
  startTurn(game);
  game.turn.pot = pot;
  onTurnFinished(how);
}

/* ---------- Fin de tour ---------- */

function onTurnFinished(how: TurnFinish): void {
  const before = snapshotSheets();
  const { moves, ended: over } = finishTurn(game, how);
  persist();

  quickDialog.close();
  renderBanner();
  // Les animations attendent que la cascade soit refermée (cf. CSS) : sous le
  // dialogue, personne ne verrait le score s'écrire ni le trait se tracer.
  renderSheet(sheetChanges(before));
  scrollSheetToEnd();
  centerCurrentColumn("smooth");

  // Les redescentes sont montrées avant de rendre la main : un score qui change
  // tout seul, sans explication, est incompréhensible à la table.
  const falls = moves.filter((m) => m.kind !== "bank" && m.kind !== "win");
  if (falls.length > 0) showCascade(moves);
  else if (over) goTo("g5000End");
}

function showCascade(moves: Move[]): void {
  const list = requireEl("cascade-list");
  const hasTie = moves.some((m) => m.kind === "tie");
  requireEl("cascade-title").textContent = hasTie
    ? "🎯 Sniper !"
    : `${plural(game.rules.blankTurnsPenalty, "bust")} d'affilée`;

  list.replaceChildren();
  let delay = 0;
  for (const move of moves) {
    if (move.kind === "win") continue;
    if (delay > 0) {
      const arrow = document.createElement("div");
      arrow.className = "cascade-arrow";
      arrow.textContent = "↓";
      arrow.style.setProperty("--d", `${delay}s`);
      list.appendChild(arrow);
      delay += 0.18;
    }
    list.appendChild(cascadeStep(move, delay));
    delay += 0.32;
  }
  cascadeDialog.showModal();
}

function cascadeStep(move: Move, delay: number): HTMLElement {
  const el = document.createElement("div");
  el.className = `cascade-step cascade-step--${move.kind}`;
  el.style.setProperty("--d", `${delay}s`);

  const name = document.createElement("span");
  name.className = "cascade-name";
  name.textContent = game.players[move.player].name;

  const why = document.createElement("span");
  why.className = "cascade-why";
  why.textContent =
    move.kind === "bank"
      ? "banque"
      : move.kind === "penalty"
        ? "busts d'affilée"
        : `rattrapé par ${game.players[move.by ?? 0].name}`;

  const amount = document.createElement("span");
  amount.className = "cascade-move";
  if (move.kind === "bank") {
    amount.textContent = `${fmt(move.from)} → ${fmt(move.to)}`;
  } else {
    const gone = document.createElement("s");
    gone.textContent = fmt(move.from);
    const drop = document.createElement("span");
    drop.className = "cascade-drop";
    drop.textContent = `−${fmt(move.from - move.to)}`;
    amount.append(gone, ` → ${fmt(move.to)} `, drop);
  }

  el.append(name, why, amount);
  return el;
}

// La calculette tient l'état du tour (pot, dés restants, chiffres activés) et
// nous rend la main à la fin du tour, comme la saisie rapide.
const calculator = createCalculator(game, {
  onFinish: onTurnFinished,
  onChange: persist,
  renderTargets,
  format: fmt,
});

/* ---------- Mise en route ---------- */

requireEl("game-label").textContent = `${G5000.icon} 5000 · ${fmt(game.rules.target)} pts`;

buildChips();
renderBanner();
renderSheet();
scrollSheetToEnd();
centerCurrentColumn("instant");

requireEl("play-btn").addEventListener("click", () => calculator.open());
requireEl("quick-btn").addEventListener("click", openQuick);

quickBank.addEventListener("click", () => finishQuick("bank"));
requireEl("quick-bust").addEventListener("click", () => finishQuick("bust"));
requireEl("quick-cancel").addEventListener("click", () => quickDialog.close());

// Sur l'événement `close` et non sur le clic : Échap ou le geste retour ferment
// aussi le dialogue, et une partie finie doit alors quand même mener au podium.
requireEl("cascade-ok").addEventListener("click", () => cascadeDialog.close());
cascadeDialog.addEventListener("close", () => {
  if (game.ended) goTo("g5000End");
});

// Glisser change de joueur, sauf sur la feuille quand elle défile elle-même à
// l'horizontale (beaucoup de joueurs) : le doigt veut alors la faire défiler.
onHorizontalSwipe(
  screen,
  (direction) => {
    const index = neighbour(direction);
    if (index !== null) requestPlayer(index);
  },
  {
    ignore: (target) => {
      const scroller = (target as Element | null)?.closest?.(".sheet-scroll");
      return !!scroller && scroller.scrollWidth > scroller.clientWidth;
    },
  },
);

makeDismissible(switchDialog, "switch-cancel");
switchDialog.addEventListener("close", () => {
  pendingSwitch = null;
});
requireEl("switch-confirm").addEventListener("click", () => {
  const index = pendingSwitch;
  switchDialog.close();
  if (index !== null) switchTo(index);
});

turnHint.addEventListener("click", () => {
  const index = expectedPlayer(game);
  if (index !== null) requestPlayer(index);
});

requireEl("pause-btn").addEventListener("click", () => {
  persist();
  goTo("g5000Home");
});

makeDismissible(quickDialog);

keepScreenOn();
