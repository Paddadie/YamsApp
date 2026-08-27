// Page Hall of Fame : meilleurs / pires scores (cliquables pour voir la feuille
// de score détaillée) et statistiques par joueur.

import { bootstrap } from "../bootstrap";
import { requireEl } from "../ui";
import { getBestScores, getWorstScores } from "../storage/hallOfFameRepo";
import { getPlayerStats } from "../storage/playerStatsRepo";
import type { ScoreEntry } from "../types";

bootstrap();

const sheetDialog = requireEl<HTMLDialogElement>("sheet-dialog");
const sheetTitle = requireEl("sheet-title");
const sheetTable = requireEl<HTMLTableElement>("sheet-table");

requireEl("sheet-close").addEventListener("click", () => sheetDialog.close());
sheetDialog.addEventListener("click", (e) => {
  if (e.target === sheetDialog) sheetDialog.close();
});

renderScoreTable("best-scores-table", getBestScores());
renderScoreTable("worst-scores-table", getWorstScores());
renderStats();

/* ---------- Tableaux meilleurs / pires ---------- */

function renderScoreTable(tableId: string, entries: ScoreEntry[]): void {
  const tbody = requireEl(tableId).querySelector("tbody");
  if (!tbody) return;
  tbody.replaceChildren();

  if (entries.length === 0) {
    tbody.appendChild(emptyRow("Aucune partie terminée pour l'instant."));
    return;
  }

  entries.forEach((entry, i) => {
    const tr = document.createElement("tr");
    tr.append(
      cell(`${i + 1}.`),
      cell(entry.name),
      cell(entry.date),
      cell(String(entry.score), true),
    );
    if (entry.sheet && entry.lineOrder) {
      tr.classList.add("clickable");
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.setAttribute("aria-label", `Voir la feuille de ${entry.name}`);
      tr.addEventListener("click", () => openSheet(entry));
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openSheet(entry);
        }
      });
    }
    tbody.appendChild(tr);
  });
}

function emptyRow(text: string): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 4;
  td.className = "hall-empty";
  td.textContent = text;
  tr.appendChild(td);
  return tr;
}

function cell(text: string, strong = false): HTMLTableCellElement {
  const td = document.createElement("td");
  if (strong) {
    const s = document.createElement("strong");
    s.textContent = text;
    td.appendChild(s);
  } else {
    td.textContent = text;
  }
  return td;
}

/* ---------- Feuille de score détaillée ---------- */

function openSheet(entry: ScoreEntry): void {
  const parts = [entry.name, entry.variant].filter(Boolean).join(" — ");
  sheetTitle.textContent = `${parts} · ${entry.score} pts · ${entry.date}`;

  const tbody = document.createElement("tbody");
  for (const line of entry.lineOrder ?? []) {
    const value = entry.sheet?.[line];
    const tr = document.createElement("tr");
    if (line === "Score Final") tr.className = "sheet-final";
    tr.append(cell(line), cell(value === undefined ? "–" : String(value), true));
    tbody.appendChild(tr);
  }
  sheetTable.replaceChildren(tbody);
  sheetDialog.showModal();
}

/* ---------- Statistiques par joueur ---------- */

function renderStats(): void {
  const list = requireEl("stats-list");
  list.replaceChildren();

  const rows = Object.entries(getPlayerStats())
    .filter(([, s]) => s.games > 0)
    .sort(([an, a], [bn, b]) => b.games - a.games || an.localeCompare(bn));

  if (rows.length === 0) {
    const li = document.createElement("li");
    li.className = "hall-empty";
    li.textContent = "Aucune statistique pour l'instant.";
    list.appendChild(li);
    return;
  }

  for (const [name, stat] of rows) {
    const li = document.createElement("li");
    li.className = "stats-row";

    const nameEl = document.createElement("span");
    nameEl.className = "stats-name";
    nameEl.textContent = name;

    const gamesEl = document.createElement("span");
    gamesEl.className = "stats-games";
    gamesEl.textContent = `${stat.games} partie${stat.games > 1 ? "s" : ""}`;

    const avgEl = document.createElement("span");
    avgEl.className = "stats-avg";
    avgEl.textContent =
      stat.points > 0 ? `moy. ${Math.round(stat.points / stat.games)}` : "moy. —";

    li.append(nameEl, gamesEl, avgEl);
    list.appendChild(li);
  }
}
