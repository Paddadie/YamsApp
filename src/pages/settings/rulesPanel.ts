// Panneau « Règles du jeu » : barème des combinaisons, bonus, chance, et les
// préférences d'affichage. Tout y est enregistré à la volée, sans bouton
// « Enregistrer » : les règles ne s'appliquent qu'à la prochaine partie lancée.

import { requireEl } from "../../ui";
import { getRules, saveRules } from "../../storage/rulesRepo";
import { getPrefs, savePrefs } from "../../storage/prefsRepo";
import {
  DEFAULT_RULES,
  BONUS_MIN,
  BONUS_MAX,
  LINE_POINTS_MIN,
  LINE_POINTS_MAX,
} from "../../scoring";
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

// Remplacé par les règles enregistrées au démarrage du panneau.
let rules = DEFAULT_RULES;
const syncers: (() => void)[] = [];

const resetBtn = requireEl<HTMLButtonElement>("reset-rules");

function persist(): void {
  saveRules(rules);
  updateResetVisibility();
}

// Le bouton "Valeurs par défaut" ne sert que si les règles ont été modifiées.
function updateResetVisibility(): void {
  resetBtn.hidden = rulesAreDefault();
}

function rulesAreDefault(): boolean {
  if (rules.bonus !== DEFAULT_RULES.bonus) return false;
  if (rules.chance !== DEFAULT_RULES.chance) return false;
  return MODE_KEYS.every((key) => {
    const a = rules[key];
    const b = DEFAULT_RULES[key];
    if (a.type === "sum" && b.type === "sum") return true;
    if (a.type === "fixed" && b.type === "fixed") return a.points === b.points;
    return false;
  });
}

function clamp(raw: string, fallback: number, min: number, max: number): number {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

const clampLine = (raw: string, fallback: number): number =>
  clamp(raw, fallback, LINE_POINTS_MIN, LINE_POINTS_MAX);

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
  seg.append(btnSum, btnFixed);

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
    const isSum = rules[key].type === "sum";
    btnSum.classList.toggle("on", isSum);
    btnFixed.classList.toggle("on", !isSum);
    input.hidden = isSum;
    if (!isSum) input.value = String(fixedPoints());
  };
  syncers.push(sync);

  btnSum.addEventListener("click", () => {
    rules[key] = { type: "sum" };
    persist();
    sync();
  });
  btnFixed.addEventListener("click", () => {
    rules[key] = { type: "fixed", points: clampLine(input.value, DEFAULT_FIXED_POINTS) };
    persist();
    sync();
  });
  input.addEventListener("change", () => {
    rules[key] = { type: "fixed", points: clampLine(input.value, DEFAULT_FIXED_POINTS) };
    persist();
    sync();
  });

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
    rules.bonus = clamp(input.value, rules.bonus, BONUS_MIN, BONUS_MAX);
    persist();
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
  toggle.addEventListener("change", () => {
    rules.chance = toggle.checked;
    persist();
  });
  sync();
}

function setupDisplay(): void {
  // Pas dans `syncers` ni dans persist() : ce n'est pas une règle de jeu, et
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
    rules = structuredClone(DEFAULT_RULES);
    persist();
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
