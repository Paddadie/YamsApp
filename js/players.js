import { screensId, showScreen } from "./screens.js";

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

export function initPlayers() {
  const startBtn = document.getElementById("start-btn");
  const startGameBtn = document.getElementById("start-game-btn");
  const playerForm = document.getElementById("player-form");
  const playerNameInput = document.getElementById("player-name");
  const playerList = document.getElementById("player-list");
  const variantCheckboxes = document.querySelectorAll("input[name='variant']");

  startBtn.addEventListener("click", () => {
    selectedVariants = Array.from(variantCheckboxes)
        .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    if (selectedVariants.length === 0) {
      alert("Veuillez sélectionner au moins une variante.");
      return;
    }

    localStorage.removeItem("yams-saved-game");
    showScreen("players");
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
    updatePlayerList();
    playerNameInput.value = "";
    startGameBtn.disabled = players.length < 2;
  });

  startGameBtn.addEventListener("click", () => {
    showScreen("game");
    import("./scores.js").then((module) => {
      module.startGame(players, selectedVariants);
    });
  });

  function updatePlayerList() {
    playerList.innerHTML = "";
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
}
