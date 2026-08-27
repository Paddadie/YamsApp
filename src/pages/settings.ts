// Page Paramètres : bonus, règles des combinaisons, réinitialisation,
// export / import et numéro de version.

import { bootstrap } from "../bootstrap";
import { requireEl } from "../ui";
import { getRules, saveRules } from "../storage/rulesRepo";
import { DEFAULT_RULES } from "../scoring";
import { exportAllData, importAllData, isValidBackupData } from "../storage/backup";

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

function clampPoints(raw: string, fallback: number, min = 1): number {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(199, Math.max(min, n)) : fallback;
}

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
  input.min = "1";
  input.max = "199";

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
    rules[key] = { type: "fixed", points: clampPoints(input.value, 30) };
    persist();
    sync();
  });
  input.addEventListener("change", () => {
    rules[key] = { type: "fixed", points: clampPoints(input.value, 30) };
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
    rules.bonus = clampPoints(input.value, rules.bonus, 0);
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
    if (file) void restoreBackup(file);
    importInput.value = "";
  });
}

function downloadBackup(): void {
  const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yams-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function restoreBackup(file: File): Promise<void> {
  try {
    const data: unknown = JSON.parse(await file.text());
    if (!isValidBackupData(data)) {
      alert("Fichier de sauvegarde invalide.");
      return;
    }
    importAllData(data);
    alert("Sauvegarde restaurée.");
    location.href = "index.html";
  } catch {
    alert("Impossible de lire ce fichier.");
  }
}
