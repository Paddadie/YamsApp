// Page Hall of Fame : meilleurs / pires scores (cliquables pour voir la feuille
// de score détaillée) et statistiques par joueur.
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).

import { bootstrap } from "../../core/bootstrap";
import { YAMS } from "../../games/yams/gameDef";
import { applyGameTheme } from "../gameTheme";
import { gommette, icon } from "../../core/icons";
import {
  makeActivatable,
  makeDismissible,
  plural,
  requireEl,
  strongText,
} from "../../core/ui";
import { variantBadge } from "../../games/yams/variantBadge";
import { getBestScores, getWorstScores } from "../../games/yams/storage/hallOfFameRepo";
import { getPlayerStats } from "../../games/yams/storage/playerStatsRepo";
import { compareNames } from "../../core/playerName";
import { scoreSheetBody } from "../../games/yams/scoreSheet";
import { formatDate } from "../../core/dates";
import type { ScoreEntry } from "../../games/yams/types";

bootstrap();

const sheetDialog = requireEl<HTMLDialogElement>("sheet-dialog");
const sheetTitle = requireEl("sheet-title");
const sheetRank = requireEl("sheet-rank");
const sheetMeta = requireEl("sheet-meta");
const sheetTotalValue = requireEl("sheet-total-value");
const sheetTable = requireEl<HTMLTableElement>("sheet-table");

interface SheetRank {
  kind: "best" | "worst";
  position: number; // 1 = record / pire absolu
}

const bestScores = getBestScores();
const worstScores = getWorstScores();

/* ---------- Carte « Record du téléphone » ---------- */

function renderRecordCard(): void {
  const card = requireEl("record-card");
  const top = bestScores[0];
  if (!top) {
    card.hidden = true;
    return;
  }
  card.hidden = false;

  // Un post-it scotché : la gommette d'or, le nom en capitales, le score en
  // très grand à droite.
  const crown = gommette(1, { big: true });

  const label = document.createElement("span");
  label.className = "record-label";
  label.textContent = "Record du téléphone";

  const name = document.createElement("span");
  name.className = "record-name";
  name.textContent = top.name;

  const meta = document.createElement("span");
  meta.className = "record-meta";
  if (top.variant) meta.appendChild(variantBadge(top.variant));
  meta.append(formatDate(top.date));

  const body = document.createElement("div");
  body.className = "record-body";
  body.append(label, name, meta);

  const score = document.createElement("span");
  score.className = "record-score";
  const points = document.createElement("span");
  points.textContent = "points";
  score.append(strongText(String(top.score)), points);

  card.replaceChildren(crown, body, score);

  // Cliquable vers la feuille détaillée, comme les lignes des tableaux.
  if (top.sheet && top.lineOrder) {
    card.classList.add("clickable");
    const go = document.createElement("span");
    go.className = "record-go";
    go.appendChild(icon("chevronRight"));
    card.appendChild(go);
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
  const table = requireEl(tableId);
  const tbody = table.querySelector("tbody");
  if (!tbody) return;
  tbody.replaceChildren();

  const columns = showVariant ? 5 : 4;

  // Vide : pas d'en-têtes de colonnes au-dessus de rien (CSS), une phrase à
  // la place.
  table.classList.toggle("is-empty", entries.length === 0);
  if (entries.length === 0) {
    tbody.appendChild(emptyRow(emptyContent(kind), columns));
    return;
  }

  entries.forEach((entry, i) => {
    const tr = document.createElement("tr");
    // Le rang, en gommette : or / argent / bronze, puis blanche.
    const rank = document.createElement("td");
    rank.className = "cell-rank";
    rank.appendChild(gommette(i + 1));
    tr.append(rank, cell(entry.name));
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

function emptyRow(content: string | Node[], colSpan = 3): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = colSpan;
  td.className = "hall-empty";
  td.append(...(typeof content === "string" ? [content] : content));
  tr.appendChild(td);
  return tr;
}

// Textes des tableaux vides (choisis par Paul, 08/10). Les meilleurs scores
// montrent le podium à prendre : trois gommettes en pointillés.
function emptyContent(kind: SheetRank["kind"]): Node[] {
  if (kind !== "best") {
    return [document.createTextNode("Les plus petits scores des parties classiques viendront ici.")];
  }
  const podium = document.createElement("span");
  podium.className = "empty-podium";
  for (const rank of [1, 2, 3]) {
    const spot = gommette(rank);
    spot.classList.add("gommette--empty");
    podium.appendChild(spot);
  }
  const title = document.createElement("strong");
  title.className = "hall-empty-title";
  title.textContent = "Trois places à prendre";
  const text = document.createElement("span");
  text.textContent = "La première partie terminée inscrit ses joueurs ici.";
  return [podium, title, text];
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

// Le rang de la partie dans son classement : la gommette or / argent / bronze
// des trois premières places, chez les meilleurs comme chez les pires.
function rankChip(rank: SheetRank): { content: (Node | string)[]; cls: string } {
  const noun = rank.kind === "best" ? "meilleur score" : "pire score";
  const superlative =
    rank.kind === "best" ? "Record du téléphone" : "Pire score du téléphone";
  const text = rank.position === 1 ? superlative : `${rank.position}ᵉ ${noun}`;
  const mark = rank.position <= 3 ? gommette(rank.position) : null;
  return {
    content: mark ? [mark, text] : [text],
    cls: rank.kind === "best" ? "sheet-rank--best" : "sheet-rank--worst",
  };
}

function openSheet(entry: ScoreEntry, rank?: SheetRank): void {
  sheetTitle.textContent = entry.name;

  if (rank) {
    const { content, cls } = rankChip(rank);
    sheetRank.hidden = false;
    sheetRank.className = `sheet-rank ${cls}`;
    sheetRank.replaceChildren(...content);
  } else {
    sheetRank.hidden = true;
  }

  sheetMeta.replaceChildren();
  // La pastille porte déjà le nom de la variante dans son title : l'écrire à
  // côté ferait doublon.
  if (entry.variant) sheetMeta.appendChild(variantBadge(entry.variant));
  sheetMeta.append(formatDate(entry.date));

  sheetTotalValue.textContent = String(entry.score);

  const body = scoreSheetBody(entry);
  sheetTable.replaceChildren();
  if (body) sheetTable.appendChild(body);
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
    li.textContent = "Les moyennes arrivent après la première partie classique.";
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
    const avgLabel = document.createElement("small");
    avgLabel.textContent = "moy.";
    avgEl.append(avgLabel, String(Math.round(avg(stat))));

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
  const trophy = requireEl("hof-trophy");

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
  s.appendChild(icon("sparkle"));
  s.setAttribute("aria-hidden", "true");
  return s;
}

/* ---------- Mise en route ---------- */

applyGameTheme(requireEl("hall-screen"), YAMS);

makeDismissible(sheetDialog, "sheet-close");
renderRecordCard();
// Le tableau des pires scores ne contient que des parties classiques : la
// colonne « Variante » n'a d'intérêt que pour les meilleurs scores.
renderScoreTable("best-scores-table", bestScores, "best", true);
renderScoreTable("worst-scores-table", worstScores, "worst");
renderStats();
setupCreditsEasterEgg();
