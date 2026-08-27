// Hall of Fame : meilleurs et pires scores, conservés entre les parties.

import {
  getBestScores,
  getWorstScores,
  saveBestScores,
  saveWorstScores,
} from "./storage.js";
import { appendRows } from "./ui.js";

const bestTbody = document.querySelector("#best-scores-table tbody");
const worstTbody = document.querySelector("#worst-scores-table tbody");

export function showHallOfFame() {
  renderScores(bestTbody, getBestScores());
  renderScores(worstTbody, getWorstScores());
}

function renderScores(tbody, entries) {
  tbody.innerHTML = "";
  appendRows(
    tbody,
    entries.map((e, i) => [`${i + 1}.`, e.name, e.date, { strong: e.score }])
  );
}

export function saveBestAndWorstScores(players, variants) {
  const date = new Date().toLocaleDateString("fr-FR");

  const newScores = [];
  for (const player of players) {
    for (const variant of variants) {
      const score = player.scores?.[variant]?.["Score Final"];
      if (typeof score === "number") {
        newScores.push({ name: player.name, score, date });
      }
    }
  }

  const merged = [...getBestScores(), ...newScores];
  saveBestScores(merged.slice().sort((a, b) => b.score - a.score).slice(0, 5));

  const mergedWorst = [...getWorstScores(), ...newScores];
  saveWorstScores(
    mergedWorst.slice().sort((a, b) => a.score - b.score).slice(0, 5)
  );
}
