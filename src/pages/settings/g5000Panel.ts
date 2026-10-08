// Panneau « Réglages du 5000 » des Paramètres : le déroulement (entrée en jeu,
// busts d'affilée, riposte) et le barème (brelan, carré, quinte, suite).
// L'objectif et les variantes ne sont pas ici : ils se choisissent à chaque
// partie, sur l'accueil du jeu.
//
// Demande de Paul (07/10/2026) : des réglages « permissifs ». Un interrupteur
// et un champ libre plutôt qu'une liste de valeurs ; pour chaque figure, les
// multiples courants ou « Perso », qui ouvre une case par chiffre.
//
// Tout s'enregistre à la volée, sans bouton « Enregistrer » : les réglages ne
// s'appliquent qu'à la prochaine partie lancée, une partie en cours garde ceux
// avec lesquels elle a démarré (ils sont recopiés dans G5000Game.rules).
//
// Ce module est évalué à l'import, donc AVANT le corps de settings.ts, donc
// avant bootstrap() : il ne lit rien du stockage à son niveau module, tout est
// dans setupG5000Panel().

import { requireEl } from "../../core/ui";
import { dieFace } from "../../core/dice";
import { getRules, saveRules } from "../../games/g5000/repo";
import {
  DEFAULT_RULES,
  FACES,
  FIGURE_MAX,
  FIGURE_MIN,
  figureValue,
  normalizeRules,
} from "../../games/g5000/rules";
import type { FaceTable, G5000Rules } from "../../games/g5000/types";

// Remplacé par les réglages enregistrés au démarrage du panneau.
let rules = DEFAULT_RULES;

// Les réglages de ce panneau, et eux seuls : « Remettre par défaut » ne touche
// ni à l'objectif ni aux variantes cochées sur l'accueil.
const PANEL_KEYS = [
  "openAt",
  "blankTurnsPenalty",
  "lastRound",
  "tripleKind",
  "fourKind",
  "fiveKind",
  "customTriples",
  "customFours",
  "customFives",
  "runPoints",
] as const;

// Les valeurs proposées d'un bouton : tout autre montant de suite est « Perso ».
const RUN_PRESETS = [1000, 1500];

// Ce qu'un interrupteur rallumé reprend : la dernière valeur saisie, sinon
// celle par défaut.
let lastOpenAt = DEFAULT_RULES.openAt;
let lastBlankTurns = DEFAULT_RULES.blankTurnsPenalty;
// La suite est en « Perso » dès qu'on l'a choisi, même si le montant saisi
// retombe sur 1 000 : le champ ne doit pas disparaître sous les doigts.
let runCustom = false;

// Chaque contrôle s'inscrit ici : tout changement les redessine tous, ce qui
// tient ensemble les réglages qui dépendent l'un de l'autre (un carré à
// « 2 × brelan » suit un brelan saisi).
const syncers: (() => void)[] = [];

// Toute modification passe par normalizeRules : bornes et pas de 50 ne sont
// écrits qu'une fois, dans le barème.
function update(patch: Partial<G5000Rules>): void {
  rules = normalizeRules({ ...rules, ...patch });
  saveRules(rules);
  syncAll();
}

function syncAll(): void {
  for (const sync of syncers) sync();
  requireEl("g5000-reset").hidden = isDefault();
}

const isDefault = (): boolean =>
  PANEL_KEYS.every(
    (key) => JSON.stringify(rules[key]) === JSON.stringify(DEFAULT_RULES[key]),
  ) && !runCustom;

// Nombre saisi dans un champ, ou `null` si le champ est vide ou illisible —
// la valeur en place est alors gardée.
function typed(input: HTMLInputElement): number | null {
  const n = Number(input.value);
  return input.value.trim() !== "" && Number.isFinite(n) ? n : null;
}

// `change` et non `input` : à la frappe, « 5 » est un état intermédiaire de
// « 500 » et serait corrigé sous les doigts du joueur.
function onNumber(input: HTMLInputElement, apply: (n: number) => void): void {
  input.addEventListener("change", () => {
    const n = typed(input);
    if (n !== null) apply(n);
    else syncAll(); // champ vidé : on réaffiche la valeur en place
  });
}

/* ---------- Déroulement ---------- */

// Un interrupteur qui, allumé, ouvre un champ : 0 en stockage veut dire éteint.
function bindToggleNumber(opts: {
  switchId: string;
  subId: string;
  inputId: string;
  read: () => number;
  write: (n: number) => Partial<G5000Rules>;
  remembered: () => number;
  remember: (n: number) => void;
  min: number;
}): void {
  const toggle = requireEl<HTMLInputElement>(opts.switchId);
  const sub = requireEl(opts.subId);
  const input = requireEl<HTMLInputElement>(opts.inputId);
  syncers.push(() => {
    const value = opts.read();
    toggle.checked = value > 0;
    sub.hidden = value === 0;
    if (value > 0) {
      input.value = String(value);
      opts.remember(value);
    }
  });
  toggle.addEventListener("change", () =>
    update(opts.write(toggle.checked ? opts.remembered() : 0)),
  );
  // Un zéro saisi n'éteint pas la règle : c'est le rôle de l'interrupteur.
  onNumber(input, (n) => update(opts.write(Math.max(opts.min, n))));
}

function bindLastRound(): void {
  const toggle = requireEl<HTMLInputElement>("g5000-last-round");
  const note = requireEl("g5000-last-round-note");
  syncers.push(() => {
    toggle.checked = rules.lastRound;
    note.textContent = rules.lastRound
      ? "Quand un joueur atteint l'objectif, chacun des autres rejoue une fois."
      : "Sinon, on finit le tour de table : tout le monde joue autant de tours.";
  });
  toggle.addEventListener("change", () => update({ lastRound: toggle.checked }));
}

/* ---------- Barème ---------- */

// Boutons segmentés : celui de la valeur en vigueur est allumé.
function bindSeg(id: string, current: () => string, choose: (value: string) => void): void {
  const seg = requireEl(id);
  const buttons = [...seg.querySelectorAll<HTMLButtonElement>("button[data-value]")];
  syncers.push(() => {
    for (const button of buttons) {
      const on = button.dataset.value === current();
      button.classList.toggle("on", on);
      button.setAttribute("aria-pressed", String(on));
    }
  });
  for (const button of buttons) {
    button.addEventListener("click", () => choose(button.dataset.value ?? ""));
  }
}

type FigureKey = "customTriples" | "customFours" | "customFives";

// Une figure réglable : ses multiples, ou « Perso » et six cases. Passer en
// « Perso » préremplit les cases avec les valeurs en vigueur — par défaut,
// 2 × le brelan pour le carré, comme le veut Paul — puis les garde : revenir
// à un multiple et repasser en « Perso » retrouve ce qu'on avait saisi.
function bindFigure<K extends "tripleKind" | "fourKind" | "fiveKind">(opts: {
  kindKey: K;
  tableKey: FigureKey;
  size: number;
  segId: string;
  gridId: string;
  name: string;
}): void {
  const grid = requireEl(opts.gridId);
  const inputs = FACES.map((face) => {
    const field = document.createElement("label");
    field.className = "face-field";
    const input = document.createElement("input");
    input.type = "number";
    input.className = "num";
    input.inputMode = "numeric";
    input.min = String(FIGURE_MIN);
    input.max = String(FIGURE_MAX);
    input.step = "50";
    input.setAttribute("aria-label", `${opts.name} de ${face}`);
    field.append(dieFace(face), input);
    grid.appendChild(field);
    onNumber(input, (n) => {
      const table = [...(rules[opts.tableKey] ?? current())];
      table[face - 1] = n;
      update({ [opts.tableKey]: table });
    });
    return input;
  });

  // Les valeurs que la partie appliquerait en ce moment.
  const current = (): FaceTable => FACES.map((face) => figureValue(face, opts.size, rules));

  syncers.push(() => {
    const custom = rules[opts.kindKey] === "custom";
    grid.hidden = !custom;
    if (custom) current().forEach((value, i) => (inputs[i].value = String(value)));
  });

  bindSeg(opts.segId, () => rules[opts.kindKey], (value) => {
    if (value === "custom") {
      update({ [opts.tableKey]: rules[opts.tableKey] ?? current(), [opts.kindKey]: value });
    } else {
      update({ [opts.kindKey]: value } as Partial<G5000Rules>);
    }
  });
}

function bindRun(): void {
  const sub = requireEl("g5000-run-sub");
  const input = requireEl<HTMLInputElement>("g5000-run-points");
  const choice = (): string =>
    runCustom || !RUN_PRESETS.includes(rules.runPoints) ? "custom" : String(rules.runPoints);

  syncers.push(() => {
    sub.hidden = choice() !== "custom";
    input.value = String(rules.runPoints);
  });
  bindSeg("g5000-run", choice, (value) => {
    runCustom = value === "custom";
    if (!runCustom) update({ runPoints: Number(value) });
    else syncAll();
  });
  onNumber(input, (n) => update({ runPoints: Math.max(0, n) }));
}

/* ---------- Mise en route du panneau ---------- */

export function setupG5000Panel(): void {
  rules = getRules();
  runCustom = !RUN_PRESETS.includes(rules.runPoints);

  bindToggleNumber({
    switchId: "g5000-open-on",
    subId: "g5000-open-sub",
    inputId: "g5000-open-at",
    read: () => rules.openAt,
    write: (n) => ({ openAt: n }),
    remembered: () => lastOpenAt,
    remember: (n) => (lastOpenAt = n),
    min: 50,
  });
  bindToggleNumber({
    switchId: "g5000-blank-on",
    subId: "g5000-blank-sub",
    inputId: "g5000-blank",
    read: () => rules.blankTurnsPenalty,
    write: (n) => ({ blankTurnsPenalty: n }),
    remembered: () => lastBlankTurns,
    remember: (n) => (lastBlankTurns = n),
    min: 1,
  });
  bindLastRound();

  const tripleNote = requireEl("g5000-triple-note");
  syncers.push(() => {
    tripleNote.textContent =
      rules.tripleKind === "custom"
        ? "une valeur par chiffre"
        : "trois 1 = 1 000, sinon chiffre × 100";
  });
  bindFigure({
    kindKey: "tripleKind",
    tableKey: "customTriples",
    size: 3,
    segId: "g5000-triple",
    gridId: "g5000-triple-grid",
    name: "Brelan",
  });
  bindFigure({
    kindKey: "fourKind",
    tableKey: "customFours",
    size: 4,
    segId: "g5000-four",
    gridId: "g5000-four-grid",
    name: "Carré",
  });
  bindFigure({
    kindKey: "fiveKind",
    tableKey: "customFives",
    size: 5,
    segId: "g5000-five",
    gridId: "g5000-five-grid",
    name: "Quinte",
  });
  bindRun();

  requireEl("g5000-reset").addEventListener("click", () => {
    runCustom = false;
    lastOpenAt = DEFAULT_RULES.openAt;
    lastBlankTurns = DEFAULT_RULES.blankTurnsPenalty;
    update(Object.fromEntries(PANEL_KEYS.map((key) => [key, DEFAULT_RULES[key]])));
  });

  syncAll();
}
