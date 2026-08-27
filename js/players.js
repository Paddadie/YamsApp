// Écran "Ajouter des joueurs" : saisie, joueurs connus, liste de la prochaine partie.

import { game, addPlayer, removePlayer } from "./state.js";
import { addKnownName, getKnownNames } from "./storage.js";
import { showScreen } from "./navigation.js";
import { startGame } from "./game.js";
import { renderList } from "./ui.js";

const playerForm = document.getElementById("player-form");
const playerNameInput = document.getElementById("player-name");
const nextPlayersList = document.getElementById("player-list");
const knownPlayersList = document.getElementById("known-players-list");
const startGameBtn = document.getElementById("start-game-btn");

export function initPlayers() {
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

  document
    .getElementById("back-to-variants-btn")
    .addEventListener("click", () => showScreen("home"));

  startGameBtn.addEventListener("click", () => {
    showScreen("game");
    startGame();
  });
}

function syncStartButton() {
  startGameBtn.disabled = game.players.length < 2;
}

function renderNextPlayers() {
  renderList(nextPlayersList, game.players, (player, index) => {
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

export function renderKnownPlayers() {
  renderList(knownPlayersList, getKnownNames(), (name) => {
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
