import { showScreen, updateResumeButton } from "./screens.js";
import { players, selectedVariants } from "./players.js";
import { getVariantIcon, SAVED_GAME_KEY } from "./utils.js";
import { saveBestAndWorstScores } from "./hallOfFame.js";

let currentPlayerIndex = 0;
let autoAdvanceTimeout;

const scoreTablesContainer = document.getElementById("score-tables");
const currentPlayerName = document.getElementById("current-player-name");
const prevPlayerBtn = document.getElementById("prev-player-btn");
const nextPlayerBtn = document.getElementById("next-player-btn");
const firstPodium = document.getElementById("podium-1");
const secondPodium = document.getElementById("podium-2");
const thirdPodium = document.getElementById("podium-3");
const rankingTable = document.getElementById("ranking-table");
const quitBtn = document.getElementById("quit-btn");

const upperSection = {};
for (let i = 1; i <= 6; i++) {
  upperSection[i] = Array.from({ length: 6 }, (_, index) => index * i);
}
upperSection.Bonus = [];
upperSection["Total Haut"] = [];

const lowerSection = {
  "Brelan (Σ)": Array.from({ length: 31 }, (_, i) => i),
  "Full (25)": [0, 25],
  "Carré (40)": [0, 40],
  "Pte Suite (30)": [0, 30],
  "Gde Suite (40)": [0, 40],
  "Chance (Σ)": Array.from({ length: 31 }, (_, i) => i),
  "Yams (50)": [0, 50],
  "Total Bas": [],
};

const totalSection = {
  "Score Final": [],
};

const upperScoringNames = Object.keys(upperSection).filter(
  (k) => upperSection[k].length > 0
);
const lowerScoringNames = Object.keys(lowerSection).filter(
  (k) => lowerSection[k].length > 0
);

export function initGame() {
  prevPlayerBtn.addEventListener("click", () => {
    currentPlayerIndex =
      (currentPlayerIndex - 1 + players.length) % players.length;
    displayCurrentPlayer();
  });

  nextPlayerBtn.addEventListener("click", () => {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    displayCurrentPlayer();
  });

  quitBtn.addEventListener("click", () => {
    saveBestAndWorstScores(players, selectedVariants);
    location.reload();
  });

  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      saveGame();
      showScreen("home");
      updateResumeButton();
    });
  }
}

export function startGame() {
  currentPlayerIndex = 0;
  scoreTablesContainer.innerHTML = "";
  displayCurrentPlayer();
}

function isLineEnabled(lineName, variant, scores) {
  const montanteOrder = [
    ...lowerScoringNames.slice().reverse(),
    ...upperScoringNames.slice().reverse(),
  ];
  const descendanteOrder = [...upperScoringNames, ...lowerScoringNames];

  let order = variant === "Montante" ? montanteOrder : descendanteOrder;

  if (!order.includes(lineName)) return true;

  const index = order.indexOf(lineName);
  if (index === 0) return true;

  const previousLine = order[index - 1];
  return scores[previousLine] !== undefined;
}

function displayCurrentPlayer() {
  const player = players[currentPlayerIndex];
  currentPlayerName.textContent = player.name;
  scoreTablesContainer.innerHTML = "";

  const table = document.createElement("table");
  table.className = "score-table";

  const headerRow = document.createElement("tr");
  headerRow.innerHTML =
    "<th></th>" +
    selectedVariants
      .map((v) => `<th title="${v}">${getVariantIcon(v)}</th>`)
      .join("");
  table.appendChild(headerRow);

  const allSections = [upperSection, lowerSection, totalSection];
  for (const section of allSections) {
    for (const lineName in section) {
      const values = section[lineName];
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.textContent = lineName;
      row.appendChild(nameCell);

      for (const variant of selectedVariants) {
        const cell = document.createElement("td");
        const scores = player.scores[variant];

        if (values.length > 0) {
          const select = document.createElement("select");
          select.innerHTML =
            `<option value="">--</option>` +
            values.map((v) => `<option value="${v}">${v}</option>`).join("");
          select.value = scores[lineName] !== undefined ? scores[lineName] : "";

          const enabled =
            variant === "Montante" || variant === "Descendante"
              ? isLineEnabled(lineName, variant, scores)
              : true;

          select.classList.add("score-select");
          select.disabled = !enabled;
          select.setAttribute("aria-disabled", !enabled);
          if (!enabled) {
            cell.classList.add("disabled-cell");
            select.title = "Remplissez d’abord la ligne précédente.";
          }

          select.addEventListener("change", () => {
            const val = select.value;
            if (val === "") {
              delete scores[lineName];
            } else {
              const num = parseInt(val, 10);
              scores[lineName] = isNaN(num) ? undefined : num;
            }

            updateCalculatedScores(scores);

            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = setTimeout(() => {
              if (!isGameFinished()) {
                nextPlayerBtn.click();
              } else {
                showFinalScreen();
              }
            }, 800);

            displayCurrentPlayer();
          });

          cell.appendChild(select);
        } else {
          const val = calculateSpecialScore(lineName, scores);
          cell.textContent = val;
        }

        row.appendChild(cell);
      }

      table.appendChild(row);

      if (lineName === "Total Haut" || lineName === "Total Bas") {
        const spacerRow = document.createElement("tr");
        spacerRow.classList.add("spacer-row");
        const spacerCell = document.createElement("td");
        spacerCell.colSpan = selectedVariants.length + 1;
        spacerRow.appendChild(spacerCell);
        table.appendChild(spacerRow);
      }
    }
  }

  const wrapper = document.createElement("div");
  wrapper.className = "score-wrapper";
  wrapper.style.backgroundColor = player.color;
  wrapper.appendChild(table);
  scoreTablesContainer.appendChild(wrapper);
}

function calculateSpecialScore(name, scores) {
  if (name === "Bonus") {
    const total = getUpperSum(scores);
    const filled = upperScoringNames.every((k) => scores[k] !== undefined);
    const value = total >= 63 ? 35 : filled ? 0 : `-${63 - total}`;
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
    const value = lowerScoringNames.reduce(
      (sum, k) => sum + (scores[k] || 0),
      0
    );
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

function updateCalculatedScores(scores) {
  calculateSpecialScore("Bonus", scores);
  calculateSpecialScore("Total Haut", scores);
  calculateSpecialScore("Total Bas", scores);
  calculateSpecialScore("Score Final", scores);
}

function getUpperSum(scores) {
  return upperScoringNames.reduce((sum, key) => sum + (scores[key] || 0), 0);
}

function isGameFinished() {
  return players.every((player) =>
    selectedVariants.every((variant) =>
      [...upperScoringNames, ...lowerScoringNames].every(
        (k) => player.scores[variant][k] !== undefined
      )
    )
  );
}

function showFinalScreen() {
  const results = players
    .map((player) => {
      const details = {};
      let total = 0;
      selectedVariants.forEach((variant) => {
        const score = player.scores[variant]["Score Final"] || 0;
        details[variant] = score;
        total += score;
      });
      return { name: player.name, details, total };
    })
    .sort((a, b) => b.total - a.total);

  [firstPodium, secondPodium, thirdPodium].forEach((slot, i) => {
    slot.textContent = results[i]?.name || "";
  });

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["🥇", "Joueur", ...selectedVariants.map(getVariantIcon), "Total"].forEach(
    (h) => {
      const th = document.createElement("th");
      th.textContent = h;
      headerRow.appendChild(th);
    }
  );
  thead.appendChild(headerRow);

  const tbody = document.createElement("tbody");
  results.forEach((r, i) => {
    const row = document.createElement("tr");
    row.innerHTML =
      `<td>${i + 1}.</td><td>${r.name}</td>` +
      selectedVariants.map((v) => `<td>${r.details[v]}</td>`).join("") +
      `<td><strong>${r.total}</strong></td>`;
    tbody.appendChild(row);
  });

  rankingTable.innerHTML = "";
  rankingTable.appendChild(thead);
  rankingTable.appendChild(tbody);

  localStorage.removeItem(SAVED_GAME_KEY);
  showScreen("end");
}

export function saveGame() {
  const state = {
    players,
    selectedVariants,
    currentPlayerIndex,
  };
  localStorage.setItem(SAVED_GAME_KEY, JSON.stringify(state));
}

export function resumeGame(savedPlayers, savedVariants, savedIndex) {
  players.length = 0;
  players.push(...savedPlayers);

  selectedVariants.length = 0;
  selectedVariants.push(...savedVariants);

  currentPlayerIndex = savedIndex;

  displayCurrentPlayer();
}
