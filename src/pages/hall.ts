// Page Hall of Fame : tops des meilleurs / pires scores + export / import
// de la sauvegarde complète.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { appendRows, requireEl } from "../ui";
import { getBestScores, getWorstScores } from "../storage/hallOfFameRepo";
import { exportAllData, importAllData, isValidBackupData } from "../storage/backup";
import type { ScoreEntry } from "../types";

bootstrap();

renderScores("best-scores-table", getBestScores());
renderScores("worst-scores-table", getWorstScores());

requireEl("app-version").textContent = `v${__APP_VERSION__}`;
requireEl("back-to-home-btn").addEventListener("click", () => goTo("home"));

requireEl("export-btn").addEventListener("click", downloadBackup);

const importInput = requireEl<HTMLInputElement>("import-input");
importInput.addEventListener("change", () => {
  const file = importInput.files?.[0];
  if (file) void restoreBackup(file);
  importInput.value = "";
});

function renderScores(tableId: string, entries: ScoreEntry[]): void {
  const tbody = requireEl(tableId).querySelector("tbody");
  if (!tbody) throw new Error(`<tbody> manquant dans #${tableId}`);
  tbody.innerHTML = "";
  appendRows(
    tbody,
    entries.map((e, i) => [`${i + 1}.`, e.name, e.date, { strong: e.score }]),
  );
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
    goTo("home");
  } catch {
    alert("Impossible de lire ce fichier.");
  }
}
