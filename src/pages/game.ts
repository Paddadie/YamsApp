// Page de jeu : grille de score du joueur courant, navigation entre joueurs,
// sauvegarde continue de la partie.
//
// Le tableau n'est reconstruit qu'au changement de joueur ; une saisie ne
// rafraîchit que la colonne concernée (valeur, verrous Montante/Descendante,
// lignes calculées), sans perdre le focus.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { game, hydrateGame, toSavedGame } from "../state";
import { getVariantIcon, getVariantColor } from "../variants";
import { requireEl } from "../ui";
import { getSavedGame, saveSavedGame } from "../storage/savedGameRepo";
import {
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
  type Derived,
} from "../scoring";
import type { LineName, PlayerScores, Variant } from "../types";

type LineScores = Record<LineName, number>;
type Pick = (value: number | undefined) => void;

const AUTO_ADVANCE_MS = 800;

bootstrap();

const saved = getSavedGame();
if (!saved) {
  goTo("home");
  throw new Error("Aucune partie en cours : retour à l'accueil.");
}
hydrateGame(saved);

// Grille figée pour toute la partie (règles copiées au lancement).
const grid = buildGrid(game.rules);

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

let autoAdvance: ReturnType<typeof setTimeout> | undefined;
// Posé par l'animation de fin de bonus : on repousse l'auto-avance le temps
// de la voir en entier (remplissage + gonflement/tremblement + verdict).
let bonusJustAnimated = false;

interface Widget {
  el: HTMLElement;
  setValue(value: number | undefined): void;
  setLocked(locked: boolean): void;
}
interface ScoreControl {
  refresh(): void;
}

let controls = new Map<Variant, ScoreControl[]>();
let derivedCells = new Map<Variant, Map<LineName, HTMLTableCellElement>>();

// Animation de fin de bonus, en deux temps : la barre se remplit jusqu'à sa
// valeur finale, PUIS elle vire au vert/rouge et gonfle/tremble, PUIS il ne
// reste que le verdict.
const BONUS_FILL_MS = 550;
const BONUS_REACT_MS = 750;
const BONUS_ANIM_MS = BONUS_FILL_MS + BONUS_REACT_MS;

// Joueurs dont l'animation de fin de bonus a déjà été jouée (une seule fois).
// Déclaré ici : renderPlayer() y accède dès le rendu initial.
const bonusAnimated = new Set<string>();

// blur() : sinon la flèche garde le focus (et sa pastille) collé après un tap.
prevPlayerBtn.addEventListener("click", () => {
  prevPlayerBtn.blur();
  changePlayer(-1);
});
nextPlayerBtn.addEventListener("click", () => {
  nextPlayerBtn.blur();
  changePlayer(1);
});

const pauseBtn = requireEl<HTMLButtonElement>("pause-btn");
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

picker.addEventListener("click", (e) => {
  if (e.target === picker) picker.close();
});

renderPlayer();

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
  slideSheet(delta);
}

// La feuille du joueur qui arrive entre par le côté vers lequel on va, pendant
// que le fond de page se fond vers sa couleur.
function slideSheet(delta: number): void {
  const sheet = scoreTablesContainer.firstElementChild;
  if (!(sheet instanceof HTMLElement)) return;
  const cls = delta > 0 ? "sheet-enter--next" : "sheet-enter--prev";
  sheet.classList.add("sheet-enter", cls);
  // Deux animations tournent en parallèle (glissement + fondu) : on n'attend
  // que la plus longue, sinon la fin du fondu couperait le glissement.
  const done = (e: AnimationEvent): void => {
    if (e.animationName !== "sheet-slide") return;
    sheet.removeEventListener("animationend", done);
    sheet.classList.remove("sheet-enter", cls);
  };
  sheet.addEventListener("animationend", done);
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

  for (const variant of game.variants) fillDerived(variant);
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
      nameCell.textContent = lineName;
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

function buildControl(
  td: HTMLTableCellElement,
  variant: Variant,
  lineName: LineName,
  values: number[],
  scores: LineScores,
): ScoreControl {
  const lockable = variant === "Montante" || variant === "Descendante";
  const pick: Pick = (value) => onPick(variant, lineName, value);

  const widget = buildButton(values, lineName, variant, pick);
  widget.el.setAttribute("aria-label", `${lineName}, ${variant}`);
  td.appendChild(widget.el);

  const refresh = (): void => {
    widget.setValue(scores[lineName]);
    widget.setLocked(
      lockable && !isLineEnabled(lineName, variant, scores, grid),
    );
  };
  refresh();
  return { refresh };
}

function refreshColumn(variant: Variant): void {
  fillDerived(variant, true);
  for (const control of controls.get(variant) ?? []) control.refresh();
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
  if (d.bonusHint === null) return "0";
  return `−${BONUS_THRESHOLD - d.upperSum}`;
}

/* ---------- Ligne "Bonus" (variante unique) ---------- */
// Jauge de progression vers 63 (couleur de la page assombrie) tant que le
// bonus n'est ni acquis ni définitivement manqué. Dès que le seuil est
// atteint — même avec moins de 6 cases — ou que la section chiffres est
// bouclée sans l'atteindre : animation (gonflement vert / tremblement rouge)
// puis la jauge disparaît, il ne reste que le verdict ("+35" / "0").

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
  onChange: Pick,
): Widget {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "score-cell";

  if (!isReview) {
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
  };
}

function openPicker(
  lineName: string,
  values: number[],
  current: number | undefined,
  variant: Variant,
  onPickValue: Pick,
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
