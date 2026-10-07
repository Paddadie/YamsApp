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
import { goTo } from "../../core/nav";
import { getVariantIcon, getVariantColor } from "../../games/yams/variants";
import { variantBadge } from "../../games/yams/variantBadge";
import { sheetOf } from "../../games/yams/players";
import { makeDismissible, plural, requireEl, turnHintContent } from "../../core/ui";
import { dieFace } from "../../core/dice";
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
  UPPER_TOTAL_LINE,
  lineLabel,
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

// Une case saisissable, redessinée après chaque saisie de sa colonne.
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
  writeDerived(scores, grid);
  refreshColumn(variant); // peut lever bonusJustAnimated
  persist();

  // Effacer une valeur ne fait pas passer au joueur suivant : c'est qu'on va
  // en resaisir une autre.
  clearTimeout(autoAdvance);
  if (value === undefined) return;

  const delay = bonusJustAnimated ? BONUS_ANIM_MS + 900 : AUTO_ADVANCE_MS;
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

  // Repère des cases remplies : la teinte de la page, plus vive et à peine
  // assombrie (surtout pas grisée : ça ferait "bouton désactivé").
  gameScreen.style.setProperty("--filled-bg", richen(player.color));

  controls = new Map(game.selectedVariants.map((v) => [v, []]));
  derivedCells = new Map(game.selectedVariants.map((v) => [v, new Map()]));

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
    button.textContent = value !== undefined ? String(value) : "";
    button.classList.toggle("is-filled", value !== undefined);
    button.classList.toggle("is-empty", value === undefined);
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
  if (!showBonusHint || game.selectedVariants.length > 1) return null;
  return bonusPlan(sheetOf(currentPlayer(), variant), grid);
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
  pickerLine.textContent = lineLabel(lineName, game.rules);

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

renderPlayer();
if (!isReview) keepScreenOn();
