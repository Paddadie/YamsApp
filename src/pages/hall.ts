// Page Hall of Fame : tops des meilleurs / pires scores.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { appendRows, requireEl } from "../ui";
import { getBestScores, getWorstScores } from "../storage/hallOfFameRepo";
import type { ScoreEntry } from "../types";

bootstrap();

renderScores("best-scores-table", getBestScores());
renderScores("worst-scores-table", getWorstScores());

requireEl("back-to-home-btn").addEventListener("click", () => goTo("home"));

function renderScores(tableId: string, entries: ScoreEntry[]): void {
  const tbody = requireEl(tableId).querySelector("tbody");
  if (!tbody) throw new Error(`<tbody> manquant dans #${tableId}`);
  tbody.innerHTML = "";
  appendRows(
    tbody,
    entries.map((e, i) => [`${i + 1}.`, e.name, e.date, { strong: e.score }]),
  );
}
