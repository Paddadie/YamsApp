// Feuille de score détaillée d'une entrée du Hall of Fame, telle qu'elle
// s'affiche dans la pop-up du Hall of Fame et dans celle de suppression des
// Paramètres. Les deux écrans partagent ce rendu et la classe CSS `.score-sheet`.

import {
  BONUS_LINE,
  FINAL_SCORE_LINE,
  LOWER_TOTAL_LINE,
  UPPER_TOTAL_LINE,
} from "./scoring";
import { strongText } from "./ui";
import type { ScoreEntry } from "./types";

// Totaux calculés : affichés en retrait pour se distinguer des scores saisis.
const SUBTOTAL_LINES = new Set([BONUS_LINE, UPPER_TOTAL_LINE, LOWER_TOTAL_LINE]);

// Le corps du tableau, ou `null` si l'entrée ne porte pas de feuille (parties
// enregistrées avant que le détail ne soit conservé). La ligne « Score Final »
// est omise : les deux écrans affichent déjà le total à part, juste au-dessus.
export function scoreSheetBody(entry: ScoreEntry): HTMLTableSectionElement | null {
  if (!entry.sheet || !entry.lineOrder) return null;

  const tbody = document.createElement("tbody");
  for (const line of entry.lineOrder) {
    if (line === FINAL_SCORE_LINE) continue;

    const row = document.createElement("tr");
    if (SUBTOTAL_LINES.has(line)) row.className = "sheet-derived";

    const name = document.createElement("td");
    name.textContent = line;

    const value = document.createElement("td");
    const score = entry.sheet[line];
    value.appendChild(strongText(score === undefined ? "–" : String(score)));

    row.append(name, value);
    tbody.appendChild(row);
  }
  return tbody;
}
