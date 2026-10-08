// Écran de partie du 5000.
//
// La feuille de progression est le sujet de l'écran : au 5000 le score n'est
// pas un nombre mais une suite de cumuls, et ce sont eux que les busts
// d'affilée et la variante Sniper mettent en jeu. Elle imite la feuille de
// papier qu'on tiendrait à la table : chacun écrit son total sous le précédent,
// et ce qui tombe est barré, pas effacé.
//
// Deux portes d'entrée en bas : la calculette assistée pour qui découvre le jeu,
// la saisie manuelle (« les paliers ») pour qui sait déjà ce qu'il a marqué,
// et le Bust rapide. Ouvertes, elles se posent en bas à la place de la barre,
// sans voile : le « pupitre » (refonte du 08/10). Avec Sniper, l'écart exact
// vers chaque adversaire — le seul service qu'un joueur ne peut pas se rendre
// de tête — est au tableau des cibles de la calculette, et sur les cases des
// paliers (un point de couleur = pile sur cet adversaire).
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
  canUndoLastTurn,
  choosePlayer,
  currentScore,
  expectedPlayer,
  finishTurn,
  hasOpened,
  isOvershoot,
  liveEntry,
  tieTargets,
  turnStarted,
  undoLastTurn,
  type Move,
  type TurnFinish,
} from "../../games/g5000/engine";
import type { G5000Player, LastTurn, SheetEntry, Strike } from "../../games/g5000/types";
import { formatScore } from "../../core/format";
import { createCalculator } from "./calculator";
import { createQuickEntry } from "./quickEntry";
import { G5000 } from "../../games/g5000/gameDef";
import { applyGameTheme } from "../gameTheme";
import { icon } from "../../core/icons";

bootstrap();

const saved = getSavedGame();
if (!saved) {
  goTo("g5000Home");
  throw new Error("Aucune partie en cours : retour à l'accueil du 5000.");
}
const game = saved; // alias non-null

// `?review` : consultation depuis l'écran de fin — la feuille en lecture
// seule, sans saisie ni joueur qui a la main. Seulement pour une partie finie.
// `recorded` couvre les parties finies avant l'arrivée de `ended`.
const finished = Boolean(game.ended || game.recorded);
const isReview = finished && new URLSearchParams(location.search).has("review");

// Une partie finie ne se rejoue pas : on y revient par le geste retour depuis
// l'écran de fin, ou en rechargeant pendant l'annonce de la dernière cascade.
if (finished && !isReview) {
  goTo("g5000End");
  throw new Error("Partie terminée : passage à l'écran de fin.");
}

const screen = requireEl("g5000-screen");
const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const banner = requireEl("turn-banner");
const sheet = requireEl<HTMLTableElement>("score-sheet");
const sheetScroll = requireEl("sheet-scroll");

const cascadeDialog = requireEl<HTMLDialogElement>("cascade-dialog");
const turnHint = requireEl<HTMLButtonElement>("turn-hint");
const switchDialog = requireEl<HTMLDialogElement>("switch-dialog");
const undoDialog = requireEl<HTMLDialogElement>("undo-dialog");

const fmt = formatScore;

const player = () => game.players[game.currentPlayerIndex];

// Joueur à qui donner la main une fois le changement confirmé.
let pendingSwitch: number | null = null;

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
  // Une graduation tous les 1 000 points, comme sur une règle.
  requireEl("gauge-fill").parentElement?.style.setProperty(
    "--ticks",
    String(Math.max(1, Math.round(game.rules.target / 1000))),
  );

  previewPot(0);
  renderBlankTurns();
  renderTurnHint();
}

// Pendant la saisie (calculette ou paliers), la jauge montre en hachuré
// où le pot mènerait le joueur. Effacé à la fermeture de la fenêtre.
function previewPot(currentPot: number): void {
  const reach = currentScore(player()) + currentPot;
  requireEl("gauge-pot").style.width =
    currentPot > 0 ? `${Math.min(100, (reach / game.rules.target) * 100)}%` : "0";
  // La feuille aussi : le score au crayon dans la colonne, « pile ! » sur
  // l'adversaire visé. Redessinée seulement quand le pot change.
  if (currentPot === pendingPot) return;
  pendingPot = currentPot;
  if (entering) {
    renderSheet();
    scrollSheetToEnd();
  }
}

// Une saisie est ouverte (le pupitre), et le pot qu'elle montre : la feuille
// réserve la case de celui qui joue et y écrit ce pot au crayon.
let entering = false;
let pendingPot = 0;

// Le temps de voir la jauge du joueur qui vient de banquer se remplir, avant
// que le bandeau passe au joueur suivant.
const BANK_ANIM_MS = 950;

// Banquer : la jauge de celui qui banque (le bandeau le montre encore) se
// remplit jusqu'à son nouveau score, et le gain s'envole au bout.
function showBank(from: number, to: number): void {
  const track = requireEl("gauge-fill").parentElement;
  const ratio = Math.min(1, to / game.rules.target);
  requireEl("gauge-pot").style.width = "0";
  requireEl("gauge-score").textContent = fmt(to);
  requireEl("gauge-fill").style.width = `${ratio * 100}%`;
  if (!track) return;
  const gain = document.createElement("span");
  gain.className = "gauge-gain";
  gain.setAttribute("aria-hidden", "true");
  gain.textContent = `+${fmt(to - from)}`;
  gain.style.left = `${track.offsetLeft + track.offsetWidth * ratio}px`;
  gain.addEventListener("animationend", () => gain.remove(), { once: true });
  track.parentElement?.appendChild(gain);
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

// Pendant une saisie : la case de celui qui joue est réservée sur la feuille,
// et le pot de la saisie s'y écrit au crayon.
const pendingFor = (): number => (entering && !isReview ? game.currentPlayerIndex : -1);

function renderSheet(changes: SheetChanges = {}): void {
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  // Les noms en tête de colonne servent d'onglets : toucher un joueur lui
  // donne la main. En fin de partie, ceux qui ne rejouent plus sont grisés.
  game.players.forEach((p, i) => {
    const th = document.createElement("th");
    th.style.setProperty("--col", p.color);
    // Le nom sur un intercalaire de sa couleur, le langage du bandeau : il
    // doit se lire avant les scores, pas après (demande de Paul). Ses busts
    // d'affilée dessous, dans l'onglet.
    const tab = document.createElement("span");
    tab.className = "name-tab";
    const name = document.createElement("span");
    name.className = "name-tab-text";
    name.textContent = p.name;
    tab.appendChild(name);
    // En consultation, la partie est finie : ni busts en cours, ni main à
    // donner — des onglets neutres.
    const pips = isReview ? null : blankTurnPips(p);
    if (pips) tab.appendChild(pips);
    th.appendChild(tab);
    if (!isReview) markTab(th, p, i);
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  const pending = pendingFor();
  const started = game.players.some((p) => p.sheet.length > 0) || pending >= 0;
  // Un joueur sans score en vigueur a un tiret sous sa colonne : il n'est pas
  // (ou plus) entré en jeu. Il prend une ligne — sauf avant le premier score,
  // où un message remplace la feuille. Pendant une saisie, la case de celui
  // qui joue est réservée (elle remplace son tiret).
  const used = started
    ? Math.max(
        ...game.players.map(
          (p, i) => p.sheet.length + (i === pending || !hasOpened(p) ? 1 : 0),
        ),
      )
    : 0;
  // Les adversaires sur qui le pot de la saisie tomberait pile (Sniper).
  const hits = new Set(
    pending >= 0 && pendingPot > 0
      ? tieTargets(game, pendingPot)
          .filter((t) => t.needed === 0)
          .map((t) => t.index)
      : [],
  );

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
  for (let r = 0; r < used; r++) tbody.appendChild(sheetRow(r, changes, hits));

  sheet.style.setProperty("--players", String(game.players.length));
  // Colonnes réglées sur le plus long nombre de la partie : « 5 050 » entouré
  // à 5 000 (quatre joueurs tiennent sur un téléphone de 360 px), « 10 000 »
  // au-delà.
  sheet.style.setProperty("--num-min", game.rules.target >= 10000 ? "5.5rem" : "4.85rem");
  sheet.replaceChildren(thead, tbody);

  // Les colonnes s'élargissent pour le plus long prénom : « Mar… » pour Martin
  // à dix joueurs, c'était non (Paul, 07/10). Jusqu'à la largeur d'un prénom
  // de huit lettres larges ; au-delà, le nom est abrégé (…). Mesuré plutôt que
  // compté en lettres : un « M » est trois fois plus large qu'un « i », et la
  // police dépend de l'appareil. Rien à mesurer hors navigateur (tests). On
  // mesure le nom lui-même : l'intercalaire remplit sa colonne, sa largeur
  // serait celle de la colonne (la CSS ajoute ses marges, cf. --col-min).
  const names = [...sheet.querySelectorAll<HTMLElement>(".name-tab-text")];
  const widest = Math.min(
    Math.max(0, ...names.map((name) => name.scrollWidth)),
    longNameWidth(),
  );
  if (widest > 0) sheet.style.setProperty("--tab-width", `${widest}px`);
}

// L'onglet d'un joueur pendant la partie : celui qui a la main, ceux à qui on
// peut la donner, et en fin de partie ceux qui ne rejouent plus (grisés).
function markTab(th: HTMLTableCellElement, p: G5000Player, i: number): void {
  if (i === game.currentPlayerIndex) {
    th.className = "is-current";
    th.setAttribute("aria-current", "true");
  } else if (canPlay(game, i)) {
    th.classList.add("is-choosable");
    makeActivatable(th, `Donner la main à ${p.name}`, () => requestPlayer(i));
  } else {
    th.classList.add("is-out");
  }
}

// Largeur d'un onglet portant un prénom de huit lettres larges : la limite
// d'élargissement des colonnes. Mesurée une fois, dans le style des onglets.
let longNameWidthCache = 0;
function longNameWidth(): number {
  if (longNameWidthCache > 0) return longNameWidthCache;
  const probe = document.createElement("span");
  probe.className = "name-tab";
  const probeText = document.createElement("span");
  probeText.className = "name-tab-text";
  probeText.textContent = "Mohammed";
  probe.appendChild(probeText);
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  sheetScroll.appendChild(probe);
  longNameWidthCache = probeText.scrollWidth;
  probe.remove();
  return longNameWidthCache;
}

function sheetRow(r: number, changes: SheetChanges, hits: Set<number>): HTMLTableRowElement {
  const tr = document.createElement("tr");
  for (const [i, p] of game.players.entries()) {
    const td = document.createElement("td");
    td.style.setProperty("--col", p.color);
    if (i === game.currentPlayerIndex && !isReview) td.className = "is-current";
    if (r < p.sheet.length) {
      fillEntry(td, p, p.sheet[r], changes);
      if (hits.has(i) && p.sheet[r] === liveEntry(p)) td.classList.add("is-hit");
    } else if (r === p.sheet.length && i === pendingFor()) {
      fillPending(td, p);
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
  if (changes.written?.has(entry)) {
    value.classList.add("is-written");
    td.classList.add("has-written"); // le cercle de l'objectif se trace avec lui
  }
  if (changes.struck?.has(entry)) value.classList.add("is-striking");
  td.appendChild(value);

  // La marque d'une rature se range contre le bord droit de la case, à l'écart
  // du score centré (demande de Paul).
  if (entry.struck) {
    td.appendChild(strikeMark(entry.struck));
  } else if (entry === liveEntry(p)) {
    td.classList.add("is-live");
    if (entry.score >= game.rules.target) {
      td.classList.add("is-goal");
      value.appendChild(goalCircle());
    }
  }
}

// Au crayon, pendant la saisie : où arriverait le joueur, et ce que le tour
// rapporte en petit. Barré si ce pot ne se banquerait pas. Sans pot, la case
// reste vide (pas de crayon qui attend : refusé par Paul).
function fillPending(td: HTMLTableCellElement, p: G5000Player): void {
  td.classList.add("pending-cell");
  if (pendingPot <= 0) return;
  td.classList.add("is-pending");
  if (isOvershoot(game, pendingPot) || !canBank(game, pendingPot, false)) {
    td.classList.add("is-blocked");
  }
  const gain = document.createElement("span");
  gain.className = "pending-gain";
  gain.textContent = `+${fmt(pendingPot)}`;
  const value = document.createElement("span");
  value.className = "entry";
  value.textContent = fmt(currentScore(p) + pendingPot);
  td.append(gain, value);
}

const SVG_NS = "http://www.w3.org/2000/svg";

// L'objectif atteint, entouré au feutre comme sur papier (et comme l'objectif
// sur l'accueil) : le cercle se trace quand le score s'écrit.
function goalCircle(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "goal-circle");
  svg.setAttribute("viewBox", "0 0 100 50");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("pathLength", "1");
  path.setAttribute(
    "d",
    "M60 5 C 86 4, 97 15, 95 27 C 93 42, 70 47, 46 46 C 20 45, 4 38, 5 24 C 6 12, 25 5, 52 5 C 60 5, 67 7, 72 10",
  );
  svg.appendChild(path);
  return svg;
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
  // Un score choisi aux paliers est un tour entamé lui aussi.
  const started = turnStarted(game);
  const draft = quick.draftPot();
  if (!started && draft === null) return switchTo(index);

  pendingSwitch = index;
  requireEl("switch-title").textContent = `Donner la main à ${game.players[index].name} ?`;
  const summary = requireEl("switch-summary");
  summary.replaceChildren();
  summaryRow(summary, "Tour entamé", player().name);
  summaryRow(summary, "Points du tour", fmt(started ? game.turn.pot : (draft ?? 0)));
  if (started) summaryRow(summary, "Lancer", String(game.turn.rolls));
  switchDialog.showModal();
}

function switchTo(index: number): void {
  const before = game.currentPlayerIndex;
  if (!choosePlayer(game, index)) return;
  // La saisie ouverte était celle de l'ancien joueur.
  closeEntry();
  quick.clear();
  replayOf = null;
  renderLastTurn();
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

// Les adversaires sur qui le pot tombait déjà pile au rendu précédent : les
// cibles sont redessinées à chaque touche, mais une cible ne s'allume (rebond)
// qu'au moment où elle DEVIENT pile.
let hitBefore = new Set<number>();
// Le tableau détaillé (retombe à, perd) est replié par défaut : la feuille,
// visible au-dessus du pupitre, montre déjà les scores (décision du 08/10).
// Déplié une fois, il le reste pour la partie.
let targetsOpen = false;

// Viser le score exact d'un adversaire est hors de portée de tête : c'est ce
// que l'application apporte vraiment. Une pastille par adversaire devant, avec
// l'écart exact ; « Détail » déplie le tableau. Sans Sniper, une égalité ne
// fait rien : pas de cibles (la feuille dit qui est devant).
function renderTargets(container: HTMLElement, currentPot: number): void {
  const rows = tieTargets(game, currentPot);
  container.replaceChildren();
  if (rows.length === 0) {
    hitBefore = new Set();
    return;
  }
  const hits = new Set(rows.filter((t) => t.needed === 0).map((t) => t.index));

  const lead = document.createElement("span");
  lead.className = "aim-lead";
  lead.textContent = "Viser";
  // Les pastilles défilent à l'horizontale : « Détail » reste au bout, en vue,
  // quel que soit le nombre d'adversaires devant.
  const chips = document.createElement("div");
  chips.className = "aim-chips";
  container.append(lead, chips);
  for (const target of rows) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "aim-chip";
    chip.style.setProperty("--col", game.players[target.index].color);
    if (target.needed === 0) {
      chip.classList.add("is-hit");
      if (!hitBefore.has(target.index)) chip.classList.add("is-hit-new");
    } else if (target.needed < 0) chip.classList.add("is-passed");
    const dot = document.createElement("i");
    const gap = document.createElement("b");
    gap.textContent =
      target.needed === 0 ? "pile !" : target.needed > 0 ? `+${fmt(target.needed)}` : "dépassé";
    chip.append(dot, target.name, " ", gap);
    // Toucher un adversaire déplie le détail, comme « Détail ».
    chip.addEventListener("click", () => toggleTargets(container, currentPot));
    chips.appendChild(chip);
  }
  const more = document.createElement("button");
  more.type = "button";
  more.className = "aim-more";
  more.textContent = targetsOpen ? "Masquer" : "Détail";
  more.setAttribute("aria-expanded", String(targetsOpen));
  more.addEventListener("click", () => toggleTargets(container, currentPot));
  container.appendChild(more);
  if (targetsOpen) container.appendChild(targetsTable(rows));
  hitBefore = hits;
}

function toggleTargets(container: HTMLElement, currentPot: number): void {
  targetsOpen = !targetsOpen;
  // Même pot : rien ne doit rebondir à nouveau.
  renderTargets(container, currentPot);
}

// Le tableau d'avant : tous ceux qui sont devant, du plus proche au plus loin,
// ce qu'il manque pour tomber pile sur leur score, où ils retomberaient, et ce
// qu'ils y perdraient (demande de Paul, 07/10). Au-delà de quatre, il défile.
function targetsTable(rows: ReturnType<typeof tieTargets>): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "targets";
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
    if (target.needed === 0) {
      const hit = document.createElement("span");
      hit.className = "target-hit";
      hit.append(icon("crosshair"), "pile !");
      gap.appendChild(hit);
    } else gap.textContent = target.needed > 0 ? `+${fmt(target.needed)}` : "dépassé";

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
  wrap.appendChild(table);
  return wrap;
}

/* ---------- Fin de tour ---------- */

function onTurnFinished(how: TurnFinish): void {
  const before = snapshotSheets();
  const banker = player();
  const scoreBefore = currentScore(banker);
  const { moves, ended: over } = finishTurn(game, how);
  persist();
  quick.clear();
  replayOf = null;
  renderLastTurn();

  quick.close();
  // A-t-il banqué ? Alors sa jauge se remplit d'abord, et le bandeau ne
  // passe au joueur suivant qu'ensuite.
  const scoreAfter = currentScore(banker);
  const banked = scoreAfter > scoreBefore;
  if (banked) {
    showBank(scoreBefore, scoreAfter);
    // La main est déjà passée, mais le bandeau montre encore le banquier : un
    // toucher rapide ouvrirait la saisie du suivant sous son nom. Les deux
    // portes d'entrée attendent que le bandeau ait changé.
    setEntryEnabled(false);
    window.setTimeout(() => {
      renderBanner();
      setEntryEnabled(true);
    }, BANK_ANIM_MS);
  } else {
    renderBanner();
  }
  // Les animations attendent que la cascade soit refermée (cf. CSS) : sous le
  // dialogue, personne ne verrait le score s'écrire ni le trait se tracer.
  renderSheet(sheetChanges(before));
  scrollSheetToEnd();
  centerCurrentColumn("smooth");

  // Les redescentes sont montrées avant de rendre la main : un score qui change
  // tout seul, sans explication, est incompréhensible à la table.
  const falls = moves.filter((m) => m.kind !== "bank" && m.kind !== "win");
  if (falls.length > 0) showCascade(moves);
  else if (over) window.setTimeout(() => goTo("g5000End"), banked ? BANK_ANIM_MS : 0);
}

function setEntryEnabled(enabled: boolean): void {
  for (const id of ["play-btn", "quick-btn", "bar-bust"]) {
    requireEl<HTMLButtonElement>(id).disabled = !enabled;
  }
}

/* ---------- Le pupitre ---------- */
// Les deux saisies ne sont plus des fenêtres : elles se posent en bas, à la
// place de la barre, et la feuille reste visible au-dessus — c'est elle que le
// tour va modifier. Le bandeau se résume à une ligne (nom et jauge) le temps de
// la saisie, et la ligne « Dernier tour » s'efface (cf. CSS, `.is-entering`).

const entryDialogs = (): HTMLDialogElement[] => [calculator.dialog, quick.dialog];

function openEntry(open: () => void): void {
  open();
  setEntering(true);
}

function closeEntry(): void {
  for (const dialog of entryDialogs()) dialog.close();
}

function setEntering(on: boolean): void {
  screen.classList.toggle("is-entering", on);
  requireEl("entry-bar").hidden = on;
  if (on !== entering) {
    entering = on;
    // La case de celui qui joue se réserve (ou se libère) sur la feuille.
    renderSheet();
  }
  // La feuille a rétréci : sa dernière ligne et la colonne de celui qui joue
  // doivent rester en vue au-dessus du pupitre.
  if (on) {
    requestAnimationFrame(() => {
      scrollSheetToEnd();
      centerCurrentColumn("instant");
    });
  }
}

// Le Bust de la barre du bas : le bust du premier lancer, sans rien ouvrir. Un
// tour entamé (score choisi aux paliers, ou calculette refermée en cours
// de tour) est perdu avec son pot, comme s'il avait été déclaré de là.
function quickBust(): void {
  if (quick.draftPot() !== null) return quick.bust();
  onTurnFinished("bust");
}

function showCascade(moves: Move[]): void {
  const list = requireEl("cascade-list");
  const hasTie = moves.some((m) => m.kind === "tie");
  requireEl("cascade-title").replaceChildren(
    ...(hasTie
      ? [icon("crosshair"), "Sniper !"]
      : [`${plural(game.rules.blankTurnsPenalty, "bust")} d'affilée`]),
  );

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
// nous rend la main à la fin du tour, comme la saisie manuelle (quickEntry.ts,
// les paliers), qui garde le score choisi jusqu'à la fin du tour.
const quick = createQuickEntry(game, {
  onFinish: onTurnFinished,
  previewPot,
  format: fmt,
});

const calculator = createCalculator(game, {
  onFinish: onTurnFinished,
  onChange: persist,
  renderTargets,
  previewPot,
  format: fmt,
});

/* ---------- Corriger le dernier tour ---------- */
// Une saisie fausse (650 au lieu de 600, « Bust » au lieu de « Banquer ») ne
// se rattrapait pas une fois la main passée. La ligne « Dernier tour » dit ce
// qui vient d'être écrit ; « Corriger » ramène la partie à l'état d'avant ce
// tour (undoLastTurn), et son joueur le rejoue. Un seul tour en arrière, et
// pas une fois la partie finie (lot C de l'audit du 08/10).

// Le joueur dont le tour vient d'être repris : la ligne le rappelle tant qu'il
// n'a pas rejoué. En mémoire seulement.
let replayOf: string | null = null;

function renderLastTurn(): void {
  const strip = requireEl("last-turn");
  const text = requireEl("last-turn-text");
  const fix = requireEl<HTMLButtonElement>("undo-btn");
  const last = game.lastTurn;
  if (isReview || (!replayOf && !(last && canUndoLastTurn(game)))) {
    strip.hidden = true;
    return;
  }
  strip.hidden = false;
  if (replayOf) {
    text.replaceChildren(`Tour de ${replayOf} repris : à rejouer.`);
    fix.hidden = true;
    return;
  }
  if (!last) return;
  const name = game.players[last.player].name;
  text.replaceChildren(...lastTurnText(last));
  fix.hidden = false;
  fix.setAttribute("aria-label", `Corriger le tour de ${name}`);
}

// « Bob +650 → 2 050 · Alice redescend », « Bob : bust, 350 perdus ».
function lastTurnText(last: LastTurn): (Node | string)[] {
  const p = game.players[last.player];
  const dot = document.createElement("span");
  dot.className = "last-turn-dot";
  dot.style.background = p.color;
  const strong = (t: string): HTMLElement => {
    const b = document.createElement("b");
    b.textContent = t;
    return b;
  };
  const parts: (Node | string)[] = [dot, `${p.name} `];
  const bank = last.moves.find((m) => m.kind === "bank" && m.player === last.player);
  if (bank) {
    parts.push(strong(`+${fmt(bank.to - bank.from)}`), " → ", strong(fmt(bank.to)));
  } else {
    parts.push(last.pot > 0 ? `: bust, ${fmt(last.pot)} perdus` : ": bust");
  }
  const fell = fallenPlayers(last);
  if (fell.length > 0) {
    const names = fell.map((m) => game.players[m.player].name);
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names.at(-1)}` : names[0];
    parts.push(` · ${list} ${names.length > 1 ? "redescendent" : "redescend"}`);
  }
  const penalty = last.moves.find((m) => m.kind === "penalty");
  if (penalty) parts.push(` · retombe à ${fmt(penalty.to)}`);
  if (last.moves.some((m) => m.kind === "win")) parts.push(" · objectif atteint");
  return parts;
}

// Les adversaires que ce tour a fait redescendre (Sniper), une fois chacun.
function fallenPlayers(last: LastTurn): Move[] {
  return last.moves.filter(
    (m, i, all) => m.kind === "tie" && all.findIndex((o) => o.kind === "tie" && o.player === m.player) === i,
  );
}

// Ce que la reprise va défaire, comme toute suppression de l'appli.
function requestUndo(): void {
  const last = game.lastTurn;
  const previous = game.previous;
  if (!last || !previous || !canUndoLastTurn(game)) return;
  const name = game.players[last.player].name;
  requireEl("undo-title").textContent = `Reprendre le tour de ${name} ?`;

  const summary = requireEl("undo-summary");
  summary.replaceChildren();
  const bank = last.moves.find((m) => m.kind === "bank" && m.player === last.player);
  summaryRow(
    summary,
    "Tour enregistré",
    bank
      ? `+${fmt(bank.to - bank.from)} (${fmt(bank.from)} → ${fmt(bank.to)})`
      : last.pot > 0
        ? `Bust (${fmt(last.pot)} perdus)`
        : "Bust",
  );
  for (const move of fallenPlayers(last)) {
    summaryRow(summary, game.players[move.player].name, `retrouve ${fmt(move.from)}`);
  }
  const penalty = last.moves.find((m) => m.kind === "penalty");
  if (penalty) {
    summaryRow(summary, "Busts d'affilée", `${name} retrouve ${fmt(penalty.from)}`);
  } else if (!bank) {
    const before = previous.players[last.player].blankTurns;
    const after = game.players[last.player].blankTurns;
    if (before !== after) summaryRow(summary, "Busts d'affilée", `${after} → ${before}`);
  }
  if (last.moves.some((m) => m.kind === "win")) {
    summaryRow(summary, "Objectif", "plus atteint : la riposte est annulée");
  }
  // Le tour de celui qui a la main maintenant, s'il l'a commencé.
  const started = turnStarted(game);
  const draft = quick.draftPot();
  if (started || draft !== null) {
    summaryRow(
      summary,
      `Tour de ${player().name}`,
      `entamé : ${fmt(started ? game.turn.pot : (draft ?? 0))}, sera perdu`,
    );
  }
  requireEl("undo-warn").textContent =
    `Le tour disparaît de la feuille, comme s'il n'avait pas été joué. ${name} le ressaisit ensuite.`;
  undoDialog.showModal();
}

function confirmUndo(): void {
  const last = game.lastTurn;
  if (!last || !undoLastTurn(game)) return;
  closeEntry();
  quick.clear();
  replayOf = game.players[last.player].name;
  persist();
  renderBanner();
  renderSheet();
  scrollSheetToEnd();
  centerCurrentColumn("smooth");
  renderLastTurn();
  animateName("prev");
}

/* ---------- Consultation ---------- */

// Depuis l'écran de fin : la feuille seule. Plus de bandeau (personne n'a la
// main), ni pause ni saisie ; la barre du bas ramène au classement.
function showReview(): void {
  screen.classList.add("review");
  banner.hidden = true;
  requireEl("pause-btn").hidden = true;
  requireEl("entry-bar").hidden = true;
  requireEl("review-bar").hidden = false;
}

/* ---------- Mise en route ---------- */

// « 5000 » à l'encre du jeu, l'objectif en plus petit derrière.
const labelDetail = document.createElement("span");
labelDetail.className = "game-label-detail";
labelDetail.textContent = ` · ${fmt(game.rules.target)} pts`;
requireEl("game-label").replaceChildren(G5000.title, labelDetail);
applyGameTheme(screen, G5000);

if (isReview) showReview();
else renderBanner();
renderSheet();
scrollSheetToEnd();
if (!isReview) centerCurrentColumn("instant");

requireEl("play-btn").addEventListener("click", () => openEntry(calculator.open));
requireEl("quick-btn").addEventListener("click", () => openEntry(quick.open));
requireEl("bar-bust").addEventListener("click", quickBust);
// Refermée (flèche, Échap, banque, bust, main donnée à un autre) : la barre
// revient. Le pupitre suivant s'ouvrira de toute façon par elle.
for (const dialog of entryDialogs()) {
  dialog.addEventListener("close", () => setEntering(entryDialogs().some((d) => d.open)));
}
// Le pupitre change de hauteur au fil de la saisie (combinaisons, tableau des
// cibles) : la feuille, qui rétrécit d'autant, reste calée sur sa dernière
// ligne, celle que le tour va écrire. Rien à observer sous jsdom (tests).
if ("ResizeObserver" in window) {
  new ResizeObserver(() => {
    if (screen.classList.contains("is-entering")) scrollSheetToEnd();
  }).observe(sheetScroll);
}
// Non modal, le pupitre ne se ferme pas tout seul à Échap. Une fenêtre de
// confirmation ouverte par-dessus (recommencer, changer de joueur…) garde
// Échap pour elle.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || document.querySelector("dialog:not(.pupitre)[open]")) return;
  closeEntry();
});

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
      const el = target as Element | null;
      // Sur le pupitre, le doigt touche des touches ou fait défiler un tableau.
      if (el?.closest?.("dialog.pupitre")) return true;
      const scroller = el?.closest?.(".sheet-scroll");
      return !!scroller && scroller.scrollWidth > scroller.clientWidth;
    },
  },
);

requireEl("undo-btn").addEventListener("click", requestUndo);
makeDismissible(undoDialog, "undo-cancel");
requireEl("undo-confirm").addEventListener("click", () => {
  undoDialog.close();
  confirmUndo();
});
renderLastTurn();

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

// Calculette refermée sans banquer : plus de pot à montrer sur la jauge (la
// saisie manuelle s'en charge elle-même).
requireEl("calc-dialog").addEventListener("close", () => previewPot(0));

if (!isReview) keepScreenOn();
