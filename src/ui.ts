// Petits helpers de rendu DOM partagés par les écrans.

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

export function appendRows(tbody: HTMLElement, rows: Cell[][]): void {
  for (const cells of rows) {
    const tr = document.createElement("tr");
    for (const cell of cells) {
      const td = document.createElement("td");
      if (typeof cell !== "object") {
        td.textContent = String(cell);
      } else if ("strong" in cell) {
        const strong = document.createElement("strong");
        strong.textContent = String(cell.strong);
        td.appendChild(strong);
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
  table.innerHTML = "";
  table.append(thead, tbody);
  appendRows(tbody, rows);
}
