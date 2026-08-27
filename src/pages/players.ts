// Page "Ajouter des joueurs" : manipule le brouillon (noms retenus), puis
// convertit ce brouillon en partie réelle au lancement.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { createPlayers } from "../state";
import { renderList, requireEl } from "../ui";
import { addKnownName, getKnownNames } from "../storage/knownPlayersRepo";
import { getDraft, saveDraft, clearDraft } from "../storage/draftRepo";
import { saveSavedGame } from "../storage/savedGameRepo";

bootstrap();

const draft = getDraft();
if (!draft) {
  goTo("home");
  throw new Error("Aucun brouillon de partie : retour à l'accueil.");
}

const playerForm = requireEl<HTMLFormElement>("player-form");
const playerNameInput = requireEl<HTMLInputElement>("player-name");
const nextPlayersList = requireEl("player-list");
const knownPlayersList = requireEl("known-players-list");
const startGameBtn = requireEl<HTMLButtonElement>("start-game-btn");

playerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = playerNameInput.value.trim();
  playerNameInput.value = "";
  if (!name || draft.playerNames.includes(name)) return;

  draft.playerNames.push(name);
  addKnownName(name);
  persist();
});

requireEl("back-to-variants-btn").addEventListener("click", () => goTo("home"));

startGameBtn.addEventListener("click", () => {
  saveSavedGame({
    players: createPlayers(draft.playerNames, draft.variants),
    selectedVariants: draft.variants,
    currentPlayerIndex: 0,
  });
  clearDraft();
  goTo("game");
});

function persist(): void {
  saveDraft(draft!);
  render();
}

function render(): void {
  renderList(nextPlayersList, draft!.playerNames, (name, index) => {
    const li = document.createElement("li");
    li.textContent = name;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✖";
    removeBtn.className = "remove-player";
    removeBtn.addEventListener("click", () => {
      draft!.playerNames.splice(index, 1);
      persist();
    });

    li.appendChild(removeBtn);
    return li;
  });

  renderList(knownPlayersList, getKnownNames(), (name) => {
    const li = document.createElement("li");
    li.textContent = name;

    const addBtn = document.createElement("button");
    addBtn.textContent = "+";
    addBtn.addEventListener("click", () => {
      if (draft!.playerNames.includes(name)) return;
      draft!.playerNames.push(name);
      persist();
    });

    li.appendChild(addBtn);
    return li;
  });

  startGameBtn.disabled = draft!.playerNames.length < 2;
}

render();
