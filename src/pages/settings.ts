// Page Paramètres : bonus, règles des combinaisons, réinitialisation,
// export / import et numéro de version.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { requireEl } from "../ui";
import { getRules, saveRules } from "../storage/rulesRepo";
import {
  DEFAULT_RULES,
  BONUS_MIN,
  BONUS_MAX,
  LINE_POINTS_MIN,
  LINE_POINTS_MAX,
} from "../scoring";
import { downloadBackup, importBackupFile } from "../storage/backup";

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

bootstrap();

requireEl("app-version").textContent = `v${__APP_VERSION__}`;

let rules = getRules();
const syncers: (() => void)[] = [];

for (const key of MODE_KEYS) setupModeRow(key);
setupBonus();
setupChance();
setupReset();
setupBackup();

function persist(): void {
  saveRules(rules);
}

function clamp(raw: string, fallback: number, min: number, max: number): number {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

const clampLine = (raw: string, fallback: number): number =>
  clamp(raw, fallback, LINE_POINTS_MIN, LINE_POINTS_MAX);

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
    return mode.type === "fixed" ? mode.points : 30;
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
    rules[key] = { type: "fixed", points: clampLine(input.value, 30) };
    persist();
    sync();
  });
  input.addEventListener("change", () => {
    rules[key] = { type: "fixed", points: clampLine(input.value, 30) };
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

/* ---------- Bonus (section chiffres) ---------- */

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

/* ---------- Chance : activée / non ---------- */

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

/* ---------- Réinitialisation ---------- */

function setupReset(): void {
  requireEl("reset-rules").addEventListener("click", () => {
    rules = structuredClone(DEFAULT_RULES);
    persist();
    for (const sync of syncers) sync();
  });
}

/* ---------- Export / import de sauvegarde ---------- */

function setupBackup(): void {
  requireEl("export-btn").addEventListener("click", downloadBackup);

  const importInput = requireEl<HTMLInputElement>("import-input");
  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    if (file) void restore(file);
  });
}

async function restore(file: File): Promise<void> {
  const result = await importBackupFile(file);
  if (result === "ok") {
    alert("Sauvegarde restaurée.");
    goTo("home");
  } else if (result === "invalid") {
    alert("Fichier de sauvegarde invalide.");
  } else {
    alert("Impossible de lire ce fichier.");
  }
}
