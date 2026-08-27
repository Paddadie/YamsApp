// Écran "Ajouter des joueurs" : saisie, joueurs connus, liste de la prochaine partie.

import { game, addPlayer, removePlayer } from "../state";
import { addKnownName, getKnownNames } from "../storage/knownPlayersRepo";
import { showScreen } from "../navigation";
import { startGame } from "./game";
import { renderList, requireEl } from "../ui";
import type { Player } from "../types";

const playerForm = requireEl<HTMLFormElement>("player-form");
const playerNameInput = requireEl<HTMLInputElement>("player-name");
const nextPlayersList = requireEl("player-list");
const knownPlayersList = requireEl("known-players-list");
const startGameBtn = requireEl<HTMLButtonElement>("start-game-btn");

export function initPlayers(): void {
  playerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = playerNameInput.value.trim();
    if (!name) return;

    if (addPlayer(name)) {
      addKnownName(name);
      renderNextPlayers();
    }
    playerNameInput.value = "";
  });

  requireEl("back-to-variants-btn").addEventListener("click", () =>
    showScreen("home"),
  );

  startGameBtn.addEventListener("click", () => {
    showScreen("game");
    startGame();
  });
}

function syncStartButton(): void {
  startGameBtn.disabled = game.players.length < 2;
}

function renderNextPlayers(): void {
  renderList<Player>(nextPlayersList, game.players, (player, index) => {
    const li = document.createElement("li");
    li.textContent = player.name;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✖";
    removeBtn.className = "remove-player";
    removeBtn.addEventListener("click", () => {
      removePlayer(index);
      renderNextPlayers();
    });

    li.appendChild(removeBtn);
    return li;
  });
  syncStartButton();
}

export function renderKnownPlayers(): void {
  renderList<string>(knownPlayersList, getKnownNames(), (name) => {
    const li = document.createElement("li");
    li.textContent = name;

    const addBtn = document.createElement("button");
    addBtn.textContent = "+";
    addBtn.addEventListener("click", () => {
      if (addPlayer(name)) renderNextPlayers();
    });

    li.appendChild(addBtn);
    return li;
  });
}
