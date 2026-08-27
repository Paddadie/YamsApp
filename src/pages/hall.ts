// Page Hall of Fame : meilleurs / pires scores (cliquables pour voir la feuille
// de score détaillée) et statistiques par joueur.

import { bootstrap } from "../bootstrap";
import { requireEl } from "../ui";
import { getBestScores, getWorstScores } from "../storage/hallOfFameRepo";
import { getPlayerStats } from "../storage/playerStatsRepo";
import { getVariantIcon, getVariantColor } from "../variants";
import type { ScoreEntry } from "../types";

bootstrap();

const sheetDialog = requireEl<HTMLDialogElement>("sheet-dialog");
const sheetTitle = requireEl("sheet-title");
const sheetTable = requireEl<HTMLTableElement>("sheet-table");

requireEl("sheet-close").addEventListener("click", () => sheetDialog.close());
sheetDialog.addEventListener("click", (e) => {
  if (e.target === sheetDialog) sheetDialog.close();
});

// Le tableau des pires scores ne contient que des parties classiques : la
// colonne « Variante » n'a d'intérêt que pour les meilleurs scores.
renderScoreTable("best-scores-table", getBestScores(), true);
renderScoreTable("worst-scores-table", getWorstScores());
renderStats();
setupCreditsEasterEgg();

/* ---------- Tableaux meilleurs / pires ---------- */

function renderScoreTable(
  tableId: string,
  entries: ScoreEntry[],
  showVariant = false,
): void {
  const tbody = requireEl(tableId).querySelector("tbody");
  if (!tbody) return;
  tbody.replaceChildren();

  const columns = showVariant ? 5 : 4;

  if (entries.length === 0) {
    tbody.appendChild(emptyRow("Aucune partie terminée pour l'instant.", columns));
    return;
  }

  entries.forEach((entry, i) => {
    const tr = document.createElement("tr");
    tr.append(cell(`${i + 1}.`), cell(entry.name));
    if (showVariant) tr.append(variantCell(entry.variant));
    tr.append(cell(entry.date), cell(String(entry.score), true));
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

function emptyRow(text: string, colSpan = 4): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = colSpan;
  td.className = "hall-empty";
  td.textContent = text;
  tr.appendChild(td);
  return tr;
}

// Pastille ronde colorée avec l'icône de la variante, comme les en-têtes de
// colonnes pendant une partie. `–` pour les entrées d'avant les variantes.
function variantCell(variant: ScoreEntry["variant"]): HTMLTableCellElement {
  const td = document.createElement("td");
  if (!variant) {
    td.textContent = "–";
    return td;
  }
  const badge = document.createElement("span");
  badge.className = "variant-badge";
  badge.style.setProperty("--vc", getVariantColor(variant));
  badge.textContent = getVariantIcon(variant);
  badge.title = variant;
  td.appendChild(badge);
  return td;
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

  // Seules les parties classiques alimentent la moyenne (cf. pires scores).
  const rows = Object.entries(getPlayerStats())
    .filter(([, s]) => s.classiqueGames > 0)
    .sort(
      ([an, a], [bn, b]) =>
        b.classiqueGames - a.classiqueGames || an.localeCompare(bn),
    );

  if (rows.length === 0) {
    const li = document.createElement("li");
    li.className = "hall-empty";
    li.textContent = "Aucune partie classique terminée pour l'instant.";
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
    gamesEl.textContent = `${stat.classiqueGames} partie${stat.classiqueGames > 1 ? "s" : ""}`;

    const avgEl = document.createElement("span");
    avgEl.className = "stats-avg";
    avgEl.textContent = `moy. ${Math.round(stat.classiquePoints / stat.classiqueGames)}`;

    li.append(nameEl, gamesEl, avgEl);
    list.appendChild(li);
  }
}

/* ---------- Easter egg : 5 clics sur le trophée ---------- */

function setupCreditsEasterEgg(): void {
  const trophy = document.getElementById("hof-trophy");
  if (!trophy) return;

  const MAX_GAP_MS = 1200; // délai max entre deux clics pour garder le compte
  let count = 0;
  let last = 0;

  trophy.addEventListener("animationend", () =>
    trophy.classList.remove("celebrate"),
  );

  trophy.addEventListener("click", () => {
    const now = Date.now();
    count = now - last < MAX_GAP_MS ? count + 1 : 1;
    last = now;
    if (count < 5) return;

    count = 0;
    trophy.classList.remove("celebrate");
    void trophy.offsetWidth; // force le redémarrage de l'animation
    trophy.classList.add("celebrate");
    showCredits();
  });
}

let creditsTimer: ReturnType<typeof setTimeout> | undefined;

function showCredits(): void {
  const card = document.getElementById("app-credit") ?? buildCreditCard();
  clearTimeout(creditsTimer);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => card.classList.add("show")),
  );
  creditsTimer = setTimeout(() => card.classList.remove("show"), 4200);
}

function buildCreditCard(): HTMLElement {
  const card = document.createElement("div");
  card.id = "app-credit";

  const text = document.createElement("span");
  text.className = "credit-text";
  text.append(
    "Conçu par ",
    strong("Marlo"),
    document.createElement("br"),
    "développé par ",
    strong("Poulet"),
  );

  card.append(spark(), text, spark());
  document.body.appendChild(card);
  return card;
}

function spark(): HTMLElement {
  const s = document.createElement("span");
  s.className = "credit-spark";
  s.textContent = "✨";
  s.setAttribute("aria-hidden", "true");
  return s;
}

function strong(label: string): HTMLElement {
  const s = document.createElement("strong");
  s.textContent = label;
  return s;
}
