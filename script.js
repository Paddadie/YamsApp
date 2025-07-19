// === Variables globales ===
let players = [];
let currentPlayerIndex = 0;
let autoAdvanceTimeout;
let selectedVariants = [];

const upperSection = { "1": [0, 1, 2, 3, 4, 5], "2": [0, 2, 4, 6, 8, 10], "3": [0, 3, 6, 9, 12, 15], "4": [0, 4, 8, 12, 16, 20], "5": [0, 5, 10, 15, 20, 25], "6": [0, 6, 12, 18, 24, 30], "Bonus": [], "Total Haut": [] };
const lowerSection = {
  "Brelan (Σ)": Array.from({ length: 31 }, (_, i) => i),
  "Full (25)": [0, 25],
  "Carré (40)": [0, 40],
  "Pte Suite (30)": [0, 30],
  "Gde Suite (40)": [0, 40],
  "Chance (Σ)": Array.from({ length: 31 }, (_, i) => i),
  "Yams (50)": [0, 50],
  "Total Bas": []
};
const totalSection = { "Score Final": [] };

const getScoringKeys = section => Object.keys(section).filter(k => section[k].length > 0);
const upperScoringNames = getScoringKeys(upperSection);
const lowerScoringNames = getScoringKeys(lowerSection);

// === DOM Elements ===
const screens = {
  home: document.getElementById("home-screen"),
  players: document.getElementById("players-screen"),
  game: document.getElementById("game-screen"),
  end: document.getElementById("end-screen")
};
const startBtn = document.getElementById("start-btn");
const startGameBtn = document.getElementById("start-game-btn");
const playerForm = document.getElementById("player-form");
const playerNameInput = document.getElementById("player-name");
const playerList = document.getElementById("player-list");
const currentPlayerName = document.getElementById("current-player-name");
const prevPlayerBtn = document.getElementById("prev-player-btn");
const nextPlayerBtn = document.getElementById("next-player-btn");
const scoreTablesContainer = document.getElementById("score-tables");
const variantCheckboxes = document.querySelectorAll("input[name='variant']");
const firstPodium = document.getElementById("podium-1");
const secondPodium = document.getElementById("podium-2");
const thirdPodium = document.getElementById("podium-3");

// === Navigation ===
function switchScreen(from, to) {
  from.classList.remove("active");
  to.classList.add("active");
}

startBtn.addEventListener("click", () => {
  selectedVariants = Array.from(variantCheckboxes)
    .filter(checkbox => checkbox.checked)
    .map(cb => cb.value);

  if (selectedVariants.length === 0) {
    alert("Veuillez sélectionner au moins une variante.");
    return;
  }
  screens.home.style.display = 'none';
  switchScreen(screens.home, screens.players);
});

playerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = playerNameInput.value.trim();
  if (name) {
    const scores = {};
    for (const variant of selectedVariants) {
      scores[variant] = {};
    }
    players.push({ name, scores });
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

  const table = document.createElement("table");
  table.className = "score-table";

  const sectionOrder = [upperSection, lowerSection, totalSection];
  const allSections = sectionOrder.map(section => Object.keys(section));

  // En-tête
  const headerRow = document.createElement("tr");
  const firstCell = document.createElement("th");
  headerRow.appendChild(firstCell);

  const getVariantIcon = (variant) => {
    switch (variant) {
      case "Classique": return "🎲";
      case "Montante": return "⬆️";
      case "Descendante": return "⬇️";
      case "One Shot": return "🎯";
      default: return variant;
    }
  };

  selectedVariants.forEach(variant => {
    const th = document.createElement("th");
    th.textContent = getVariantIcon(variant);
    th.title = variant;
    headerRow.appendChild(th);
  });

  table.appendChild(headerRow);

  // Parcours des sections
  for (let s = 0; s < allSections.length; s++) {
    const sectionLines = allSections[s];

    for (const lineName of sectionLines) {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.textContent = lineName;
      row.appendChild(nameCell);

      for (const variant of selectedVariants) {
        const cell = document.createElement("td");
        const scores = player.scores[variant];
        const values = (upperSection[lineName] || lowerSection[lineName] || totalSection[lineName] || []);

        if (values.length > 0) {
          const select = document.createElement("select");
          select.className = "score-select";
          select.innerHTML = `<option value="">--</option>` + values.map(v => `<option value="${v}">${v}</option>`).join("");
          if (scores[lineName] !== undefined) {
            select.value = scores[lineName];
          }
          select.addEventListener("change", () => {
            if (select.value === "") delete scores[lineName];
            else scores[lineName] = parseInt(select.value);

            updateCalculatedScores(scores);

            if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = setTimeout(() => {
              if (!isGameFinished()) nextPlayerBtn.click();
              else showFinalScreen();
            }, 800);
          });
          cell.appendChild(select);
        } else {
          const val = calculateSpecialScore(lineName, scores);
          cell.textContent = val;
        }

        row.appendChild(cell);
      }

      table.appendChild(row);
    }

    // Ligne vide de séparation (entre les sections, sauf la dernière)
    if (s < allSections.length - 1) {
      const spacerRow = document.createElement("tr");
      spacerRow.style.border = "none";

      const emptyTd = document.createElement("td");
      emptyTd.colSpan = selectedVariants.length + 1;
      emptyTd.style.border = "none";
      emptyTd.style.height = "1em";

      spacerRow.appendChild(emptyTd);
      table.appendChild(spacerRow);
    }
  }

  scoreTablesContainer.appendChild(table);
}

function generateScoreTableForVariant(player, variant) {
  const sectionOrder = [upperSection, lowerSection, totalSection];
  const scores = player.scores[variant];

  for (const section of sectionOrder) {
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
        if (scores[lineName] !== undefined) {
          select.value = scores[lineName];
        }
        select.addEventListener("change", () => {
          if (select.value === "") delete scores[lineName];
          else scores[lineName] = parseInt(select.value);

          updateCalculatedScores(scores);

          if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);
          autoAdvanceTimeout = setTimeout(() => {
            if (!isGameFinished()) nextPlayerBtn.click();
            else showFinalScreen();
          }, 800);
        });
        scoreCell.appendChild(select);
      } else {
        const val = calculateSpecialScore(lineName, scores);
        scoreCell.textContent = val;
      }

      row.appendChild(nameCell);
      row.appendChild(scoreCell);
      table.appendChild(row);
    }
    scoreTablesContainer.appendChild(table);
  }
}

function calculateSpecialScore(name, scores) {
  if (name === "Bonus") {
    const total = getUpperSum(scores);
    const filled = upperScoringNames.every(k => scores[k] !== undefined);
    const value = total >= 63 ? 35 : (filled ? 0 : `-${63 - total}`);
    if (typeof value === "number") scores["Bonus"] = value;
    return value;
  }
  if (name === "Total Haut") {
    const bonus = calculateSpecialScore("Bonus", scores);
    const value = getUpperSum(scores) + (typeof bonus === "number" ? bonus : 0);
    scores["Total Haut"] = value;
    return value;
  }
  if (name === "Total Bas") {
    const value = lowerScoringNames.reduce((sum, k) => sum + (scores[k] || 0), 0);
    scores["Total Bas"] = value;
    return value;
  }
  if (name === "Score Final") {
    const haut = calculateSpecialScore("Total Haut", scores);
    const bas = calculateSpecialScore("Total Bas", scores);
    const value = haut + bas;
    scores["Score Final"] = value;
    return value;
  }
  return "";
}

function getUpperSum(scores) {
  return upperScoringNames.reduce((sum, key) => sum + (scores[key] || 0), 0);
}

function updateCalculatedScores(scores) {
  calculateSpecialScore("Bonus", scores);
  calculateSpecialScore("Total Haut", scores);
  calculateSpecialScore("Total Bas", scores);
  calculateSpecialScore("Score Final", scores);
}

function isGameFinished() {
  return players.every(player => selectedVariants.every(variant => {
    const scores = player.scores[variant];
    const required = [...upperScoringNames, ...lowerScoringNames];
    return required.every(k => scores[k] !== undefined);
  }));
}

function showFinalScreen() {
  const results = players.map(player => {
    let total = 0;
    selectedVariants.forEach(variant => {
      total += player.scores[variant]["Score Final"] || 0;
    });
    return { name: player.name, total };
  }).sort((a, b) => b.total - a.total);

  [firstPodium, secondPodium, thirdPodium].forEach((slot, i) => {
    slot.textContent = results[i]?.name || "";
  });

  const tableBody = document.querySelector("#ranking-table tbody");
  tableBody.innerHTML = "";
  results.forEach((p, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${i + 1}.</td><td>${p.name}</td><td>${p.total} pts</td>`;
    tableBody.appendChild(row);
  });
  switchScreen(screens.game, screens.end);
}