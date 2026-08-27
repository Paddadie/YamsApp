// Petits helpers de rendu DOM partagés par les écrans.

type Cell = string | number | { strong: string | number };

export function requireEl<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Élément #${id} introuvable`);
  return el as T;
}

// Chaque cellule est une chaîne/un nombre, ou `{ strong: valeur }` pour le gras.
export function appendRows(tbody: HTMLElement, rows: Cell[][]): void {
  for (const cells of rows) {
    const tr = document.createElement("tr");
    for (const cell of cells) {
      const td = document.createElement("td");
      if (typeof cell === "object") {
        const strong = document.createElement("strong");
        strong.textContent = String(cell.strong);
        td.appendChild(strong);
      } else {
        td.textContent = String(cell);
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
