// Petits helpers de rendu DOM partagés par les écrans. Ne connaît aucun jeu :
// ce qui est propre à l'un d'eux (pastille de variante du Yams…) vit sous
// games/<jeu>/.

import { gommette, icon, type IconName } from "./icons";

export type Cell =
  | string
  | number
  | { strong: string | number }
  // Le rang d'un classement, en gommette (cf. icons.ts).
  | { rank: number }
  // `badge` (un pictogramme, son sens dans `badgeLabel`) posé hors flux, dans
  // le coin de la cellule : n'affecte pas l'alignement vertical de `text`
  // d'une ligne à l'autre.
  | { text: string | number; badge: IconName; badgeLabel: string };

// En-tête de colonne : un texte, ou un élément (pastille de variante).
export type HeaderCell = string | Node;

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

// Les couleurs des joueurs d'une partie, en pastilles qui se chevauchent
// (reprise d'une partie). Décoratif : les noms sont écrits à côté.
export function playerDots(colors: string[]): HTMLElement {
  const dots = document.createElement("span");
  dots.className = "player-dots";
  dots.setAttribute("aria-hidden", "true");
  for (const color of colors) {
    const dot = document.createElement("i");
    dot.style.setProperty("--dot", color);
    dots.appendChild(dot);
  }
  return dots;
}

// Contenu de la pastille « C'est à Marie › » des écrans de jeu. « C'est à »
// est à part : sur un téléphone étroit il disparaît (CSS), pour que la place
// qui reste aille au nom plutôt qu'à la formule.
export function turnHintContent(name: string): (Node | string)[] {
  const lead = document.createElement("span");
  lead.className = "turn-hint-lead";
  lead.textContent = "C'est à ";
  return [lead, `${name} ›`];
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

// Pastille ronde colorée portant une icône (les variantes du Yams en sont).
// Décrite en données : un jeu peut en mettre dans un récapitulatif sans toucher
// au DOM. Le libellé n'est que dans l'infobulle.
export interface Badge {
  icon: IconName;
  color: string;
  title: string;
}

export function badge({ icon: name, color, title }: Badge): HTMLElement {
  const el = document.createElement("span");
  el.className = "badge";
  el.style.setProperty("--vc", color);
  el.appendChild(icon(name));
  el.title = title;
  // Le pictogramme est décoratif : sans ça, la pastille seule n'aurait pas de
  // nom pour un lecteur d'écran.
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", title);
  return el;
}

// Valeur d'une ligne de récapitulatif : un texte, ou une rangée de pastilles.
export type SummaryValue = string | { badges: Badge[] };

// Ligne d'un récapitulatif <dl> (pop-ups de confirmation : suppression d'un
// score, d'un joueur, import, nouvelle partie).
export function summaryRow(
  target: HTMLElement,
  term: string,
  value: SummaryValue,
): void {
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  if (typeof value === "string") {
    dd.textContent = value;
  } else {
    const row = document.createElement("span");
    row.className = "badge-row";
    row.append(...value.badges.map(badge));
    dd.appendChild(row);
  }
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
      } else if ("rank" in cell) {
        td.className = "cell-rank";
        td.appendChild(gommette(cell.rank));
      } else {
        td.classList.add("cell-badged");
        const mark = document.createElement("span");
        mark.className = `cell-badge cell-badge--${cell.badge}`;
        mark.setAttribute("role", "img");
        mark.setAttribute("aria-label", cell.badgeLabel);
        mark.appendChild(icon(cell.badge));
        td.append(String(cell.text), mark);
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

export function renderTable(
  table: HTMLTableElement,
  headers: HeaderCell[],
  rows: Cell[][],
): void {
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const label of headers) {
    const th = document.createElement("th");
    th.append(label);
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);

  const tbody = document.createElement("tbody");
  table.replaceChildren(thead, tbody);
  appendRows(tbody, rows);
}
