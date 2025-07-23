import { loadFromStorage, saveToStorage } from './storage.js';

const bestTable = document.querySelector("#best-scores-table tbody");
const worstTable = document.querySelector("#worst-scores-table tbody");

export function initHallOfFame() {
  // Nothing needed for now
}

export function showHallOfFame() {
  const best = loadFromStorage("bestScores");
  const worst = loadFromStorage("worstScores");

  bestTable.innerHTML = "";
  worstTable.innerHTML = "";

  best.forEach((e, i) => {
    const row = `<tr><td>${i + 1}.</td><td>${e.name}</td><td>${e.date}</td><td><strong>${e.score}</strong></td></tr>`;
    bestTable.innerHTML += row;
  });

  worst.forEach((e, i) => {
    const row = `<tr><td>${i + 1}.</td><td>${e.name}</td><td>${e.date}</td><td><strong>${e.score}</strong></td></tr>`;
    worstTable.innerHTML += row;
  });
}

export function saveBestAndWorstScores(players, variants) {
  const best = loadFromStorage("bestScores");
  const worst = loadFromStorage("worstScores");
  const date = new Date().toLocaleDateString("fr-FR");

  const allScores = [];
  players.forEach(player => {
    variants.forEach(variant => {
      const score = player.scores?.[variant]?.["Score Final"];
      if (typeof score === "number") {
        allScores.push({ name: player.name, score, date });
      }
    });
  });

  saveToStorage("bestScores", [...best, ...allScores].sort((a, b) => b.score - a.score).slice(0, 5));
  saveToStorage("worstScores", [...worst, ...allScores].sort((a, b) => a.score - b.score).slice(0, 5));
}
