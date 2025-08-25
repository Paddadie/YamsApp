import { loadFromStorage, saveToStorage } from "./storage.js";

const bestTable = document.querySelector("#best-scores-table tbody");
const worstTable = document.querySelector("#worst-scores-table tbody");

let clickCount = 0;
let lastClickTime = 0;

export function initHallOfFame() {
  setupHallOfFameResetListener();
}

export function showHallOfFame() {
  const best = loadFromStorage("bestScores");
  const worst = loadFromStorage("worstScores");

  bestTable.innerHTML = "";
  worstTable.innerHTML = "";

  best.forEach((e, i) => {
    const row = `<tr><td>${i + 1}.</td><td>${e.name}</td><td>${
      e.date
    }</td><td><strong>${e.score}</strong></td></tr>`;
    bestTable.innerHTML += row;
  });

  worst.forEach((e, i) => {
    const row = `<tr><td>${i + 1}.</td><td>${e.name}</td><td>${
      e.date
    }</td><td><strong>${e.score}</strong></td></tr>`;
    worstTable.innerHTML += row;
  });
}

export function saveBestAndWorstScores(players, variants) {
  const best = loadFromStorage("bestScores");
  const worst = loadFromStorage("worstScores");
  const date = new Date().toLocaleDateString("fr-FR");

  const gameScores = [];
  players.forEach((player) => {
    variants.forEach((variant) => {
      const score = player.scores?.[variant]?.["Score Final"];
      if (typeof score === "number") {
        gameScores.push({ name: player.name, score, date });
      }
    });
  });

  const allScores = [...best, ...worst, ...gameScores];
  const allScoresUnique = removeDuplicates(allScores);

  saveToStorage(
    "bestScores",
    [...allScoresUnique].sort((a, b) => b.score - a.score).slice(0, 5)
  );
  saveToStorage(
    "worstScores",
    [...allScoresUnique].sort((a, b) => a.score - b.score).slice(0, 5)
  );
}

function removeDuplicates(scores) {
  const seen = new Set();
  return scores.filter((s) => {
    const key = `${s.name}-${s.score}-${s.date}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function setupHallOfFameResetListener() {
  const trophy = document.getElementById("reset-trophy");
  if (trophy) {
    trophy.addEventListener("click", () => {
      const now = Date.now();
      if (now - lastClickTime < 700) {
        clickCount++;
      } else {
        clickCount = 1;
      }
      lastClickTime = now;

      if (clickCount >= 15) {
        localStorage.removeItem("bestScores");
        localStorage.removeItem("worstScores");
        showHallOfFame();
        clickCount = 0;
      }
    });
  }
}
