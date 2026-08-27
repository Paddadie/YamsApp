// Page "Joueurs de la partie" : une liste unique où chaque joueur connu se
// coche pour rejoindre la partie (ou se décoche pour la quitter). Un champ en
// haut pour créer un nouveau nom. Tri par nombre de parties jouées.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { createPlayers } from "../state";
import { requireEl } from "../ui";
import { addKnownName, getKnownNames } from "../storage/knownPlayersRepo";
import { getGamesPlayed } from "../storage/playerStatsRepo";
import { getDraft, saveDraft, clearDraft } from "../storage/draftRepo";
import { saveSavedGame } from "../storage/savedGameRepo";
import { getRules } from "../storage/rulesRepo";

bootstrap();

const draft = getDraft();
if (!draft) {
  goTo("home");
  throw new Error("Aucun brouillon de partie : retour à l'accueil.");
}
const roster = draft; // alias non-null pour les closures

const playerForm = requireEl<HTMLFormElement>("player-form");
const nameInput = requireEl<HTMLInputElement>("player-name");
const countLine = requireEl("roster-count");
const list = requireEl("roster");
const startBtn = requireEl<HTMLButtonElement>("start-game-btn");

const selected = new Set(roster.playerNames);

playerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  nameInput.value = "";
  nameInput.focus();
  if (!name) return;
  addKnownName(name);
  if (!selected.has(name)) select(name);
  commit();
});

requireEl("back-to-variants-btn").addEventListener("click", () => goTo("home"));

startBtn.addEventListener("click", () => {
  if (roster.playerNames.length < 2) return;
  saveSavedGame({
    players: createPlayers(roster.playerNames, roster.variants),
    selectedVariants: roster.variants,
    currentPlayerIndex: 0,
    rules: getRules(), // règles figées pour toute la partie
  });
  clearDraft();
  goTo("game");
});

render();

function select(name: string): void {
  selected.add(name);
  roster.playerNames.push(name);
}

function deselect(name: string): void {
  selected.delete(name);
  const i = roster.playerNames.indexOf(name);
  if (i >= 0) roster.playerNames.splice(i, 1);
}

function toggle(name: string): void {
  if (selected.has(name)) deselect(name);
  else select(name);
  commit();
}

function commit(): void {
  saveDraft(roster);
  render();
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

function render(): void {
  const games = getGamesPlayed();
  const everyone = [...new Set([...getKnownNames(), ...roster.playerNames])];
  const inGame = roster.playerNames.slice(); // ordre de jeu conservé
  const available = everyone
    .filter((name) => !selected.has(name))
    .sort(
      (a, b) => (games[b] ?? 0) - (games[a] ?? 0) || a.localeCompare(b),
    );

  countLine.textContent =
    inGame.length === 0
      ? "Aucun joueur sélectionné · minimum 2"
      : `${plural(inGame.length, "joueur")} sélectionné${inGame.length > 1 ? "s" : ""} · minimum 2`;

  list.replaceChildren();

  if (everyone.length === 0) {
    const empty = document.createElement("li");
    empty.className = "roster-empty";
    empty.textContent = "Ajoutez un premier joueur ci-dessus.";
    list.appendChild(empty);
  } else {
    for (const name of inGame) {
      list.appendChild(buildRow(name, games[name] ?? 0, true));
    }
    if (inGame.length > 0 && available.length > 0) {
      const divider = document.createElement("li");
      divider.className = "roster-divider";
      divider.textContent = "Autres joueurs enregistrés";
      list.appendChild(divider);
    }
    for (const name of available) {
      list.appendChild(buildRow(name, games[name] ?? 0, false));
    }
  }

  startBtn.disabled = inGame.length < 2;
}

function buildRow(
  name: string,
  gamesPlayed: number,
  isSelected: boolean,
): HTMLLIElement {
  const row = document.createElement("li");
  row.className = isSelected ? "roster-row selected" : "roster-row";
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.setAttribute("aria-pressed", String(isSelected));

  const check = document.createElement("span");
  check.className = "check";
  check.textContent = "✓";
  check.setAttribute("aria-hidden", "true");

  const nameEl = document.createElement("span");
  nameEl.className = "name";
  nameEl.textContent = name;

  const gamesEl = document.createElement("span");
  gamesEl.className = "games";
  gamesEl.textContent =
    gamesPlayed === 0 ? "jamais joué" : plural(gamesPlayed, "partie");

  row.append(check, nameEl, gamesEl);
  row.addEventListener("click", () => toggle(name));
  row.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(name);
    }
  });
  return row;
}
