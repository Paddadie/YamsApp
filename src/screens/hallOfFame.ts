// Hall of Fame : meilleurs et pires scores, conservés entre les parties.
// Gère aussi l'export / import du fichier de sauvegarde.

import {
  getBestScores,
  getWorstScores,
  saveBestScores,
  saveWorstScores,
} from "../storage/hallOfFameRepo";
import { exportAllData, importAllData, isValidBackupData } from "../storage/backup";
import { appendRows, requireEl } from "../ui";
import type { Player, ScoreEntry, Variant } from "../types";

const bestTbody = requireTbody("best-scores-table");
const worstTbody = requireTbody("worst-scores-table");

export function initHallOfFame(): void {
  const exportBtn = document.getElementById("export-btn");
  const importInput = document.getElementById("import-input") as HTMLInputElement | null;

  exportBtn?.addEventListener("click", downloadBackup);
  importInput?.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (file) restoreBackup(file);
    importInput.value = "";
  });
}

export function showHallOfFame(): void {
  renderScores(bestTbody, getBestScores());
  renderScores(worstTbody, getWorstScores());
}

function renderScores(tbody: HTMLElement, entries: ScoreEntry[]): void {
  tbody.innerHTML = "";
  appendRows(
    tbody,
    entries.map((e, i) => [`${i + 1}.`, e.name, e.date, { strong: e.score }]),
  );
}

export function saveBestAndWorstScores(
  players: Player[],
  variants: Variant[],
): void {
  const date = new Date().toLocaleDateString("fr-FR");

  const newScores: ScoreEntry[] = [];
  for (const player of players) {
    for (const variant of variants) {
      const score = player.scores?.[variant]?.["Score Final"];
      if (typeof score === "number") {
        newScores.push({ name: player.name, score, date });
      }
    }
  }

  const best = [...getBestScores(), ...newScores].sort((a, b) => b.score - a.score);
  saveBestScores(best.slice(0, 5));

  const worst = [...getWorstScores(), ...newScores].sort((a, b) => a.score - b.score);
  saveWorstScores(worst.slice(0, 5));
}

/* ---------- Sauvegarde / restauration ---------- */

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
    location.reload();
  } catch {
    alert("Impossible de lire ce fichier.");
  }
}

function requireTbody(tableId: string): HTMLElement {
  const tbody = requireEl(tableId).querySelector("tbody");
  if (!tbody) throw new Error(`<tbody> manquant dans #${tableId}`);
  return tbody;
}
