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
} from "../scoring";
import type { LineName, PlayerScores, Variant } from "../types";

type LineScores = Record<LineName, number>;
type Pick = (value: number | undefined) => void;

const AUTO_ADVANCE_MS = 800;

const DERIVED_LINES: LineName[] = [
  "Bonus",
  "Total Haut",
  "Total Bas",
  "Score Final",
];

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

prevPlayerBtn.addEventListener("click", () => changePlayer(-1));
nextPlayerBtn.addEventListener("click", () => changePlayer(1));

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
}

function onPick(variant: Variant, lineName: LineName, value: number | undefined): void {
  const scores = currentPlayer().scores[variant];
  if (value === undefined) delete scores[lineName];
  else scores[lineName] = value;

  writeDerived(scores, grid);
  refreshColumn(variant);
  persist();

  clearTimeout(autoAdvance);
  autoAdvance = setTimeout(() => {
    if (isGameFinished(game.players, game.variants, grid)) {
      persist();
      goTo("end");
    } else {
      changePlayer(1);
    }
  }, AUTO_ADVANCE_MS);
}

/* ---------- Rendu ---------- */

function renderPlayer(): void {
  const player = currentPlayer();
  currentPlayerName.textContent = player.name;
  gameScreen.style.backgroundColor = player.color;
  if (themeMeta) themeMeta.content = player.color;

  controls = new Map(game.variants.map((v) => [v, []]));
  derivedCells = new Map(game.variants.map((v) => [v, new Map()]));

  const table = document.createElement("table");
  table.className = "score-table";
  table.append(buildHead(), buildBody(player.scores));

  const wrapper = document.createElement("div");
  wrapper.className = "score-wrapper";
  wrapper.appendChild(table);
  scoreTablesContainer.replaceChildren(wrapper);

  for (const variant of game.variants) fillDerived(variant);
}

function buildHead(): HTMLTableSectionElement {
  const thead = document.createElement("thead");
  const row = document.createElement("tr");
  row.appendChild(document.createElement("th")); // coin vide
  for (const variant of game.variants) {
    const th = document.createElement("th");
    th.title = variant;
    const icon = document.createElement("span");
    icon.className = "variant-icon";
    icon.style.setProperty("--vc", getVariantColor(variant));
    icon.textContent = getVariantIcon(variant);
    th.appendChild(icon);
    row.appendChild(th);
  }
  thead.appendChild(row);
  return thead;
}

function buildBody(playerScores: PlayerScores): HTMLTableSectionElement {
  const tbody = document.createElement("tbody");
  let dataRow = 0;

  grid.sections.forEach(({ label, lines }, sectionIndex) => {
    if (label) tbody.appendChild(buildSectionHead(label, sectionIndex > 0));

    for (const lineName in lines) {
      const values = lines[lineName];
      const computed = values.length === 0;

      const tr = document.createElement("tr");
      if (computed) tr.classList.add("computed");
      if (lineName === "Score Final") tr.classList.add("final");
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

function buildSectionHead(label: string, major: boolean): HTMLTableRowElement {
  const row = document.createElement("tr");
  row.className = major ? "section-head section-head--major" : "section-head";
  const cell = document.createElement("td");
  cell.colSpan = game.variants.length + 1;
  cell.textContent = label;
  row.appendChild(cell);
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
  fillDerived(variant);
  for (const control of controls.get(variant) ?? []) control.refresh();
}

function fillDerived(variant: Variant): void {
  const cells = derivedCells.get(variant);
  if (!cells) return;
  const d = computeDerived(currentPlayer().scores[variant], grid);
  const text: Record<LineName, string> = {
    Bonus: d.bonusHint ?? String(d.bonus),
    "Total Haut": String(d.totalHaut),
    "Total Bas": String(d.totalBas),
    "Score Final": String(d.scoreFinal),
  };
  for (const line of DERIVED_LINES) {
    const cell = cells.get(line);
    if (cell) cell.textContent = text[line];
  }
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
      button.textContent = value !== undefined ? String(value) : "–";
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
}
