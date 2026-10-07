// Outils communs aux listes du panneau « Joueurs et scores » : joueurs
// enregistrés, Hall of Fame du Yams, records du 5000.

// Signalé après tout renommage ou suppression de joueur : chaque liste tenue par
// un jeu se redessine dessus, puisque ses entrées ont pu changer de nom ou
// disparaître.
export const SCORES_CHANGED = "scores-changed";

// Ligne « Aucune entrée. » d'une liste vide.
export function emptyItem(text: string): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "score-admin-empty";
  li.textContent = text;
  return li;
}

/* ---------- Listes bornées ---------- */
// Au-delà de cinq entrées on n'en montre que cinq : la page se déroulait sinon
// sur plusieurs écrans dès qu'on avait quelques joueurs et un Hall of Fame
// rempli. L'état déplié est retenu par liste — une suppression redessine la
// liste, et sans ça elle se replierait sous les doigts.

const LIST_PREVIEW = 5;
const expandedLists = new Set<string>();

export function limitList(list: HTMLElement, listId: string): void {
  const rows = [...list.children] as HTMLElement[];
  if (rows.length <= LIST_PREVIEW || expandedLists.has(listId)) return;

  for (const row of rows.slice(LIST_PREVIEW)) row.hidden = true;

  // Le bouton est dans un <li> : un <button> enfant direct d'un <ul> n'est pas
  // du HTML valide, et replaceChildren() le retire au redessin suivant.
  const li = document.createElement("li");
  li.className = "list-more-row";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "list-more";
  button.textContent = `Tout afficher (${rows.length})`;
  button.addEventListener("click", () => {
    expandedLists.add(listId);
    for (const row of rows) row.hidden = false;
    li.remove();
  });
  li.appendChild(button);
  list.appendChild(li);
}
