// Petits helpers de rendu DOM partagés par les écrans.

type Cell = string | number | { strong: string | number };

// Récupère un élément par id, en échouant clairement s'il est absent du HTML.
export function requireEl<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Élément #${id} introuvable`);
  return el as T;
}

// Remplace le contenu d'une <ul>, en gardant le <li class="empty-placeholder">.
// `buildItem(item, index)` doit renvoyer un <li>.
export function renderList<T>(
  ul: HTMLElement,
  items: T[],
  buildItem: (item: T, index: number) => HTMLLIElement,
): void {
  ul.querySelectorAll("li:not(.empty-placeholder)").forEach((li) => li.remove());
  items.forEach((item, index) => ul.appendChild(buildItem(item, index)));
}

// Ajoute des lignes à un <tbody>. Chaque cellule est une chaîne/un nombre,
// ou `{ strong: valeur }` pour la mettre en gras.
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

// Reconstruit entièrement une <table> à partir d'en-têtes et de lignes.
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
