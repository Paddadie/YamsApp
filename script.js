// === Gestion des écrans ===
const screens = {
  home: document.getElementById("home-screen"),
  players: document.getElementById("players-screen"),
  game: document.getElementById("game-screen"),
  end: document.getElementById("end-screen"),
};

// === Éléments DOM ===
const startBtn = document.getElementById("start-btn");
const playerForm = document.getElementById("player-form");
const playerNameInput = document.getElementById("player-name");
const playerList = document.getElementById("player-list");
const startGameBtn = document.getElementById("start-game-btn");
const scoreTablesContainer = document.getElementById("score-tables");
const prevPlayerBtn = document.getElementById("prev-player-btn");
const nextPlayerBtn = document.getElementById("next-player-btn");
const currentPlayerName = document.getElementById("current-player-name");
const firstPodium = document.getElementById("podium-1");
const secondPodium = document.getElementById("podium-2");
const thirdPodium = document.getElementById("podium-3");

// === Configuration des sections ===
const upperSection = {
  "1": [0, 1, 2, 3, 4, 5],
  "2": [0, 2, 4, 6, 8, 10],
  "3": [0, 3, 6, 9, 12, 15],
  "4": [0, 4, 8, 12, 16, 20],
  "5": [0, 5, 10, 15, 20, 25],
  "6": [0, 6, 12, 18, 24, 30],
  "Bonus": [],
  "Total Haut": [],
};

const lowerSection = {
  "Brelan (Σ)": Array.from({ length: 31 }, (_, i) => i),
  "Full (25)": [0, 25],
  "Carré (40)": [0, 40],
  "Petite Suite (30)": [0, 30],
  "Grande Suite (40)": [0, 40],
  "Chance (Σ)": Array.from({ length: 31 }, (_, i) => i),
  "Yams (50)": [0, 50],
  "Total Bas": [],
};

const totalSection = {
  "Score Final": []
};

// === Noms dynamiques dérivés des sections ===
const getScoringKeys = section => Object.keys(section).filter(k => section[k].length > 0);
const upperScoringNames = getScoringKeys(upperSection);
const lowerScoringNames = getScoringKeys(lowerSection);
const upperSectionNames = Object.keys(upperSection);
const lowerSectionNames = Object.keys(lowerSection);

// === Variables de jeu ===
let players = [];
let currentPlayerIndex = 0;
let autoAdvanceTimeout;

// === Navigation ===
function switchScreen(from, to) {
  from.classList.remove("active");
  to.classList.add("active");
}

startBtn.addEventListener("click", () => {
  screens.home.style.display = 'none';
  switchScreen(screens.home, screens.players);
});

// === Gestion des joueurs ===
playerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = playerNameInput.value.trim();
  if (name) {
    const player = { name, scores: {} };
    players.push(player);
    updatePlayerList();
    playerNameInput.value = "";
    startGameBtn.disabled = players.length < 2;
  }
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

startGameBtn.addEventListener("click", () => {
  switchScreen(screens.players, screens.game);
  currentPlayerIndex = 0;
  displayCurrentPlayer();
});

prevPlayerBtn.addEventListener("click", () => {
  currentPlayerIndex = (currentPlayerIndex - 1 + players.length) % players.length;
  displayCurrentPlayer();
});

nextPlayerBtn.addEventListener("click", () => {
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  displayCurrentPlayer();
});

// === Affichage et gestion des scores ===
function displayCurrentPlayer() {
  const player = players[currentPlayerIndex];
  currentPlayerName.textContent = player.name;
  scoreTablesContainer.innerHTML = "";
  generateScoreTables(player);
}

function generateScoreTables(player) {
  [upperSection, lowerSection, totalSection].forEach(section => {
    const table = document.createElement("table");
    table.className = "score-table";

    for (const lineName in section) {
      const values = section[lineName];
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.textContent = lineName;
      nameCell.style.textAlign = "left";

      const scoreCell = document.createElement("td");
      scoreCell.style.textAlign = "center";

      if (values.length > 0) {
        const select = document.createElement("select");
        select.className = "score-select";
        select.innerHTML = `<option value="">--</option>` + values.map(v => `<option value="${v}">${v}</option>`).join("");

        if (player.scores[lineName] !== undefined) {
          select.value = player.scores[lineName];
        }

        select.addEventListener("change", () => {
          if (select.value === "") {
            delete player.scores[lineName];
          } else {
            player.scores[lineName] = parseInt(select.value, 10);
          }

          updateCalculatedScores(player);

          if (autoAdvanceTimeout) {
            clearTimeout(autoAdvanceTimeout);
          }
          autoAdvanceTimeout = setTimeout(() => {
            checkIfGameFinished();
            if (!isGameFinished()) {
              nextPlayerBtn.click();
            }
          }, 1000);
        });

        scoreCell.appendChild(select);
      } else {
        const val = calculateSpecialScore(lineName, player);
        scoreCell.textContent = val;
      }

      row.appendChild(nameCell);
      row.appendChild(scoreCell);
      table.appendChild(row);
    }

    scoreTablesContainer.appendChild(table);
  });
}

function calculateSpecialScore(name, player) {
  if (name === "Bonus") {
    const total = getUpperSum(player);
    const allFilled = upperScoringNames.every(k => player.scores[k] !== undefined);
    let value;
    if (total >= 63) {
      value = 35;
    } else if (allFilled) {
      value = 0;
    } else {
      value = `Manque ${63 - total} point(s)`;
    }
    if (typeof value === "number") {
      player.scores["Bonus"] = value;
    }
    return value;
  }

  if (name === "Total Haut") {
    const total = getUpperSum(player);
    const bonus = calculateSpecialScore("Bonus", player);
    const value = total + (typeof bonus === "number" ? bonus : 0);
    player.scores["Total Haut"] = value;
    return value;
  }

  if (name === "Total Bas") {
    const value = lowerScoringNames.reduce((sum, k) => sum + (player.scores[k] || 0), 0);
    player.scores["Total Bas"] = value;
    return value;
  }

  if (name === "Score Final") {
    const value = calculateSpecialScore("Total Haut", player) + calculateSpecialScore("Total Bas", player);
    player.scores["Score Final"] = value;
    return value;
  }

  return "";
}

function getUpperSum(player) {
  return upperScoringNames.reduce((sum, key) => sum + (player.scores[key] || 0), 0);
}

function updateCalculatedScores(player) {
  calculateSpecialScore("Bonus", player);
  calculateSpecialScore("Total Haut", player);
  calculateSpecialScore("Total Bas", player);
  calculateSpecialScore("Score Final", player);

  displayCurrentPlayer();
}

function isGameFinished() {
  return players.every(player => {
    const required = [...upperScoringNames, ...lowerScoringNames];
    return required.every(k => player.scores[k] !== undefined);
  });
}

function checkIfGameFinished() {
  if (isGameFinished()) {
    showFinalScreen();
  }
}

// === Écran final et classement ===
function renderPodium(players) {
  const podiumSlots = [firstPodium, secondPodium, thirdPodium];
  podiumSlots.forEach((slot, i) => {
    slot.textContent = players[i] ? players[i].name : "";
  });
}

function renderRanking(players) {
  const tableBody = document.querySelector("#ranking-table tbody");
  tableBody.innerHTML = "";
  players.forEach((p, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${i + 1}.</td>
      <td>${p.name}</td>
      <td>${p.total} pts</td>
    `;
    tableBody.appendChild(row);
  });
}

function showFinalScreen() {
  const results = players.map(player => ({
    name: player.name,
    total: calculateSpecialScore("Score Final", player)
  })).sort((a, b) => b.total - a.total);

  renderPodium(results);
  renderRanking(results);
  switchScreen(screens.game, screens.end);
}