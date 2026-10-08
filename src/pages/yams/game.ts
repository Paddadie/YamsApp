// Page de jeu : grille de score du joueur courant, navigation entre joueurs,
// sauvegarde continue de la partie.
//
// Le tableau n'est reconstruit qu'au changement de joueur ; une saisie ne
// rafraîchit que la colonne concernée (valeur, verrous Montante/Descendante,
// lignes calculées), sans perdre le focus.
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).

import { bootstrap } from "../../core/bootstrap";
import { YAMS } from "../../games/yams/gameDef";
import { applyGameTheme } from "../gameTheme";
import { goTo } from "../../core/nav";
import { variantBadge } from "../../games/yams/variantBadge";
import { sheetOf } from "../../games/yams/players";
import { makeDismissible, plural, requireEl, turnHintContent } from "../../core/ui";
import { dieFace } from "../../core/dice";
import { handCircle } from "../../core/icons";
import { onHorizontalSwipe } from "../../core/swipe";
import { keepScreenOn } from "../../core/wakeLock";
import { getSavedGame, saveSavedGame } from "../../games/yams/storage/savedGameRepo";
import { getPrefs } from "../../games/yams/storage/prefsRepo";
import {
  bonusPlan,
  buildGrid,
  isLineEnabled,
  isGameFinished,
  playerToPlay,
  computeDerived,
  writeDerived,
  BONUS_LINE,
  BONUS_THRESHOLD,
  DERIVED_LINES,
  FINAL_SCORE_LINE,
  LOWER_TOTAL_LINE,
  PLAN_MAX_LINES,
  UPPER_LINES,
  UPPER_TOTAL_LINE,
  lineLabel,
  nextLine,
  type BonusPlan,
  type BonusPlanStep,
  type Derived,
} from "../../games/yams/scoring";
import type { LineName, LineScores, Player, Variant } from "../../games/yams/types";

type OnPick = (value: number | undefined) => void;

const AUTO_ADVANCE_MS = 800;

bootstrap();

const saved = getSavedGame();
if (!saved) {
  goTo("yamsHome");
  throw new Error("Aucune partie en cours : retour à l'accueil.");
}
// La partie sauvegardée EST l'état de l'écran : on la modifie, puis on la
// réécrit (persist).
const game = saved;

// Grille figée pour toute la partie (règles copiées au lancement).
const grid = buildGrid(game.rules);

// Lu une fois au chargement, comme tout le reste de l'état : chaque navigation
// recharge la page, un changement dans les Paramètres est donc pris en compte
// dès le retour sur l'écran de jeu.
const showBonusHint = getPrefs().bonusHint;

// `?review` : consultation depuis l'écran de fin — grille en lecture seule,
// on ne redirige donc pas une partie terminée vers l'écran de fin.
const isReview = new URLSearchParams(location.search).has("review");

if (!isReview && isGameFinished(game.players, game.selectedVariants, grid)) {
  goTo("yamsEnd");
  throw new Error("Partie déjà terminée : passage à l'écran de fin.");
}

// À la reprise (pause, rafraîchissement, « Reprendre »), on montre le joueur à
// qui c'est de jouer, pas la dernière grille consultée : les flèches et le
// glissement ont pu en faire défiler d'autres avant la pause.
if (!isReview) {
  game.currentPlayerIndex = playerToPlay(game.players, game.selectedVariants, grid);
}

const gameScreen = requireEl("game-screen");
const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const scoreTablesContainer = requireEl("score-tables");
const currentPlayerName = requireEl("current-player-name");
const prevPlayerBtn = requireEl("prev-player-btn");
const nextPlayerBtn = requireEl("next-player-btn");
const picker = requireEl<HTMLDialogElement>("value-picker");
const pickerVariant = requireEl("picker-variant");
const pickerLine = requireEl("picker-line");
const pickerValues = requireEl("picker-values");
const pickerClear = requireEl<HTMLButtonElement>("picker-clear");
const pauseBtn = requireEl<HTMLButtonElement>("pause-btn");
const turnHint = requireEl<HTMLButtonElement>("turn-hint");

let autoAdvance: ReturnType<typeof setTimeout> | undefined;
// Posé par l'animation de fin de bonus : on repousse l'auto-avance le temps
// de la voir en entier (remplissage + gonflement/tremblement + verdict).
let bonusJustAnimated = false;
// La case qu'on vient de remplir : seule elle s'écrit (et se barre, ou fête
// son Yams). Les autres cases de la colonne sont redessinées sans animation.
let justWritten: { variant: Variant; line: LineName } | null = null;
// Posé quand un Yams vient d'être marqué : l'auto-avance attend la fin de la
// fête, comme pour le bonus.
let yamsJustCelebrated = false;
const YAMS_LINE: LineName = "yams";
const YAMS_CELEBRATION_MS = 1700;

// Une case saisissable, redessinée après chaque saisie de sa colonne.
interface ScoreControl {
  refresh(plan: BonusPlan | null): void;
}

let controls = new Map<Variant, ScoreControl[]>();
let derivedCells = new Map<Variant, Map<LineName, HTMLTableCellElement>>();
// Les cases saisissables, par variante puis par ligne : le liseré de la
// prochaine case (Montante / Descendante) s'y pose.
let cells = new Map<Variant, Map<LineName, HTMLButtonElement>>();
// Ce liseré, un par colonne, posé dans la feuille et non dans la case : c'est
// lui qui glisse d'une case à la suivante.
let nextMarkers = new Map<Variant, HTMLElement>();

// Animation de fin de bonus, en deux temps : la barre se remplit jusqu'à sa
// valeur finale, PUIS elle vire au vert/rouge et gonfle/tremble, PUIS il ne
// reste que le verdict.
const BONUS_FILL_MS = 550;
const BONUS_REACT_MS = 750;
const BONUS_ANIM_MS = BONUS_FILL_MS + BONUS_REACT_MS;

/* ---------- État ---------- */

function persist(): void {
  if (isReview) return; // consultation : rien à réécrire
  saveSavedGame(game);
}

function currentPlayer() {
  return game.players[game.currentPlayerIndex];
}

function changePlayer(delta: number): void {
  const n = game.players.length;
  showPlayer((game.currentPlayerIndex + delta + n) % n, delta);
}

// `direction` : sens de l'animation du nom (1 = vers la droite, comme ➡️).
function showPlayer(index: number, direction: number): void {
  clearTimeout(autoAdvance); // une navigation manuelle annule l'auto-avance
  game.currentPlayerIndex = index;
  persist();
  renderPlayer();
  animateName(direction);
}

// Le joueur dont c'est le tour, d'après les feuilles (cf. playerToPlay).
function toPlay(): number {
  return playerToPlay(game.players, game.selectedVariants, grid);
}

// « C'est à Marie de jouer » quand la grille affichée n'est pas la sienne : on
// a pu faire défiler les autres, et une saisie dans la mauvaise grille passe
// sinon inaperçue. Pas en consultation : la partie est finie.
function renderTurnHint(): void {
  const index = toPlay();
  turnHint.hidden = isReview || index === game.currentPlayerIndex;
  if (!turnHint.hidden) {
    const name = game.players[index].name;
    // Court à l'écran (la barre est étroite), complet pour un lecteur d'écran.
    turnHint.replaceChildren(...turnHintContent(name));
    turnHint.setAttribute("aria-label", `C'est à ${name} de jouer : revenir à sa grille`);
  }
}

// Seul le nom du joueur est animé, pas la feuille de score.
//
// Animer la feuille était saccadé, et pour une raison de fond : renderPlayer()
// la reconstruit entièrement, donc l'animation démarrait sur un sous-arbre
// jamais peint, au moment précis où le fond de l'écran repeint lui aussi (la
// transition de couleur du joueur). Deux repaints plein écran superposés : les
// premières frames sautaient. Ici on déplace un unique élément de texte pendant
// que le fond glisse vers la couleur suivante — le changement reste lisible et
// rien de lourd ne bouge.
function animateName(delta: number): void {
  const cls = delta > 0 ? "name-enter--next" : "name-enter--prev";
  currentPlayerName.classList.remove(
    "name-enter",
    "name-enter--next",
    "name-enter--prev",
  );
  void currentPlayerName.offsetWidth; // force la relance si on enchaîne vite
  currentPlayerName.classList.add("name-enter", cls);
}

function onPick(variant: Variant, lineName: LineName, value: number | undefined): void {
  const scores = sheetOf(currentPlayer(), variant);
  if (value === undefined) delete scores[lineName];
  else scores[lineName] = value;

  bonusJustAnimated = false;
  yamsJustCelebrated = false;
  justWritten = value === undefined ? null : { variant, line: lineName };
  writeDerived(scores, grid);
  refreshColumn(variant); // peut lever bonusJustAnimated et yamsJustCelebrated
  justWritten = null;
  placeNextMarkers(true);
  persist();

  // Effacer une valeur ne fait pas passer au joueur suivant : c'est qu'on va
  // en resaisir une autre.
  clearTimeout(autoAdvance);
  if (value === undefined) return;

  const delay = Math.max(
    bonusJustAnimated ? BONUS_ANIM_MS + 900 : AUTO_ADVANCE_MS,
    yamsJustCelebrated ? YAMS_CELEBRATION_MS : 0,
  );
  autoAdvance = setTimeout(() => {
    if (isGameFinished(game.players, game.selectedVariants, grid)) {
      persist();
      goTo("yamsEnd");
      return;
    }
    // Au joueur dont c'est le tour, pas au voisin de la grille affichée : une
    // correction faite dans la grille d'un autre ramène à celui qui doit
    // jouer.
    const next = toPlay();
    if (next === game.currentPlayerIndex) renderTurnHint();
    else showPlayer(next, 1);
  }, delay);
}

/* ---------- Rendu ---------- */

function renderPlayer(): void {
  const player = currentPlayer();
  currentPlayerName.textContent = player.name;
  renderTurnHint();
  gameScreen.style.backgroundColor = player.color;
  if (themeMeta) themeMeta.content = player.color;
  // La couleur du joueur pour la feuille posée dessus : fond des cases
  // remplies, perforation du haut (yams-game.css).
  gameScreen.style.setProperty("--player-color", player.color);

  controls = new Map(game.selectedVariants.map((v) => [v, []]));
  derivedCells = new Map(game.selectedVariants.map((v) => [v, new Map()]));
  cells = new Map(game.selectedVariants.map((v) => [v, new Map()]));
  nextMarkers = new Map();

  const table = document.createElement("table");
  table.className = "score-table";
  table.appendChild(buildBody(player));

  const wrapper = document.createElement("div");
  wrapper.className = "score-wrapper";
  wrapper.appendChild(table);
  scoreTablesContainer.replaceChildren(wrapper);

  for (const variant of game.selectedVariants) {
    fillDerived(variant);
    refreshControls(variant);
  }
  placeNextMarkers(false);
}

/* ---------- Prochaine case (Montante / Descendante) ---------- */
// Les cases verrouillées sont grisées, mais celle à remplir ensuite ne se
// distinguait pas des autres cases vides. Un liseré à l'encre du jeu la
// cerne ; après une saisie, il glisse jusqu'à la suivante (`animate`). Au
// changement de joueur, la grille est neuve : il s'y pose sans glisser.
function placeNextMarkers(animate: boolean): void {
  const wrapper = scoreTablesContainer.querySelector<HTMLElement>(".score-wrapper");
  if (!wrapper || isReview) return;
  const origin = wrapper.getBoundingClientRect();

  for (const variant of game.selectedVariants) {
    const line = nextLine(variant, sheetOf(currentPlayer(), variant), grid);
    const cell = line === null ? undefined : cells.get(variant)?.get(line);
    let marker = nextMarkers.get(variant);
    if (!cell) {
      if (marker) marker.hidden = true;
      continue;
    }
    if (!marker) {
      marker = document.createElement("span");
      marker.className = "next-marker";
      marker.setAttribute("aria-hidden", "true");
      wrapper.appendChild(marker);
      nextMarkers.set(variant, marker);
      animate = false; // premier placement : rien d'où glisser
    }
    const box = cell.getBoundingClientRect();
    marker.dataset.line = line ?? "";
    marker.classList.toggle("is-instant", !animate || marker.hidden);
    marker.hidden = false;
    marker.style.top = `${box.top - origin.top}px`;
    marker.style.left = `${box.left - origin.left}px`;
    marker.style.width = `${box.width}px`;
    marker.style.height = `${box.height}px`;
  }
}

function buildBody(player: Player): HTMLTableSectionElement {
  const tbody = document.createElement("tbody");
  let dataRow = 0;

  grid.sections.forEach(({ label, lines }, sectionIndex) => {
    // Les pastilles de variante sont posées sur la 1re ligne de section
    // ("Chiffres") plutôt que dans un <thead> à part : une ligne de gagnée.
    if (label) {
      tbody.appendChild(
        buildSectionHead(label, sectionIndex > 0, sectionIndex === 0),
      );
    }

    for (const lineName in lines) {
      const values = lines[lineName];
      const computed = values.length === 0;

      const tr = document.createElement("tr");
      if (computed) tr.classList.add("computed");
      if (lineName === FINAL_SCORE_LINE) tr.classList.add("final");
      if (!computed && dataRow++ % 2 === 1) tr.classList.add("alt");

      const nameCell = document.createElement("td");
      if (grid.upperScoringNames.includes(lineName)) {
        // Un dé vu de dessus plutôt que le chiffre : on reconnaît la ligne d'un
        // coup d'œil. Le dessin est dans core/dice.ts, partagé avec le 5000.
        nameCell.appendChild(dieFace(lineName));
      } else {
        nameCell.textContent = lineLabel(lineName, game.rules);
      }
      tr.appendChild(nameCell);

      for (const variant of game.selectedVariants) {
        const td = document.createElement("td");
        if (computed) {
          derivedCells.get(variant)?.set(lineName, td);
        } else {
          const control = buildControl(
            td,
            variant,
            lineName,
            values,
            sheetOf(player, variant),
          );
          controls.get(variant)?.push(control);
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  });

  return tbody;
}

function buildSectionHead(
  label: string,
  major: boolean,
  withVariants: boolean,
): HTMLTableRowElement {
  const row = document.createElement("tr");
  row.className = major ? "section-head section-head--major" : "section-head";

  const labelCell = document.createElement("td");
  const labelText = document.createElement("span");
  labelText.className = "section-label";
  labelText.textContent = label;
  labelCell.appendChild(labelText);
  row.appendChild(labelCell);

  if (!withVariants) {
    labelCell.colSpan = game.selectedVariants.length + 1;
    return row;
  }

  row.classList.add("section-head--vars");
  for (const variant of game.selectedVariants) {
    const td = document.createElement("td");
    // La pastille commune (Hall of Fame, récapitulatifs), en plus petit.
    const icon = variantBadge(variant);
    icon.classList.add("variant-icon");
    td.appendChild(icon);
    row.appendChild(td);
  }
  return row;
}

/* ---------- Saisie d'un score ---------- */

// Une pilule par case : un clic ouvre la fenêtre de jetons. Le premier rendu
// est laissé à refreshControls(), appelé juste après la construction du
// tableau : le plan de bonus n'est connu qu'une fois toutes les cellules en
// place. `scores` est la feuille vivante du joueur : la case y lit sa valeur.
function buildControl(
  td: HTMLTableCellElement,
  variant: Variant,
  lineName: LineName,
  values: number[],
  scores: LineScores,
): ScoreControl {
  const label = `${lineLabel(lineName, game.rules)}, ${variant}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "score-cell";
  button.setAttribute("aria-label", label);
  td.appendChild(button);
  cells.get(variant)?.set(lineName, button);

  if (isReview) {
    // La cellule n'ouvre rien : on la sort de l'ordre de tabulation. Pas
    // `disabled`, qui la grise et lui donnerait l'aspect d'une ligne
    // verrouillée de Montante / Descendante.
    button.tabIndex = -1;
  } else {
    button.addEventListener("click", () =>
      openPicker(lineName, values, scores[lineName], variant, (value) =>
        onPick(variant, lineName, value),
      ),
    );
  }

  const refresh = (plan: BonusPlan | null): void => {
    const value = scores[lineName];
    // Cellule vide : rien dans le texte, le repère "–" est tracé en CSS
    // (::before) pour un centrage net. Écrire le texte vide aussi la case de
    // son ancien indice : il est reposé juste après s'il y a lieu.
    button.replaceChildren();
    if (value !== undefined) button.appendChild(cellValue(lineName, value));
    button.classList.toggle("is-filled", value !== undefined);
    button.classList.toggle("is-empty", value === undefined);
    // Un 0 est une case barrée : on le dit comme sur la feuille, d'un trait.
    button.classList.toggle("is-zero", value === 0);
    const fresh = justWritten?.variant === variant && justWritten.line === lineName;
    button.classList.toggle("is-written", fresh);
    if (fresh && lineName === YAMS_LINE && value) celebrateYams(button);
    button.disabled = !isLineEnabled(lineName, variant, scores, grid);

    const mine = plan?.host === lineName ? plan : null;
    button.classList.toggle("has-hint", mine !== null);
    if (mine) button.appendChild(buildHint(mine.steps));
    // L'indice est dessiné : sans ça il n'existe pas pour un lecteur d'écran.
    button.setAttribute(
      "aria-label",
      mine ? `${label}. Pour le bonus : ${planLabel(mine)}` : label,
    );
  };
  return { refresh };
}

// La valeur d'une case, dans son propre élément : c'est lui qui s'écrit (la
// case garde son cadre et son indice). Un Yams marqué est entouré, comme le
// 50 de l'extrait de feuille du menu.
function cellValue(lineName: LineName, value: number): HTMLElement {
  const span = document.createElement("span");
  span.className = "cell-value";
  span.textContent = String(value);
  if (lineName === YAMS_LINE && value > 0) {
    span.classList.add("circled");
    span.appendChild(handCircle());
  }
  return span;
}

// Un Yams vient d'être marqué : le cercle se trace (CSS), quelques confettis
// partent de la case et un tampon « YAMS ! » s'y pose, puis disparaissent.
function celebrateYams(button: HTMLButtonElement): void {
  yamsJustCelebrated = true;
  const burst = document.createElement("span");
  burst.className = "yams-burst";
  burst.setAttribute("aria-hidden", "true");
  const BITS = 14;
  for (let i = 0; i < BITS; i++) {
    const angle = (i / BITS) * Math.PI * 2;
    const reach = 2.4 + (i % 3) * 0.8; // en em
    const bit = document.createElement("i");
    bit.style.setProperty("--x", `${(Math.cos(angle) * reach).toFixed(2)}em`);
    bit.style.setProperty("--y", `${(Math.sin(angle) * reach * 0.7).toFixed(2)}em`);
    bit.style.setProperty("--turn", `${(i * 67) % 360}deg`);
    bit.style.setProperty("--d", `${0.35 + (i % 4) * 0.03}s`);
    burst.appendChild(bit);
  }
  const stamp = document.createElement("span");
  stamp.className = "yams-stamp";
  stamp.setAttribute("aria-hidden", "true");
  stamp.textContent = "Yams !";
  button.append(burst, stamp);
  window.setTimeout(() => {
    burst.remove();
    stamp.remove();
  }, YAMS_CELEBRATION_MS + 400);
}

function refreshColumn(variant: Variant): void {
  fillDerived(variant, true);
  refreshControls(variant);
}

function refreshControls(variant: Variant): void {
  const plan = planFor(variant);
  for (const control of controls.get(variant) ?? []) control.refresh(plan);
}

// À une variante, dès deux cases remplies (4 chiffres libres). À deux
// variantes, à partir de trois (3 chiffres libres) : la colonne est deux fois
// plus étroite, l'indice doit être plus court pour y tenir (demande de Paul,
// 08/10). Au-delà de deux, les colonnes tombent sous les 60 px : pas d'indice.
const PLAN_LINES_BY_VARIANTS: Record<number, number> = { 1: PLAN_MAX_LINES, 2: 3 };

function planFor(variant: Variant): BonusPlan | null {
  const maxLines = PLAN_LINES_BY_VARIANTS[game.selectedVariants.length];
  if (!showBonusHint || !maxLines) return null;
  return bonusPlan(sheetOf(currentPlayer(), variant), grid, maxLines);
}

function planLabel(plan: BonusPlan): string {
  return plan.steps
    .map((step) => `${plural(step.dice, "dé")} de ${step.line}`)
    .join(", ");
}

// `live` : true quand l'appel suit une saisie (pas le rendu initial). Sert à
// ne jouer l'animation de fin de bonus qu'au moment réel où la 6e case tombe.
function fillDerived(variant: Variant, live = false): void {
  const cells = derivedCells.get(variant);
  if (!cells) return;
  const d = computeDerived(sheetOf(currentPlayer(), variant), grid);
  const text: Record<LineName, string> = {
    [BONUS_LINE]: bonusLabel(d),
    [UPPER_TOTAL_LINE]: String(d.totalHaut),
    [LOWER_TOTAL_LINE]: String(d.totalBas),
    [FINAL_SCORE_LINE]: String(d.scoreFinal),
  };
  // La jauge n'a de sens qu'à variante unique : sur plusieurs colonnes elle
  // devient illisible, on retombe alors sur le seul libellé.
  const gaugeBonus = game.selectedVariants.length === 1;
  for (const line of DERIVED_LINES) {
    const cell = cells.get(line);
    if (!cell) continue;
    if (line === BONUS_LINE && gaugeBonus) renderBonusCell(cell, d, live);
    else cell.textContent = text[line];
  }
}

// "+35" bonus acquis · "0" section bouclée sans l'atteindre · "−12" points
// qu'il reste à faire.
function bonusLabel(d: Derived): string {
  if (d.upperSum >= BONUS_THRESHOLD) return `+${grid.bonusPoints}`;
  if (!d.bonusPending) return "0";
  return `−${BONUS_THRESHOLD - d.upperSum}`;
}

/* ---------- Ligne "Bonus" (variante unique) ---------- */
// Jauge de progression vers 63 (couleur de la page assombrie) tant que le
// bonus n'est ni acquis ni définitivement manqué. Dès que le seuil est
// atteint — même avec moins de 6 cases — ou que la section chiffres est
// bouclée sans l'atteindre : animation (gonflement vert / tremblement rouge)
// puis la jauge disparaît, il ne reste que le verdict ("+35" / "0").

// Joueurs dont l'animation a déjà été jouée : une seule fois par partie.
const bonusAnimated = new Set<string>();

function renderBonusCell(
  cell: HTMLTableCellElement,
  d: Derived,
  live: boolean,
): void {
  const won = d.upperSum >= BONUS_THRESHOLD;

  if (!won && !d.upperFilled) {
    renderBonusProgress(cell, d);
    return;
  }

  const key = currentPlayer().name;
  const firstTime = !bonusAnimated.has(key);
  bonusAnimated.add(key);

  if (firstTime && live) animateBonusOutcome(cell, d, won);
  else setBonusResult(cell, won);
}

function renderBonusProgress(cell: HTMLTableCellElement, d: Derived): void {
  cell.classList.remove(
    "bonus-result",
    "bonus-result--won",
    "bonus-result--lost",
  );
  const gauge = ensureGauge(cell);
  const fill = gauge.querySelector<HTMLElement>(".bonus-gauge-fill")!;
  const label = gauge.querySelector<HTMLElement>(".bonus-gauge-label")!;
  const [r, g, b] = deepen(currentPlayer().color);
  fill.style.background = `rgb(${r}, ${g}, ${b})`;
  fill.style.width = `${Math.min(100, (d.upperSum / BONUS_THRESHOLD) * 100)}%`;
  label.textContent = `−${BONUS_THRESHOLD - d.upperSum}`;
}

function animateBonusOutcome(
  cell: HTMLTableCellElement,
  d: Derived,
  won: boolean,
): void {
  bonusJustAnimated = true;
  const gauge = ensureGauge(cell);
  const fill = gauge.querySelector<HTMLElement>(".bonus-gauge-fill")!;
  const label = gauge.querySelector<HTMLElement>(".bonus-gauge-label")!;

  // 1) la barre se remplit jusqu'à sa valeur réelle, couleur inchangée.
  requestAnimationFrame(() => {
    fill.style.width = `${Math.min(100, (d.upperSum / BONUS_THRESHOLD) * 100)}%`;
  });

  // 2) une fois remplie : vert/rouge + gonflement/tremblement.
  window.setTimeout(() => {
    fill.style.background = ""; // la couleur vient alors du CSS
    gauge.classList.add(won ? "bonus-gauge--won" : "bonus-gauge--lost");
    label.textContent = won ? `+${grid.bonusPoints}` : "0";
    // Bonus décroché : « +35 » s'envole au-dessus de la jauge.
    if (won) {
      const gain = document.createElement("span");
      gain.className = "bonus-float";
      gain.setAttribute("aria-hidden", "true");
      gain.textContent = `+${grid.bonusPoints}`;
      cell.appendChild(gain);
    }
  }, BONUS_FILL_MS);

  // 3) il ne reste que le verdict.
  window.setTimeout(() => setBonusResult(cell, won), BONUS_ANIM_MS);
}

function setBonusResult(cell: HTMLTableCellElement, won: boolean): void {
  // Le « +35 » qui s'envole survit au verdict : il finit sa course, puis s'en va.
  // Il reste dans la case (le retirer puis le remettre relancerait son
  // animation depuis le début).
  const gain = cell.querySelector(".bonus-float");
  for (const child of [...cell.childNodes]) if (child !== gain) child.remove();
  cell.prepend(won ? `+${grid.bonusPoints}` : "0");
  gain?.addEventListener("animationend", () => gain.remove(), { once: true });
  cell.classList.add("bonus-result");
  cell.classList.toggle("bonus-result--won", won);
  cell.classList.toggle("bonus-result--lost", !won);
}

function ensureGauge(cell: HTMLTableCellElement): HTMLElement {
  let gauge = cell.querySelector<HTMLElement>(".bonus-gauge");
  if (gauge) return gauge;
  gauge = document.createElement("div");
  gauge.className = "bonus-gauge";
  const track = document.createElement("span");
  track.className = "bonus-gauge-track";
  const fill = document.createElement("span");
  fill.className = "bonus-gauge-fill";
  track.appendChild(fill);
  const label = document.createElement("span");
  label.className = "bonus-gauge-label";
  gauge.append(track, label);
  cell.replaceChildren(gauge);
  return gauge;
}

// Version foncée mais colorée d'un pastel #rrggbb, en [r, g, b] : on retire la
// composante blanche (le min des canaux), on amplifie l'écart chromatique et on
// repose sur un socle sombre. Un simple × facteur virerait au gris car les
// couleurs joueurs sont peu saturées.
function deepen(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const min = Math.min(...c);
  const [r, g, b] = c.map((v) =>
    Math.min(255, Math.round(40 + (v - min) * 2.2)),
  );
  return [r, g, b];
}

/* ---------- Indice de bonus ---------- */
// Le plan le plus probable pour décrocher le bonus (cf. bonusPlan), posé en
// filigrane dans la case du plus grand chiffre encore libre — une seule case,
// toujours la même, pour que le joueur sache où regarder.
//
// Les faces sont dessinées plutôt qu'écrites en chiffres : l'indice vit dans la
// case d'une ligne mais parle des autres, et ce sont les dés de la première
// colonne que l'œil retrouve. Un "2×⚂" renvoie à sa ligne sans qu'on ait à
// lire quoi que ce soit.
//
// À deux variantes, "3× 2× 1×" côte à côte débordait de la colonne et
// chevauchait la voisine : le nombre passe au-dessus de son dé, sans le "×".
// Chaque étape ne prend plus que la largeur d'un dé, et la hauteur gagnée tient
// sous celle de la case.

function buildHint(steps: BonusPlanStep[]): HTMLElement {
  const stacked = game.selectedVariants.length > 1;
  const hint = document.createElement("span");
  hint.className = stacked ? "cell-hint cell-hint--stacked" : "cell-hint";
  // Le texte équivalent est porté par l'aria-label du bouton : annoncer en plus
  // six dés dessinés ne ferait que bavarder.
  hint.setAttribute("aria-hidden", "true");
  for (const { line, dice } of steps) {
    const step = document.createElement("span");
    step.className = "hint-step";
    const count = document.createElement("span");
    count.className = "hint-count";
    count.textContent = stacked ? String(dice) : `${dice}×`;
    step.append(count, dieFace(line));
    hint.appendChild(step);
  }
  return hint;
}

function openPicker(
  lineName: string,
  values: number[],
  current: number | undefined,
  variant: Variant,
  onPickValue: OnPick,
): void {
  pickerVariant.replaceChildren(variantBadge(variant));
  pickerLine.textContent = lineLabel(lineName, game.rules);

  // Lignes des chiffres : chaque valeur dit combien de dés elle représente
  // (8 sur la ligne des 4 = « 2 × ⚃ ») — c'est ce qu'on a sous les yeux sur
  // la table, pas le total.
  const face = UPPER_LINES.includes(lineName) ? Number(lineName) : null;
  pickerValues.classList.toggle("picker-values--dice", face !== null);

  const frag = document.createDocumentFragment();
  for (const v of values) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = v === current ? "picker-value current" : "picker-value";
    chip.classList.toggle("is-zero", v === 0);
    const num = document.createElement("span");
    num.className = "picker-num";
    num.textContent = String(v);
    chip.appendChild(num);
    if (face !== null) {
      const dice = document.createElement("span");
      dice.className = "picker-dice";
      if (v === 0) dice.textContent = "aucun";
      else dice.append(`${v / face}×`, dieFace(face));
      chip.appendChild(dice);
      chip.setAttribute("aria-label", v === 0 ? "0" : `${v}, ${v / face} dés`);
    }
    chip.addEventListener("click", () => {
      picker.close();
      onPickValue(v);
    });
    frag.appendChild(chip);
  }
  pickerValues.replaceChildren(frag);

  pickerClear.hidden = current === undefined;
  pickerClear.onclick = () => {
    picker.close();
    onPickValue(undefined);
  };

  picker.showModal();
  // showModal() donne le focus au premier élément focusable, donc au jeton « 0 »
  // — qui se retrouve cerclé de l'anneau bleu du navigateur alors que les autres
  // sont gris. On porte le focus sur le dialogue lui-même (tabindex="-1") :
  // aucun jeton n'est distingué, et la tabulation entre normalement dedans.
  picker.focus();
}

/* ---------- Mise en route ---------- */

applyGameTheme(gameScreen, YAMS);

// La flèche garde le focus : au clavier, on enchaîne les joueurs sans perdre
// sa place. Au doigt, aucun anneau (:focus-visible, cf. yams-game.css).
prevPlayerBtn.addEventListener("click", () => changePlayer(-1));
nextPlayerBtn.addEventListener("click", () => changePlayer(1));

// Changer de joueur au doigt (core/swipe.ts) : même effet que les flèches.
onHorizontalSwipe(gameScreen, changePlayer);

// En consultation, la pause n'a pas de sens : le bouton du bas (un simple
// lien) ramène au classement à la place.
if (isReview) {
  gameScreen.classList.add("review");
  pauseBtn.hidden = true;
  requireEl("review-bar").hidden = false;
} else {
  pauseBtn.addEventListener("click", () => {
    persist();
    goTo("yamsHome");
  });
}

turnHint.addEventListener("click", () => {
  const index = toPlay();
  showPlayer(index, index > game.currentPlayerIndex ? 1 : -1);
});

makeDismissible(picker);

// Le liseré est placé en pixels : il suit la grille quand elle change de
// taille (rotation, police chargée après le premier rendu).
window.addEventListener("resize", () => placeNextMarkers(false));
void document.fonts?.ready.then(() => placeNextMarkers(false));

renderPlayer();
if (!isReview) keepScreenOn();
