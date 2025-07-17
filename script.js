const screens = {
  home: document.getElementById("home-screen"),
  players: document.getElementById("players-screen"),
  game: document.getElementById("game-screen"),
};

const startBtn = document.getElementById("start-btn");
const playerForm = document.getElementById("player-form");
const playerNameInput = document.getElementById("player-name");
const playerList = document.getElementById("player-list");
const startGameBtn = document.getElementById("start-game-btn");
const scoreTablesContainer = document.getElementById("score-tables");

const prevPlayerBtn = document.getElementById("prev-player-btn");
const nextPlayerBtn = document.getElementById("next-player-btn");
const currentPlayerName = document.getElementById("current-player-name");

let players = [];
let currentPlayerIndex = 0;

const upperKeys = ["1", "2", "3", "4", "5", "6"];
const lowerKeys = ["Brelan", "Full", "Carré", "Petite Suite", "Grande Suite", "Chance", "Yams"];

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
  Brelan: Array.from({ length: 31 }, (_, i) => i),
  Full: [0, 25],
  Carré: [0, 40],
  "Petite Suite": [0, 30],
  "Grande Suite": [0, 40],
  Chance: Array.from({ length: 31 }, (_, i) => i),
  Yams: [0, 50],
  "Total Bas": [],
};

const finalSection = {
  "Score Final": [],
};

function switchScreen(from, to) {
  from.classList.remove("active");
  to.classList.add("active");
}

startBtn.addEventListener("click", () => {
  screens.home.style.display = "none";
  switchScreen(screens.home, screens.players);
});

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

function displayCurrentPlayer() {
  const player = players[currentPlayerIndex];
  currentPlayerName.textContent = player.name;
  scoreTablesContainer.innerHTML = "";
  generateScoreTables(player);
}

function generateScoreTables(player) {
  const sections = [upperSection, lowerSection, finalSection];
  sections.forEach((section) => {
    const table = document.createElement("table");
    table.className = "score-table";

    for (const lineName in section) {
      const values = section[lineName];
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.textContent = lineName;
      const scoreCell = document.createElement("td");

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
          displayCurrentPlayer();
        });

        scoreCell.appendChild(select);
      } else {
        let value = "";

        // BONUS
        if (lineName === "Bonus") {
          const total = upperKeys.reduce((acc, key) => acc + (player.scores[key] || 0), 0);
          const filled = upperKeys.every(key => player.scores[key] !== undefined);
          if (!filled) {
            value = `Manque ${Math.max(63 - total, 0)} point(s)`;
          } else {
            value = total >= 63 ? 35 : 0;
            player.scores["Bonus"] = value;
          }
        }

        // TOTAL HAUT
        else if (lineName === "Total Haut") {
          const total = upperKeys.reduce((acc, key) => acc + (player.scores[key] || 0), 0);
          const bonus = player.scores["Bonus"] !== undefined ? player.scores["Bonus"] : 0;
          value = total + bonus;
          player.scores["Total Haut"] = value;
        }

        // TOTAL BAS
        else if (lineName === "Total Bas") {
          const totalBas = lowerKeys.reduce((acc, key) => acc + (player.scores[key] || 0), 0);
          value = totalBas;
          player.scores["Total Bas"] = value;
        }

        // SCORE FINAL
        else if (lineName === "Score Final") {
          const haut = player.scores["Total Haut"] || 0;
          const bas = player.scores["Total Bas"] || 0;
          value = haut + bas;
          player.scores["Score Final"] = value;
        }

        scoreCell.textContent = value;
      }

      row.appendChild(nameCell);
      row.appendChild(scoreCell);
      table.appendChild(row);
    }

    scoreTablesContainer.appendChild(table);
  });
}
