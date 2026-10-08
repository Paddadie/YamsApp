// Nettoyage des classements du Hall of Fame du Yams, dans le panneau « Joueurs
// et scores » — le pendant de l'effacement des records du 5000.
//
// Comme partout dans l'application, rien ne s'efface sans une pop-up qui
// montre ce qui va disparaître : ici la feuille de score détaillée.
//
// Ce module est évalué à l'import, donc AVANT le corps de settings.ts, donc
// avant bootstrap() : il ne lit rien du stockage à son niveau module, tout est
// dans setupYamsHallAdmin().

import { formatDate } from "../../core/dates";
import { icon } from "../../core/icons";
import { makeDismissible, requireEl, summaryRow } from "../../core/ui";
import { variantBadgeData } from "../../games/yams/variantBadge";
import { scoreSheetBody } from "../../games/yams/scoreSheet";
import {
  getBestScores,
  getWorstScores,
  saveBestScores,
  saveWorstScores,
} from "../../games/yams/storage/hallOfFameRepo";
import type { ScoreEntry } from "../../games/yams/types";
import { SCORES_CHANGED, emptyItem, limitList } from "./adminList";

interface ScoreList {
  get: () => ScoreEntry[];
  save: (list: ScoreEntry[]) => void;
}

const BEST_STORE: ScoreList = { get: getBestScores, save: saveBestScores };
const WORST_STORE: ScoreList = { get: getWorstScores, save: saveWorstScores };

let pendingDelete: { index: number; store: ScoreList } | null = null;

function render(): void {
  renderList("best-admin", BEST_STORE);
  renderList("worst-admin", WORST_STORE);
}

function renderList(listId: string, store: ScoreList): void {
  const list = requireEl(listId);
  const entries = store.get();
  list.replaceChildren();

  if (entries.length === 0) {
    list.appendChild(emptyItem("Le palmarès est encore vide."));
    return;
  }

  entries.forEach((entry, index) => {
    list.appendChild(scoreRow(entry, index, store));
  });
  limitList(list, listId);
}

function scoreRow(entry: ScoreEntry, index: number, store: ScoreList): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "score-admin-row";

  const name = document.createElement("span");
  name.className = "score-admin-name";
  name.textContent = entry.name;

  const score = document.createElement("span");
  score.className = "score-admin-score";
  score.textContent = `${entry.score} pts`;

  const date = document.createElement("span");
  date.className = "score-admin-date";
  // Même écriture que le palmarès : « il y a 6 jours », puis « 15 août 2026 ».
  date.textContent = formatDate(entry.date);

  const del = document.createElement("button");
  del.type = "button";
  del.className = "score-admin-del";
  del.setAttribute("aria-label", `Supprimer ${entry.name}, ${entry.score} points`);
  del.appendChild(icon("trash"));
  del.addEventListener("click", () => openDeleteDialog(entry, index, store));

  li.append(name, score, date, del);
  return li;
}

// Pop-up récapitulant la partie visée avant de confirmer la suppression.
function openDeleteDialog(entry: ScoreEntry, index: number, store: ScoreList): void {
  pendingDelete = { index, store };

  const summary = requireEl("delete-summary");
  summary.replaceChildren();
  summaryRow(summary, "Joueur", entry.name);
  summaryRow(summary, "Score", `${entry.score} pts`);
  if (entry.date) summaryRow(summary, "Date", formatDate(entry.date));
  // La pastille seule, sans le nom à côté : partout ailleurs dans l'appli la
  // variante se lit à son icône, et son nom reste dans l'infobulle.
  if (entry.variant) {
    summaryRow(summary, "Variante", { badges: [variantBadgeData(entry.variant)] });
  }

  // Feuille de score détaillée si l'entrée la porte (parties d'avant : aucune).
  const sheet = requireEl<HTMLTableElement>("delete-sheet");
  const body = scoreSheetBody(entry);
  sheet.replaceChildren();
  sheet.hidden = body === null;
  if (body) sheet.appendChild(body);

  requireEl<HTMLDialogElement>("delete-dialog").showModal();
}

function confirmDelete(): void {
  if (!pendingDelete) return;
  const { index, store } = pendingDelete;
  store.save(store.get().filter((_, i) => i !== index));
  pendingDelete = null;
  requireEl<HTMLDialogElement>("delete-dialog").close();
  render();
}

export function setupYamsHallAdmin(): void {
  render();
  makeDismissible(requireEl<HTMLDialogElement>("delete-dialog"), "delete-cancel");
  requireEl("delete-confirm").addEventListener("click", confirmDelete);
  // Un joueur renommé ou supprimé dans la liste au-dessus emporte ses scores.
  document.addEventListener(SCORES_CHANGED, render);
}
