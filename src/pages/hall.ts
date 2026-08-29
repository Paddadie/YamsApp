// Page Hall of Fame : meilleurs / pires scores (cliquables pour voir la feuille
// de score détaillée) et statistiques par joueur.

import { bootstrap } from "../bootstrap";
import {
  MEDALS,
  makeActivatable,
  plural,
  requireEl,
  strongText,
  variantBadge,
} from "../ui";
import { getBestScores, getWorstScores } from "../storage/hallOfFameRepo";
import { getPlayerStats } from "../storage/playerStatsRepo";
import { compareNames } from "../playerName";
import {
  BONUS_LINE,
  FINAL_SCORE_LINE,
  LOWER_TOTAL_LINE,
  UPPER_TOTAL_LINE,
} from "../scoring";
import { formatDate } from "../dates";
import type { ScoreEntry } from "../types";

bootstrap();

const sheetDialog = requireEl<HTMLDialogElement>("sheet-dialog");
const sheetTitle = requireEl("sheet-title");
const sheetRank = requireEl("sheet-rank");
const sheetMeta = requireEl("sheet-meta");
const sheetTotalValue = requireEl("sheet-total-value");
const sheetTable = requireEl<HTMLTableElement>("sheet-table");

// Lignes de la feuille qui sont des totaux calculés, pas des scores saisis
// (le score final, lui, est affiché à part dans l'en-tête du dialogue).
const SUBTOTAL_LINES = new Set([BONUS_LINE, UPPER_TOTAL_LINE, LOWER_TOTAL_LINE]);

interface SheetRank {
  kind: "best" | "worst";
  position: number; // 1 = record / pire absolu
}

requireEl("sheet-close").addEventListener("click", () => sheetDialog.close());
sheetDialog.addEventListener("click", (e) => {
  if (e.target === sheetDialog) sheetDialog.close();
});

const bestScores = getBestScores();
const worstScores = getWorstScores();

renderRecordCard();
// Le tableau des pires scores ne contient que des parties classiques : la
// colonne « Variante » n'a d'intérêt que pour les meilleurs scores.
renderScoreTable("best-scores-table", bestScores, "best", true);
renderScoreTable("worst-scores-table", worstScores, "worst");
renderStats();
setupCreditsEasterEgg();

/* ---------- Carte « Record du téléphone » ---------- */

function renderRecordCard(): void {
  const card = requireEl("record-card");
  const top = bestScores[0];
  if (!top) {
    card.hidden = true;
    return;
  }
  card.hidden = false;

  const crown = document.createElement("span");
  crown.className = "record-crown";
  crown.textContent = "👑";

  const label = document.createElement("span");
  label.className = "record-label";
  label.textContent = "Record du téléphone";

  const main = document.createElement("span");
  main.className = "record-main";
  main.append(strongText(top.name), ` · ${top.score} pts`);

  const meta = document.createElement("span");
  meta.className = "record-meta";
  if (top.variant) meta.appendChild(variantBadge(top.variant));
  meta.append(formatDate(top.date));

  const body = document.createElement("div");
  body.className = "record-body";
  body.append(label, main, meta);

  card.replaceChildren(crown, body);

  // Cliquable vers la feuille détaillée, comme les lignes des tableaux.
  if (top.sheet && top.lineOrder) {
    card.classList.add("clickable");
    makeActivatable(card, `Voir la feuille de ${top.name}`, () =>
      openSheet(top, { kind: "best", position: 1 }),
    );
  }
}

/* ---------- Tableaux meilleurs / pires ---------- */

function renderScoreTable(
  tableId: string,
  entries: ScoreEntry[],
  kind: SheetRank["kind"],
  showVariant = false,
): void {
  const tbody = requireEl(tableId).querySelector("tbody");
  if (!tbody) return;
  tbody.replaceChildren();

  const columns = showVariant ? 4 : 3;

  if (entries.length === 0) {
    tbody.appendChild(emptyRow("Aucune partie terminée pour l'instant.", columns));
    return;
  }

  entries.forEach((entry, i) => {
    const tr = document.createElement("tr");
    tr.append(cell(entry.name));
    if (showVariant) tr.append(variantCell(entry.variant));
    tr.append(cell(formatDate(entry.date)), cell(String(entry.score), true));
    if (entry.sheet && entry.lineOrder) {
      tr.classList.add("clickable");
      makeActivatable(tr, `Voir la feuille de ${entry.name}`, () =>
        openSheet(entry, { kind, position: i + 1 }),
      );
    }
    tbody.appendChild(tr);
  });
}

function emptyRow(text: string, colSpan = 3): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = colSpan;
  td.className = "hall-empty";
  td.textContent = text;
  tr.appendChild(td);
  return tr;
}

// `–` pour les entrées d'avant les variantes.
function variantCell(variant: ScoreEntry["variant"]): HTMLTableCellElement {
  const td = document.createElement("td");
  if (variant) td.appendChild(variantBadge(variant));
  else td.textContent = "–";
  return td;
}

function cell(text: string, strong = false): HTMLTableCellElement {
  const td = document.createElement("td");
  if (strong) td.appendChild(strongText(text));
  else td.textContent = text;
  return td;
}

/* ---------- Feuille de score détaillée ---------- */

function rankChip(rank: SheetRank): { label: string; cls: string } {
  const noun = rank.kind === "best" ? "meilleur score" : "pire score";
  const superlative =
    rank.kind === "best" ? "Record du téléphone" : "Pire score du téléphone";
  const text = rank.position === 1 ? superlative : `${rank.position}ᵉ ${noun}`;
  const icon =
    rank.kind === "best"
      ? (MEDALS[rank.position - 1] ?? "")
      : rank.position <= 3
        ? "💩"
        : "";
  return {
    label: icon ? `${icon} ${text}` : text,
    cls: rank.kind === "best" ? "sheet-rank--best" : "sheet-rank--worst",
  };
}

function openSheet(entry: ScoreEntry, rank?: SheetRank): void {
  sheetTitle.textContent = entry.name;

  if (rank) {
    const { label, cls } = rankChip(rank);
    sheetRank.hidden = false;
    sheetRank.className = `sheet-rank ${cls}`;
    sheetRank.textContent = label;
  } else {
    sheetRank.hidden = true;
  }

  sheetMeta.replaceChildren();
  if (entry.variant) sheetMeta.appendChild(variantBadge(entry.variant));
  sheetMeta.append(
    [entry.variant, formatDate(entry.date)].filter(Boolean).join(" · "),
  );

  sheetTotalValue.textContent = String(entry.score);

  const tbody = document.createElement("tbody");
  for (const line of entry.lineOrder ?? []) {
    if (line === FINAL_SCORE_LINE) continue; // déjà affiché en gros dans l'en-tête
    const value = entry.sheet?.[line];
    const tr = document.createElement("tr");
    if (SUBTOTAL_LINES.has(line)) tr.className = "sheet-derived";
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
  // Classement par score moyen décroissant, puis par nom.
  const avg = (s: { classiquePoints: number; classiqueGames: number }): number =>
    s.classiquePoints / s.classiqueGames;
  const rows = Object.entries(getPlayerStats())
    .filter(([, s]) => s.classiqueGames > 0)
    .sort(([an, a], [bn, b]) => avg(b) - avg(a) || compareNames(an, bn));

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

    const avgEl = document.createElement("span");
    avgEl.className = "stats-avg";
    avgEl.textContent = `moy. ${Math.round(avg(stat))}`;

    const main = document.createElement("div");
    main.className = "stats-main";
    main.append(nameEl, avgEl);

    const sub = document.createElement("span");
    sub.className = "stats-sub";
    const bits = [plural(stat.classiqueGames, "partie")];
    if (stat.classiqueBest > 0) bits.unshift(`record ${stat.classiqueBest}`);
    sub.textContent = bits.join(" · ");

    li.append(main, sub);
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
    strongText("Marlo"),
    document.createElement("br"),
    "Développé par ",
    strongText("Poulet"),
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
