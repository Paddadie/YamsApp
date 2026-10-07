// Joueurs enregistrés, dans le panneau « Joueurs et scores » : renommer ou
// supprimer un joueur. Le travail lui-même est fait par games/playerAdmin, qui
// passe partout où le joueur laisse une trace ; ce module ne fait que l'écran.
//
// Ce module est évalué à l'import, donc AVANT le corps de settings.ts, donc
// avant bootstrap() : il ne lit rien du stockage à son niveau module, tout est
// dans setupPlayersAdmin().

import {
  makeDismissible,
  plural,
  requireEl,
  summaryRow,
} from "../../core/ui";
import { gamesPlayed, getPlayerGames } from "../../core/storage/playerGamesRepo";
import { GAMES } from "../../games/registry";
import {
  allPlayerNames,
  removePlayer,
  renamePlayer,
} from "../../games/playerAdmin";
import { SCORES_CHANGED, emptyItem, limitList } from "./adminList";

let editingPlayer: string | null = null;
let deletingPlayer: string | null = null;

// Les listes des jeux (Hall of Fame, records) se redessinent sur ce signal.
function refreshAll(): void {
  render();
  document.dispatchEvent(new Event(SCORES_CHANGED));
}

function render(): void {
  const list = requireEl("players-admin");
  const names = allPlayerNames();
  list.replaceChildren();

  if (names.length === 0) {
    list.appendChild(emptyItem("Aucun joueur."));
    return;
  }

  // Lues une seule fois : sinon un parse JSON par ligne de la liste.
  const games = getPlayerGames();
  for (const name of names) {
    list.appendChild(playerRow(name, gamesPlayed(games, name)));
  }
  limitList(list, "players-admin");
}

function playerRow(name: string, games: number): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "score-admin-row";

  const nameEl = document.createElement("span");
  nameEl.className = "score-admin-name";
  nameEl.textContent = name;

  const gamesEl = document.createElement("span");
  gamesEl.className = "score-admin-games";
  gamesEl.textContent = games === 0 ? "jamais joué" : plural(games, "partie");

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "score-admin-edit";
  edit.setAttribute("aria-label", `Modifier le nom de ${name}`);
  edit.textContent = "✏️";
  edit.addEventListener("click", () => openEdit(name));

  const del = document.createElement("button");
  del.type = "button";
  del.className = "score-admin-del";
  del.setAttribute("aria-label", `Supprimer ${name}`);
  del.textContent = "🗑️";
  del.addEventListener("click", () => openDelete(name));

  li.append(nameEl, gamesEl, edit, del);
  return li;
}

/* ---------- Renommer ---------- */

function openEdit(name: string): void {
  editingPlayer = name;
  const input = requireEl<HTMLInputElement>("player-edit-input");
  input.value = name;
  requireEl("player-edit-error").hidden = true;
  requireEl<HTMLDialogElement>("player-edit-dialog").showModal();
  input.focus();
  input.select();
}

function saveEdit(): void {
  if (editingPlayer === null) return;
  const dialog = requireEl<HTMLDialogElement>("player-edit-dialog");
  const next = requireEl<HTMLInputElement>("player-edit-input").value.trim();
  if (!next || next === editingPlayer) {
    dialog.close();
    return;
  }
  if (!renamePlayer(editingPlayer, next)) {
    requireEl("player-edit-error").hidden = false;
    return;
  }
  editingPlayer = null;
  dialog.close();
  refreshAll();
}

/* ---------- Supprimer ---------- */

// Le récapitulatif dit ce que chaque jeu perdrait : c'est le jeu qui le sait.
function openDelete(name: string): void {
  deletingPlayer = name;
  const summary = requireEl("player-delete-summary");
  summary.replaceChildren();
  summaryRow(summary, "Joueur", name);
  summaryRow(summary, "Parties jouées", String(gamesPlayed(getPlayerGames(), name)));
  for (const game of GAMES) {
    for (const { term, value } of game.describePlayer(name)) {
      summaryRow(summary, term, value);
    }
  }
  requireEl<HTMLDialogElement>("player-delete-dialog").showModal();
}

function confirmDelete(): void {
  if (deletingPlayer === null) return;
  removePlayer(deletingPlayer);
  deletingPlayer = null;
  requireEl<HTMLDialogElement>("player-delete-dialog").close();
  refreshAll();
}

/* ---------- Mise en route ---------- */

export function setupPlayersAdmin(): void {
  render();

  makeDismissible(
    requireEl<HTMLDialogElement>("player-edit-dialog"),
    "player-edit-cancel",
  );
  requireEl("player-edit-input").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    saveEdit();
  });
  requireEl("player-edit-save").addEventListener("click", saveEdit);

  makeDismissible(
    requireEl<HTMLDialogElement>("player-delete-dialog"),
    "player-delete-cancel",
  );
  requireEl("player-delete-confirm").addEventListener("click", confirmDelete);
}
