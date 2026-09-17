// Petits helpers de rendu DOM partagés par les écrans.

import type { Variant } from "./types";
import { getVariantIcon, getVariantColor } from "./variants";

export const MEDALS = ["🥇", "🥈", "🥉"];

export type Cell =
  | string
  | number
  | { strong: string | number }
  // `badge` posé hors flux (coin de la cellule) : n'affecte pas l'alignement
  // vertical de `text` d'une ligne à l'autre.
  | { text: string | number; badge: string };

export function requireEl<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Élément #${id} introuvable`);
  return el as T;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

export function strongText(text: string): HTMLElement {
  const s = document.createElement("strong");
  s.textContent = text;
  return s;
}

// Rend cliquable un élément qui n'est pas un <button> (ligne de tableau, carte,
// item de liste) : clic, Entrée/Espace, et les attributs qui l'annoncent comme
// un bouton aux lecteurs d'écran. Sans ça la fonctionnalité reste inaccessible
// au clavier.
export function makeActivatable(
  el: HTMLElement,
  label: string,
  onActivate: () => void,
): void {
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", label);
  el.addEventListener("click", onActivate);
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault(); // Espace ferait défiler la page
    onActivate();
  });
}

// Ferme un <dialog> au clic sur le fond (le clic tombe sur le dialogue
// lui-même, jamais sur son contenu) et, si un bouton est donné, au clic dessus.
// Échap est déjà géré par le navigateur.
export function makeDismissible(
  dialog: HTMLDialogElement,
  closeButtonId?: string,
): void {
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  if (closeButtonId) {
    requireEl(closeButtonId).addEventListener("click", () => dialog.close());
  }
}

// Pastille ronde colorée portant l'icône de la variante, comme les en-têtes de
// colonnes pendant une partie.
export function variantBadge(variant: Variant): HTMLElement {
  const badge = document.createElement("span");
  badge.className = "variant-badge";
  badge.style.setProperty("--vc", getVariantColor(variant));
  badge.textContent = getVariantIcon(variant);
  badge.title = variant;
  return badge;
}

// Ligne d'un récapitulatif <dl> (pop-ups de confirmation : suppression d'un
// score, d'un joueur, import, nouvelle partie).
export function summaryRow(
  target: HTMLElement,
  term: string,
  value: string | Node,
): void {
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  if (typeof value === "string") dd.textContent = value;
  else dd.appendChild(value);
  target.append(dt, dd);
}

function appendRows(tbody: HTMLElement, rows: Cell[][]): void {
  for (const cells of rows) {
    const tr = document.createElement("tr");
    for (const cell of cells) {
      const td = document.createElement("td");
      if (typeof cell !== "object") {
        td.textContent = String(cell);
      } else if ("strong" in cell) {
        td.appendChild(strongText(String(cell.strong)));
      } else {
        td.classList.add("cell-badged");
        const badge = document.createElement("span");
        badge.className = "cell-badge";
        badge.textContent = cell.badge;
        td.append(String(cell.text), badge);
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

export function renderTable(
  table: HTMLTableElement,
  headers: string[],
  rows: Cell[][],
): void {
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const label of headers) {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);

  const tbody = document.createElement("tbody");
  table.replaceChildren(thead, tbody);
  appendRows(tbody, rows);
}
