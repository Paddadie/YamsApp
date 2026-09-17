// Page de jeu : grille de score du joueur courant, navigation entre joueurs,
// sauvegarde continue de la partie.
//
// Le tableau n'est reconstruit qu'au changement de joueur ; une saisie ne
// rafraîchit que la colonne concernée (valeur, verrous Montante/Descendante,
// lignes calculées), sans perdre le focus.
//
// Ordre du module (commun aux six pages) : amorçage et gardes, puis les
// constantes, puis les fonctions, et enfin la mise en route tout en bas. Rien
// ne s'exécute avant que tout soit déclaré — une fonction remonte en haut du
// module, un `const` non, et le piège ne se voit ni à la compilation ni aux
// tests.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { game, hydrateGame, toSavedGame } from "../state";
import { getVariantIcon, getVariantColor } from "../variants";
import { makeDismissible, plural, requireEl } from "../ui";
import { getSavedGame, saveSavedGame } from "../storage/savedGameRepo";
import { getPrefs } from "../storage/prefsRepo";
import {
  bonusPlan,
  buildGrid,
  isLineEnabled,
  isGameFinished,
  computeDerived,
  writeDerived,
  BONUS_LINE,
  BONUS_THRESHOLD,
  DERIVED_LINES,
  FINAL_SCORE_LINE,
  LOWER_TOTAL_LINE,
  UPPER_TOTAL_LINE,
  type BonusPlan,
  type BonusPlanStep,
  type Derived,
} from "../scoring";
import type { LineName, LineScores, PlayerScores, Variant } from "../types";

type OnPick = (value: number | undefined) => void;

const AUTO_ADVANCE_MS = 800;

// Changement de joueur au doigt (même effet que les flèches).
// Deux façons d'aboutir : un glissement franc, ou un petit coup de doigt rapide
// — sinon un swipe vif mais court, très naturel au pouce, ne déclencherait rien.
const SWIPE_MIN_PX = 60;
const SWIPE_FLICK_MS = 250;
const SWIPE_FLICK_PX = 25;
// En deçà, le geste reste indécis : on ne le confisque pas à la grille, qui
// doit pouvoir défiler verticalement.
const SWIPE_LOCK_PX = 12;

bootstrap();

const saved = getSavedGame();
if (!saved) {
  goTo("home");
  throw new Error("Aucune partie en cours : retour à l'accueil.");
}
hydrateGame(saved);

// Grille figée pour toute la partie (règles copiées au lancement).
const grid = buildGrid(game.rules);

// Lu une fois au chargement, comme tout le reste de l'état : chaque navigation
// recharge la page, un changement dans les Paramètres est donc pris en compte
// dès le retour sur l'écran de jeu.
const showBonusHint = getPrefs().bonusHint;

// `?review` : consultation depuis l'écran de fin — grille en lecture seule,
// on ne redirige donc pas une partie terminée vers l'écran de fin.
const isReview = new URLSearchParams(location.search).has("review");

if (!isReview && isGameFinished(game.players, game.variants, grid)) {
  goTo("end");
  throw new Error("Partie déjà terminée : passage à l'écran de fin.");
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

let autoAdvance: ReturnType<typeof setTimeout> | undefined;
// Posé par l'animation de fin de bonus : on repousse l'auto-avance le temps
// de la voir en entier (remplissage + gonflement/tremblement + verdict).
let bonusJustAnimated = false;

interface Widget {
  el: HTMLElement;
  setValue(value: number | undefined): void;
  setLocked(locked: boolean): void;
  // À appeler APRÈS setValue, qui vide la cellule de son contenu.
  setHint(steps: BonusPlanStep[] | null): void;
}
interface ScoreControl {
  refresh(plan: BonusPlan | null): void;
}

let controls = new Map<Variant, ScoreControl[]>();
let derivedCells = new Map<Variant, Map<LineName, HTMLTableCellElement>>();

// Animation de fin de bonus, en deux temps : la barre se remplit jusqu'à sa
// valeur finale, PUIS elle vire au vert/rouge et gonfle/tremble, PUIS il ne
// reste que le verdict.
const BONUS_FILL_MS = 550;
const BONUS_REACT_MS = 750;
const BONUS_ANIM_MS = BONUS_FILL_MS + BONUS_REACT_MS;

/* ---------- État ---------- */

function persist(): void {
  if (isReview) return; // consultation : rien à réécrire
  saveSavedGame(toSavedGame());
}

function currentPlayer() {
  return game.players[game.currentPlayerIndex];
}

function changePlayer(delta: number): void {
  clearTimeout(autoAdvance); // une navigation manuelle annule l'auto-avance
  const n = game.players.length;
  game.currentPlayerIndex = (game.currentPlayerIndex + delta + n) % n;
  persist();
  renderPlayer();
  animateName(delta);
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

/* ---------- Swipe : changer de joueur au doigt ---------- */
// Souris exclue volontairement : sur un vrai pointeur, un glissement horizontal
// sert à sélectionner du texte dans la grille, pas à tourner la page.
//
// Pas de setPointerCapture : capturer dès le pointerdown volerait au navigateur
// le défilement vertical de la grille. On observe le geste, et c'est seulement
// quand il part clairement à l'horizontale qu'on se l'approprie. Dans le cas
// inverse le navigateur défile et nous envoie un pointercancel.

let swipeId: number | undefined;
let swipeStartX = 0;
let swipeStartY = 0;
let swipeStartAt = 0;
// Geste reconnu comme horizontal : à partir de là il nous appartient.
let swipeTaken = false;
// Un geste horizontal vient de se terminer : le clic qu'il produit est à jeter.
let swipeClickPending = false;

function onSwipeStart(e: PointerEvent): void {
  // Un geste précédent peut ne pas avoir produit de clic (cellule reconstruite,
  // doigt relâché hors d'un bouton) : le drapeau se purge ici, jamais plus tard.
  swipeClickPending = false;
  if (e.pointerType === "mouse" || !e.isPrimary) return;
  swipeId = e.pointerId;
  swipeStartX = e.clientX;
  swipeStartY = e.clientY;
  swipeStartAt = e.timeStamp;
  swipeTaken = false;
}

function onSwipeMove(e: PointerEvent): void {
  if (e.pointerId !== swipeId || swipeTaken) return;
  const dx = e.clientX - swipeStartX;
  const dy = e.clientY - swipeStartY;
  // L'axe dominant décide, une fois pour toutes : un swipe qui dérive ensuite
  // vers le bas reste un swipe, et un défilement amorcé ne devient jamais un
  // changement de joueur.
  if (Math.abs(dx) < SWIPE_LOCK_PX || Math.abs(dx) <= Math.abs(dy)) return;
  swipeTaken = true;
}

function onSwipeEnd(e: PointerEvent): void {
  if (e.pointerId !== swipeId) return;
  const dx = e.clientX - swipeStartX;
  const elapsed = e.timeStamp - swipeStartAt;
  const taken = swipeTaken;
  resetSwipe();
  if (!taken) return;

  // Même en deçà du seuil (glissement hésitant, ou aller-retour) : le doigt a
  // balayé la grille, il n'a pas visé une case.
  swipeClickPending = true;

  const far = Math.abs(dx) >= SWIPE_MIN_PX;
  const flick = elapsed <= SWIPE_FLICK_MS && Math.abs(dx) >= SWIPE_FLICK_PX;
  // Vers la gauche = la page part à gauche = joueur suivant, comme la flèche.
  if (far || flick) changePlayer(dx < 0 ? 1 : -1);
}

function resetSwipe(): void {
  swipeId = undefined;
  swipeTaken = false;
}

function swallowSwipeClick(e: MouseEvent): void {
  if (!swipeClickPending) return;
  swipeClickPending = false;
  e.stopPropagation();
  e.preventDefault();
}

function onPick(variant: Variant, lineName: LineName, value: number | undefined): void {
  const scores = currentPlayer().scores[variant];
  if (value === undefined) delete scores[lineName];
  else scores[lineName] = value;

  bonusJustAnimated = false;
  writeDerived(scores, grid);
  refreshColumn(variant); // peut lever bonusJustAnimated
  persist();

  // Effacer une valeur ne fait pas passer au joueur suivant : c'est qu'on va
  // en resaisir une autre.
  clearTimeout(autoAdvance);
  if (value === undefined) return;

  const delay = bonusJustAnimated ? BONUS_ANIM_MS + 900 : AUTO_ADVANCE_MS;
  autoAdvance = setTimeout(() => {
    if (isGameFinished(game.players, game.variants, grid)) {
      persist();
      goTo("end");
    } else {
      changePlayer(1);
    }
  }, delay);
}

/* ---------- Rendu ---------- */

function renderPlayer(): void {
  const player = currentPlayer();
  currentPlayerName.textContent = player.name;
  gameScreen.style.backgroundColor = player.color;
  if (themeMeta) themeMeta.content = player.color;

  // Repère des cases remplies : la teinte de la page, plus vive et à peine
  // assombrie (surtout pas grisée : ça ferait "bouton désactivé").
  gameScreen.style.setProperty("--filled-bg", richen(player.color));

  controls = new Map(game.variants.map((v) => [v, []]));
  derivedCells = new Map(game.variants.map((v) => [v, new Map()]));

  const table = document.createElement("table");
  table.className = "score-table";
  table.appendChild(buildBody(player.scores));

  const wrapper = document.createElement("div");
  wrapper.className = "score-wrapper";
  wrapper.appendChild(table);
  scoreTablesContainer.replaceChildren(wrapper);

  for (const variant of game.variants) {
    fillDerived(variant);
    refreshControls(variant);
  }
}

function buildBody(playerScores: PlayerScores): HTMLTableSectionElement {
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
        nameCell.appendChild(dieFace(lineName));
      } else {
        nameCell.textContent = lineName;
      }
      tr.appendChild(nameCell);

      for (const variant of game.variants) {
        const td = document.createElement("td");
        if (computed) {
          derivedCells.get(variant)?.set(lineName, td);
        } else {
          const control = buildControl(
            td,
            variant,
            lineName,
            values,
            playerScores[variant],
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
    labelCell.colSpan = game.variants.length + 1;
    return row;
  }

  row.classList.add("section-head--vars");
  for (const variant of game.variants) {
    const td = document.createElement("td");
    const icon = document.createElement("span");
    icon.className = "variant-icon";
    icon.style.setProperty("--vc", getVariantColor(variant));
    icon.textContent = getVariantIcon(variant);
    icon.title = variant;
    td.appendChild(icon);
    row.appendChild(td);
  }
  return row;
}

/* ---------- Faces de dé (section "Chiffres") ---------- */
// Les six premières lignes portent un dé vu de dessus plutôt que le chiffre :
// on lit la ligne d'un coup d'œil, sans lire.
//
// SVG inline et non un caractère Unicode (⚀⚁⚂…) : ces glyphes sont rendus par
// la police emoji du système, donc minuscules sur iOS et différents d'un
// appareil à l'autre. Ici la face est dessinée, elle suit la taille fluide du
// tableau et reste nette à tout zoom.

const SVG_NS = "http://www.w3.org/2000/svg";

// Rayon commun à tous les points : une face 1 avec un gros point serait plus
// fidèle à un vrai dé, mais côte à côte dans une colonne les six faces doivent
// se lire comme un même dé qu'on retourne.
const PIP_RADIUS = 10;

// Points de chaque face, dans un carré de 100×100. Colonnes et rangées sont aux
// mêmes coordonnées d'une face à l'autre — c'est ce qui fait qu'on lit un même
// dé et non six dessins. Seule la face 6 écarte ses rangées : à trois points par
// colonne, l'écart standard les laissait se frôler.
const DIE_PIPS: Record<string, [number, number][]> = {
  "1": [[50, 50]],
  "2": [[30, 30], [70, 70]],
  "3": [[30, 30], [50, 50], [70, 70]],
  "4": [[30, 30], [70, 30], [30, 70], [70, 70]],
  "5": [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  "6": [[30, 25], [70, 25], [30, 50], [70, 50], [30, 75], [70, 75]],
};

function dieFace(lineName: LineName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "die");
  svg.setAttribute("viewBox", "0 0 100 100");
  // Le dé remplace un texte : sans ça la ligne n'a plus de libellé annoncé.
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", lineName);

  const face = document.createElementNS(SVG_NS, "rect");
  face.setAttribute("class", "die-face");
  // Le contour est centré sur le bord : on rentre la face d'une demi-épaisseur,
  // sinon il est rogné par la boîte du SVG.
  face.setAttribute("x", "3");
  face.setAttribute("y", "3");
  face.setAttribute("width", "94");
  face.setAttribute("height", "94");
  face.setAttribute("rx", "20");
  svg.appendChild(face);

  for (const [cx, cy] of DIE_PIPS[lineName] ?? []) {
    const pip = document.createElementNS(SVG_NS, "circle");
    pip.setAttribute("class", "die-pip");
    pip.setAttribute("cx", String(cx));
    pip.setAttribute("cy", String(cy));
    pip.setAttribute("r", String(PIP_RADIUS));
    svg.appendChild(pip);
  }
  return svg;
}

function buildControl(
  td: HTMLTableCellElement,
  variant: Variant,
  lineName: LineName,
  values: number[],
  scores: LineScores,
): ScoreControl {
  const pick: OnPick = (value) => onPick(variant, lineName, value);

  const widget = buildButton(values, lineName, variant, pick);
  const label = `${lineName}, ${variant}`;
  widget.el.setAttribute("aria-label", label);
  td.appendChild(widget.el);

  // Le premier rendu est laissé à refreshControls(), appelé juste après la
  // construction du tableau : le plan n'est connu qu'une fois toutes les
  // cellules en place.
  const refresh = (plan: BonusPlan | null): void => {
    widget.setValue(scores[lineName]);
    widget.setLocked(!isLineEnabled(lineName, variant, scores, grid));
    const mine = plan?.host === lineName ? plan : null;
    widget.setHint(mine ? mine.steps : null);
    // L'indice est dessiné : sans ça il n'existe pas pour un lecteur d'écran.
    widget.el.setAttribute(
      "aria-label",
      mine ? `${label}. Pour le bonus : ${planLabel(mine)}` : label,
    );
  };
  return { refresh };
}

function refreshColumn(variant: Variant): void {
  fillDerived(variant, true);
  refreshControls(variant);
}

function refreshControls(variant: Variant): void {
  const plan = planFor(variant);
  for (const control of controls.get(variant) ?? []) control.refresh(plan);
}

// Comme la jauge de bonus : à plusieurs variantes les colonnes tombent sous les
// 60 px, l'indice n'y tiendrait pas.
function planFor(variant: Variant): BonusPlan | null {
  if (!showBonusHint || game.variants.length > 1) return null;
  return bonusPlan(currentPlayer().scores[variant], grid);
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
  const d = computeDerived(currentPlayer().scores[variant], grid);
  const text: Record<LineName, string> = {
    [BONUS_LINE]: bonusLabel(d),
    [UPPER_TOTAL_LINE]: String(d.totalHaut),
    [LOWER_TOTAL_LINE]: String(d.totalBas),
    [FINAL_SCORE_LINE]: String(d.scoreFinal),
  };
  // La jauge n'a de sens qu'à variante unique : sur plusieurs colonnes elle
  // devient illisible, on retombe alors sur le seul libellé.
  const gaugeBonus = game.variants.length === 1;
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
  }, BONUS_FILL_MS);

  // 3) il ne reste que le verdict.
  window.setTimeout(() => setBonusResult(cell, won), BONUS_ANIM_MS);
}

function setBonusResult(cell: HTMLTableCellElement, won: boolean): void {
  cell.replaceChildren();
  cell.textContent = won ? `+${grid.bonusPoints}` : "0";
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

// Même teinte, en plus vif : on écarte les canaux de leur moyenne (saturation)
// puis on assombrit très légèrement. Garde la couleur, évite le virage au gris.
function richen(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const mean = (rgb[0] + rgb[1] + rgb[2]) / 3;
  const out = rgb.map((v) =>
    Math.max(0, Math.min(255, Math.round((mean + (v - mean) * 1.7) * 0.9))),
  );
  return `rgb(${out[0]}, ${out[1]}, ${out[2]})`;
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

/* ---------- Saisie d'un score ---------- */

// Une seule et même pilule pour toutes les lignes : un clic ouvre la fenêtre
// de jetons.
function buildButton(
  values: number[],
  lineName: LineName,
  variant: Variant,
  onChange: OnPick,
): Widget {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "score-cell";

  if (isReview) {
    // La cellule n'ouvre rien : on la sort de l'ordre de tabulation. Pas
    // `disabled`, qui la grise et lui donnerait l'aspect d'une ligne
    // verrouillée de Montante / Descendante.
    button.tabIndex = -1;
  } else {
    button.addEventListener("click", () => {
      const current = button.dataset.value
        ? Number(button.dataset.value)
        : undefined;
      openPicker(lineName, values, current, variant, onChange);
    });
  }

  return {
    el: button,
    setValue(value) {
      // Cellule vide : rien dans le texte, le repère "–" est tracé en CSS
      // (::before) pour un centrage net.
      button.textContent = value !== undefined ? String(value) : "";
      button.dataset.value = value !== undefined ? String(value) : "";
      button.classList.toggle("is-filled", value !== undefined);
      button.classList.toggle("is-empty", value === undefined);
    },
    setLocked(locked) {
      button.disabled = locked;
    },
    setHint(steps) {
      button.querySelector(".cell-hint")?.remove();
      button.classList.toggle("has-hint", steps !== null);
      if (steps) button.appendChild(buildHint(steps));
    },
  };
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

function buildHint(steps: BonusPlanStep[]): HTMLElement {
  const hint = document.createElement("span");
  hint.className = "cell-hint";
  // Le texte équivalent est porté par l'aria-label du bouton : annoncer en plus
  // six dés dessinés ne ferait que bavarder.
  hint.setAttribute("aria-hidden", "true");
  for (const { line, dice } of steps) {
    const step = document.createElement("span");
    step.className = "hint-step";
    step.append(`${dice}×`, dieFace(line));
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
  picker.style.setProperty("--pv", getVariantColor(variant));
  pickerVariant.textContent = getVariantIcon(variant);
  pickerVariant.title = variant;
  pickerLine.textContent = lineName;

  const frag = document.createDocumentFragment();
  for (const v of values) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = v === current ? "picker-value current" : "picker-value";
    chip.textContent = String(v);
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

// blur() : sinon la flèche garde le focus (et sa pastille) collé après un tap.
prevPlayerBtn.addEventListener("click", () => {
  prevPlayerBtn.blur();
  changePlayer(-1);
});
nextPlayerBtn.addEventListener("click", () => {
  nextPlayerBtn.blur();
  changePlayer(1);
});

gameScreen.addEventListener("pointerdown", onSwipeStart);
gameScreen.addEventListener("pointermove", onSwipeMove);
gameScreen.addEventListener("pointerup", onSwipeEnd);
gameScreen.addEventListener("pointercancel", resetSwipe);
// En capture : le clic de fin de geste doit être coupé avant d'atteindre la
// cellule survolée, qui ouvrirait sa fenêtre de saisie.
gameScreen.addEventListener("click", swallowSwipeClick, true);

if (isReview) {
  gameScreen.classList.add("review");
  pauseBtn.textContent = "🥇 Classement final";
  // Le bleu sert partout à revenir à l'accueil : ici on va au classement.
  pauseBtn.classList.replace("btn-secondary", "btn-gold");
  pauseBtn.addEventListener("click", () => goTo("end"));
} else {
  pauseBtn.addEventListener("click", () => {
    persist();
    goTo("home");
  });
}

makeDismissible(picker);

renderPlayer();
