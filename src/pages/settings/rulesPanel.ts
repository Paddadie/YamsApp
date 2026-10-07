// Panneau « Règles du jeu » : barème des combinaisons, bonus, chance, et les
// préférences d'affichage. Tout y est enregistré à la volée, sans bouton
// « Enregistrer » : les règles ne s'appliquent qu'à la prochaine partie lancée.

import { requireEl } from "../../core/ui";
import { getRules, saveRules } from "../../games/yams/storage/rulesRepo";
import { getPrefs, savePrefs } from "../../games/yams/storage/prefsRepo";
import {
  DEFAULT_RULES,
  GROUP_SIZE,
  LINE_POINTS_MIN,
  LINE_POINTS_MAX,
  normalizeRules,
  type GroupLine,
} from "../../games/yams/scoring";
import type { GameRules, GroupMode } from "../../games/yams/types";
import { showMessage } from "./dialogs";

type ModeKey =
  | "brelan"
  | "full"
  | "carre"
  | "petiteSuite"
  | "grandeSuite"
  | "yams";

const MODE_KEYS: ModeKey[] = [
  "brelan",
  "full",
  "carre",
  "petiteSuite",
  "grandeSuite",
  "yams",
];

// Remplacé par les règles enregistrées au démarrage du panneau. Jamais modifié
// en place : chaque changement produit un nouvel objet (cf. update).
let rules = DEFAULT_RULES;

// Chaque contrôle s'inscrit ici : « Valeurs par défaut » les redessine tous
// d'un coup.
const syncers: (() => void)[] = [];

const resetBtn = requireEl<HTMLButtonElement>("reset-rules");

// Toute modification passe par normalizeRules : les bornes ne sont écrites
// qu'une fois, dans le barème.
function update(patch: Partial<GameRules>): void {
  rules = normalizeRules({ ...rules, ...patch });
  saveRules(rules);
  updateResetVisibility();
}

// Nombre saisi dans un champ, ou `null` si le champ est vide ou illisible —
// la valeur en place est alors gardée.
function typed(input: HTMLInputElement): number | null {
  const n = Number(input.value);
  return input.value.trim() !== "" && Number.isFinite(n) ? n : null;
}

// Le bouton "Valeurs par défaut" ne sert que si les règles ont été modifiées.
function updateResetVisibility(): void {
  resetBtn.hidden = rulesAreDefault();
}

function rulesAreDefault(): boolean {
  if (rules.bonus !== DEFAULT_RULES.bonus) return false;
  if (rules.chance !== DEFAULT_RULES.chance) return false;
  return MODE_KEYS.every((key) => {
    const a: GroupMode = rules[key];
    const b: GroupMode = DEFAULT_RULES[key];
    if (a.type === "fixed" && b.type === "fixed") return a.points === b.points;
    return a.type === b.type;
  });
}

// Proposé quand on bascule sur "Fixe" une ligne qui était en "Somme" : aucune
// valeur à reprendre, et 30 est la plus courante des règles maison.
const DEFAULT_FIXED_POINTS = 30;

/* ---------- Lignes "somme des dés / points fixes" ---------- */

function setupModeRow(key: ModeKey): void {
  const row = document.querySelector<HTMLElement>(
    `.setting-row[data-key="${key}"]`,
  );
  if (!row) throw new Error(`Ligne de réglage manquante : ${key}`);

  const control = document.createElement("div");
  control.className = "setting-control";

  const seg = document.createElement("div");
  seg.className = "seg";
  const btnSum = segButton("sum", "Somme");
  const btnFixed = segButton("fixed", "Fixe");
  // Brelan et Carré : compter seulement les dés de la combinaison (trois 5 =
  // 15), variante répandue. Le bouton dit combien de dés comptent.
  const size = key in GROUP_SIZE ? GROUP_SIZE[key as GroupLine] : null;
  const btnDice = size ? segButton("dice", `${size} dés`) : null;
  seg.append(...[btnSum, btnDice, btnFixed].filter((b): b is HTMLButtonElement => b !== null));

  const input = document.createElement("input");
  input.type = "number";
  input.className = "num";
  input.min = String(LINE_POINTS_MIN);
  input.max = String(LINE_POINTS_MAX);

  control.append(seg, input);
  row.appendChild(control);

  const fixedPoints = (): number => {
    const mode = rules[key];
    return mode.type === "fixed" ? mode.points : DEFAULT_FIXED_POINTS;
  };

  input.value = String(fixedPoints());

  const sync = (): void => {
    const type = rules[key].type;
    btnSum.classList.toggle("on", type === "sum");
    btnDice?.classList.toggle("on", type === "dice");
    btnFixed.classList.toggle("on", type === "fixed");
    input.hidden = type !== "fixed";
    if (type === "fixed") input.value = String(fixedPoints());
  };
  syncers.push(sync);

  const setFixed = (): void => {
    update({ [key]: { type: "fixed", points: typed(input) ?? fixedPoints() } });
    sync();
  };
  btnSum.addEventListener("click", () => {
    update({ [key]: { type: "sum" } });
    sync();
  });
  btnDice?.addEventListener("click", () => {
    update({ [key]: { type: "dice" } });
    sync();
  });
  btnFixed.addEventListener("click", setFixed);
  input.addEventListener("change", setFixed);

  sync();
}

function segButton(mode: string, label: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.mode = mode;
  b.textContent = label;
  return b;
}

function setupBonus(): void {
  const input = requireEl<HTMLInputElement>("bonus-points");
  const sync = (): void => {
    input.value = String(rules.bonus);
  };
  syncers.push(sync);
  input.addEventListener("change", () => {
    const bonus = typed(input);
    if (bonus !== null) update({ bonus });
    sync();
  });
  sync();
}

function setupChance(): void {
  const toggle = requireEl<HTMLInputElement>("chance-toggle");
  const sync = (): void => {
    toggle.checked = rules.chance;
  };
  syncers.push(sync);
  toggle.addEventListener("change", () => update({ chance: toggle.checked }));
  sync();
}

function setupDisplay(): void {
  // Pas dans `syncers` ni dans update() : ce n'est pas une règle de jeu, et
  // "Valeurs par défaut" ne doit donc pas y toucher.
  const prefs = getPrefs();
  const toggle = requireEl<HTMLInputElement>("bonus-hint-toggle");
  toggle.checked = prefs.bonusHint;
  toggle.addEventListener("change", () => {
    prefs.bonusHint = toggle.checked;
    savePrefs(prefs);
  });

  requireEl("bonus-hint-info").addEventListener("click", () =>
    showMessage(
      "Indice de bonus",
      "Affiche la combinaison de dés la plus probable pour débloquer le bonus " +
        "de la section chiffres.",
    ),
  );
}

function setupReset(): void {
  resetBtn.addEventListener("click", () => {
    update(DEFAULT_RULES);
    for (const sync of syncers) sync();
  });
}

/* ---------- Mise en route du panneau ---------- */

export function setupRulesPanel(): void {
  rules = getRules();
  for (const key of MODE_KEYS) setupModeRow(key);
  setupBonus();
  setupChance();
  setupDisplay();
  setupReset();
  updateResetVisibility();
}
