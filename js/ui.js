// Petits helpers de rendu DOM partagés par les écrans.

// Remplace le contenu d'une <ul>, en gardant le <li class="empty-placeholder">.
// `buildItem(item, index)` doit renvoyer un <li>.
export function renderList(ul, items, buildItem) {
  ul.querySelectorAll("li:not(.empty-placeholder)").forEach((li) => li.remove());
  items.forEach((item, index) => ul.appendChild(buildItem(item, index)));
}

// Ajoute des lignes à un <tbody>. Chaque cellule est une chaîne, ou
// `{ strong: valeur }` pour la mettre en gras.
export function appendRows(tbody, rows) {
  for (const cells of rows) {
    const tr = document.createElement("tr");
    for (const cell of cells) {
      const td = document.createElement("td");
      if (cell && typeof cell === "object" && "strong" in cell) {
        const strong = document.createElement("strong");
        strong.textContent = cell.strong;
        td.appendChild(strong);
      } else {
        td.textContent = cell;
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

// Reconstruit entièrement une <table> à partir d'en-têtes et de lignes.
export function renderTable(table, headers, rows) {
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
