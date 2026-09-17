// Panneau « Joueurs et scores » : renommer ou supprimer un joueur enregistré,
// retirer une entrée des classements du Hall of Fame. Les deux listes se
// tiennent : supprimer un joueur emporte ses scores.

import {
  makeDismissible,
  plural,
  requireEl,
  summaryRow,
  variantBadge,
} from "../../ui";
import { scoreSheetBody } from "../../scoreSheet";
import {
  getBestScores,
  getWorstScores,
  saveBestScores,
  saveWorstScores,
} from "../../storage/hallOfFameRepo";
import {
  getKnownNames,
  removeKnownName,
  renameKnownName,
} from "../../storage/knownPlayersRepo";
import {
  getPlayerStats,
  removePlayerStats,
  renamePlayerStats,
} from "../../storage/playerStatsRepo";
import { getDraft, saveDraft } from "../../storage/draftRepo";
import { getSavedGame, clearSavedGame } from "../../storage/savedGameRepo";
import { compareNames, foldName, sameName } from "../../playerName";
import type { ScoreEntry } from "../../types";

interface ScoreList {
  get: () => ScoreEntry[];
  save: (list: ScoreEntry[]) => void;
}
const deleteDialog = requireEl<HTMLDialogElement>("delete-dialog");
const deleteSummary = requireEl("delete-summary");
const deleteSheet = requireEl<HTMLTableElement>("delete-sheet");
let pendingDelete: { index: number; store: ScoreList } | null = null;

const BEST_STORE: ScoreList = { get: getBestScores, save: saveBestScores };
const WORST_STORE: ScoreList = { get: getWorstScores, save: saveWorstScores };
const SCORE_STORES: ScoreList[] = [BEST_STORE, WORST_STORE];

const playerEditDialog = requireEl<HTMLDialogElement>("player-edit-dialog");
const playerEditInput = requireEl<HTMLInputElement>("player-edit-input");
const playerEditError = requireEl("player-edit-error");
const playerDeleteDialog = requireEl<HTMLDialogElement>("player-delete-dialog");
const playerDeleteSummary = requireEl("player-delete-summary");
let editingPlayer: string | null = null;
let deletingPlayer: string | null = null;

/* ---------- Listes bornées ---------- */
// Au-delà de cinq entrées on n'en montre que cinq : la page se déroulait sinon
// sur plusieurs écrans dès qu'on avait quelques joueurs et un Hall of Fame
// rempli. L'état déplié est retenu par liste — une suppression redessine la
// liste, et sans ça elle se replierait sous les doigts.

const LIST_PREVIEW = 5;
const expandedLists = new Set<string>();

function limitList(list: HTMLElement, listId: string): void {
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

/* ---------- Nettoyage des classements du Hall of Fame ---------- */

function setupScoreAdmin(): void {
  refreshScoreAdmin();

  makeDismissible(deleteDialog, "delete-cancel");
  requireEl("delete-confirm").addEventListener("click", () => {
    if (!pendingDelete) return;
    const { index, store } = pendingDelete;
    store.save(store.get().filter((_, i) => i !== index));
    pendingDelete = null;
    deleteDialog.close();
    refreshScoreAdmin();
  });
}

function refreshScoreAdmin(): void {
  renderScoreAdmin("best-admin", BEST_STORE);
  renderScoreAdmin("worst-admin", WORST_STORE);
}

function renderScoreAdmin(listId: string, store: ScoreList): void {
  const list = requireEl(listId);
  const entries = store.get();
  list.replaceChildren();

  if (entries.length === 0) {
    const li = document.createElement("li");
    li.className = "score-admin-empty";
    li.textContent = "Aucune entrée.";
    list.appendChild(li);
    return;
  }

  entries.forEach((entry, index) => {
    list.appendChild(scoreAdminRow(entry, index, store));
  });
  limitList(list, listId);
}

function scoreAdminRow(
  entry: ScoreEntry,
  index: number,
  store: ScoreList,
): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "score-admin-row";

  const name = document.createElement("span");
  name.className = "score-admin-name";
  name.textContent = entry.name;

  const score = document.createElement("span");
  score.className = "score-admin-score";
  score.textContent = `${entry.score} pts`;

  const date = document.createElement("span");
  date.className = "score-admin-date";
  date.textContent = entry.date;

  const del = document.createElement("button");
  del.type = "button";
  del.className = "score-admin-del";
  del.setAttribute(
    "aria-label",
    `Supprimer ${entry.name}, ${entry.score} points`,
  );
  del.textContent = "🗑️";
  del.addEventListener("click", () => openDeleteDialog(entry, index, store));

  li.append(name, score, date, del);
  return li;
}

// Pop-up récapitulant la partie visée avant de confirmer la suppression.
function openDeleteDialog(
  entry: ScoreEntry,
  index: number,
  store: ScoreList,
): void {
  pendingDelete = { index, store };
  renderDeleteSummary(entry);
  renderDeleteSheet(entry);
  deleteDialog.showModal();
}

function renderDeleteSummary(entry: ScoreEntry): void {
  deleteSummary.replaceChildren();
  summaryRow(deleteSummary, "Joueur", entry.name);
  summaryRow(deleteSummary, "Score", `${entry.score} pts`);
  if (entry.date) summaryRow(deleteSummary, "Date", entry.date);
  // La pastille seule, sans le nom à côté : partout ailleurs dans l'appli la
  // variante se lit à son icône, et son nom reste dans l'infobulle.
  if (entry.variant) {
    summaryRow(deleteSummary, "Variante", variantBadge(entry.variant));
  }
}

// Feuille de score détaillée si l'entrée la porte (parties d'avant : aucune).
function renderDeleteSheet(entry: ScoreEntry): void {
  const body = scoreSheetBody(entry);
  deleteSheet.replaceChildren();
  deleteSheet.hidden = body === null;
  if (body) deleteSheet.appendChild(body);
}

/* ---------- Renommage / suppression des joueurs enregistrés ---------- */

function setupPlayerAdmin(): void {
  renderPlayerAdmin();

  makeDismissible(playerEditDialog, "player-edit-cancel");
  playerEditInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      savePlayerEdit();
    }
  });
  requireEl("player-edit-save").addEventListener("click", savePlayerEdit);

  makeDismissible(playerDeleteDialog, "player-delete-cancel");
  requireEl("player-delete-confirm").addEventListener("click", () => {
    if (deletingPlayer === null) return;
    purgePlayer(deletingPlayer);
    deletingPlayer = null;
    playerDeleteDialog.close();
    renderPlayerAdmin();
    refreshScoreAdmin();
  });
}

// Tous les noms qui laissent une trace quelque part : joueurs connus,
// statistiques, Hall of Fame, brouillon de partie, partie en cours. Sert à
// pouvoir supprimer un reliquat même s'il ne figure plus dans la liste des
// joueurs connus.
function allPlayerNames(): string[] {
  const seen = new Map<string, string>(); // fold -> forme d'affichage
  const add = (raw: string): void => {
    const name = raw.trim();
    if (name && !seen.has(foldName(name))) seen.set(foldName(name), name);
  };
  getKnownNames().forEach(add);
  Object.keys(getPlayerStats()).forEach(add);
  for (const store of SCORE_STORES) store.get().forEach((e) => add(e.name));
  getDraft()?.playerNames.forEach(add);
  getSavedGame()?.players.forEach((p) => add(p.name));
  return [...seen.values()].sort(compareNames);
}

function statFor(name: string, stats = getPlayerStats()) {
  return Object.entries(stats).find(([k]) => sameName(k, name))?.[1];
}

// Efface toute trace du joueur : nom connu, stats, Hall of Fame, brouillon,
// et la partie en cours si elle l'inclut (elle est alors abandonnée).
function purgePlayer(name: string): void {
  removeKnownName(name);
  removePlayerStats(name);
  removeFromScores(name);
  removeFromDraft(name);
  clearGameIfContains(name);
}

function removeFromDraft(name: string): void {
  const draft = getDraft();
  if (!draft) return;
  const kept = draft.playerNames.filter((n) => !sameName(n, name));
  if (kept.length !== draft.playerNames.length) {
    saveDraft({ ...draft, playerNames: kept });
  }
}

function clearGameIfContains(name: string): void {
  const game = getSavedGame();
  if (game?.players.some((p) => sameName(p.name, name))) clearSavedGame();
}

function renderPlayerAdmin(): void {
  const list = requireEl("players-admin");
  const names = allPlayerNames();
  list.replaceChildren();

  if (names.length === 0) {
    const li = document.createElement("li");
    li.className = "score-admin-empty";
    li.textContent = "Aucun joueur.";
    list.appendChild(li);
    return;
  }

  // Stats lues une seule fois : statFor() ferait sinon un parse JSON par ligne.
  const stats = getPlayerStats();
  for (const name of names) {
    list.appendChild(playerAdminRow(name, statFor(name, stats)?.games ?? 0));
  }
  limitList(list, "players-admin");
}

function playerAdminRow(name: string, games: number): HTMLLIElement {
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
  edit.addEventListener("click", () => openPlayerEdit(name));

  const del = document.createElement("button");
  del.type = "button";
  del.className = "score-admin-del";
  del.setAttribute("aria-label", `Supprimer ${name}`);
  del.textContent = "🗑️";
  del.addEventListener("click", () => openPlayerDelete(name));

  li.append(nameEl, gamesEl, edit, del);
  return li;
}

function openPlayerEdit(name: string): void {
  editingPlayer = name;
  playerEditInput.value = name;
  playerEditError.hidden = true;
  playerEditDialog.showModal();
  playerEditInput.focus();
  playerEditInput.select();
}

// Renomme dans les trois endroits qui portent le nom : liste des joueurs
// connus, statistiques, et entrées du Hall of Fame.
function savePlayerEdit(): void {
  if (editingPlayer === null) return;
  const next = playerEditInput.value.trim();
  if (!next || next === editingPlayer) {
    playerEditDialog.close();
    return;
  }
  if (!renameKnownName(editingPlayer, next)) {
    playerEditError.hidden = false;
    return;
  }
  renamePlayerStats(editingPlayer, next);
  renameInScores(editingPlayer, next);
  editingPlayer = null;
  playerEditDialog.close();
  renderPlayerAdmin();
  refreshScoreAdmin();
}

// Renomme les entrées du Hall of Fame portant ce nom (casse / espaces ignorés).
function renameInScores(from: string, to: string): void {
  for (const store of SCORE_STORES) {
    let changed = false;
    const updated = store.get().map((entry) => {
      if (!sameName(entry.name, from)) return entry;
      changed = true;
      return { ...entry, name: to };
    });
    if (changed) store.save(updated);
  }
}

// Retire toutes les entrées du Hall of Fame portant ce nom.
function removeFromScores(name: string): void {
  for (const store of SCORE_STORES) {
    const list = store.get();
    const kept = list.filter((entry) => !sameName(entry.name, name));
    if (kept.length !== list.length) store.save(kept);
  }
}

function openPlayerDelete(name: string): void {
  deletingPlayer = name;
  const stat = statFor(name);
  const hofCount = SCORE_STORES.reduce(
    (n, store) => n + store.get().filter((e) => sameName(e.name, name)).length,
    0,
  );
  const inGame = !!getSavedGame()?.players.some((p) => sameName(p.name, name));

  playerDeleteSummary.replaceChildren();
  summaryRow(playerDeleteSummary, "Joueur", name);
  summaryRow(playerDeleteSummary, "Parties jouées", String(stat?.games ?? 0));
  const avg =
    stat && stat.classiqueGames > 0
      ? String(Math.round(stat.classiquePoints / stat.classiqueGames))
      : "—";
  summaryRow(playerDeleteSummary, "Moyenne classique", avg);
  summaryRow(playerDeleteSummary, "Entrées Hall of Fame", String(hofCount));
  if (inGame) {
    summaryRow(playerDeleteSummary, "Partie en cours", "sera abandonnée");
  }
  playerDeleteDialog.showModal();
}

/* ---------- Mise en route du panneau ---------- */

export function setupDataPanel(): void {
  setupScoreAdmin();
  setupPlayerAdmin();
}
