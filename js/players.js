import { showScreen } from "./screens.js";
import { SAVED_GAME_KEY, SAVED_NAMES_KEY } from "./utils.js";

export let players = [];
export let selectedVariants = [];

const playerColors = [
  "#FADADD",
  "#AEC6CF",
  "#BFD8B8",
  "#FFFACD",
  "#E6E6FA",
  "#FFDAB9",
  "#AAF0D1",
  "#D8B7DD",
  "#FFBCB3",
  "#C1D3D8",
];

const startBtn = document.getElementById("start-btn");
const startGameBtn = document.getElementById("start-game-btn");
const playerForm = document.getElementById("player-form");
const playerNameInput = document.getElementById("player-name");
const playerList = document.getElementById("player-list");
const variantCheckboxes = document.querySelectorAll("input[name='variant']");
const backToVariantsBtn = document.getElementById("back-to-variants-btn");

export function initPlayers() {
  // TEST
  /*
  if (!localStorage.getItem(SAVED_NAMES_KEY)) {
    const testNames = [
      "Alice",
      "Bruno",
      "Chloé",
      "David",
      "Emma",
      "Félix",
      "Gabriel",
      "Hugo",
      "Inès",
      "Jules",
    ];
    localStorage.setItem(SAVED_NAMES_KEY, JSON.stringify(testNames));
  }
  */
  //TEST

  startBtn.addEventListener("click", () => {
    selectedVariants = Array.from(variantCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    if (selectedVariants.length === 0) {
      alert("Veuillez sélectionner au moins une variante.");
      return;
    }

    localStorage.removeItem(SAVED_GAME_KEY);

    for (const player of players) {
      const newScores = {};
      for (const variant of selectedVariants) {
        newScores[variant] = {};
      }
      player.scores = newScores;
    }

    showScreen("players");
    renderKnownPlayers();
  });

  playerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = playerNameInput.value.trim();
    if (!name) return;

    const color = playerColors[players.length % playerColors.length];
    const scores = {};
    for (const variant of selectedVariants) {
      scores[variant] = {};
    }

    players.push({ name, scores, color });
    saveKnownPlayerName(name);
    updatePlayerList();

    playerNameInput.value = "";
    startGameBtn.disabled = players.length < 2;
  });

  backToVariantsBtn.addEventListener("click", () => {
    showScreen("home");
  });

  startGameBtn.addEventListener("click", () => {
    showScreen("game");
    import("./scores.js").then((module) => {
      module.startGame(players, selectedVariants);
    });
  });
}

function updatePlayerList() {
  const playerList = document.getElementById("player-list");
  const existingItems = playerList.querySelectorAll(
    "li:not(.empty-placeholder)"
  );
  existingItems.forEach((item) => item.remove());

  players.forEach((player, index) => {
    const li = document.createElement("li");
    li.textContent = player.name;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✖";
    removeBtn.className = "remove-player";
    removeBtn.addEventListener("click", () => {
      players.splice(index, 1);
      updatePlayerList();
      startGameBtn.disabled = players.length < 2;
    });

    li.appendChild(removeBtn);
    playerList.appendChild(li);
  });
}

function saveKnownPlayerName(name) {
  const existing = JSON.parse(localStorage.getItem(SAVED_NAMES_KEY)) || [];
  if (!existing.includes(name)) {
    existing.push(name);
    existing.sort((a, b) => a.localeCompare(b));
    localStorage.setItem(SAVED_NAMES_KEY, JSON.stringify(existing));
  }
}

function getKnownPlayerNames() {
  return JSON.parse(localStorage.getItem(SAVED_NAMES_KEY)) || [];
}

function renderKnownPlayers() {
  const knownList = document.getElementById("known-players-list");
  const existingItems = knownList.querySelectorAll(
    "li:not(.empty-placeholder)"
  );
  existingItems.forEach((item) => item.remove());

  const knownNames = getKnownPlayerNames();

  knownNames.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;

    const addBtn = document.createElement("button");
    addBtn.textContent = "+";
    addBtn.addEventListener("click", () => {
      if (players.some((p) => p.name === name)) return;

      const color = playerColors[players.length % playerColors.length];
      const scores = {};
      for (const variant of selectedVariants) {
        scores[variant] = {};
      }

      players.push({ name, scores, color });
      updatePlayerList();
      startGameBtn.disabled = players.length < 2;
    });

    li.appendChild(addBtn);
    knownList.appendChild(li);
  });
}
