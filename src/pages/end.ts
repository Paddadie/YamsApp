// Page de fin de partie : podium et classement, indication de l'impact sur le
// Hall of Fame, puis enregistrement quand l'utilisateur quitte.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { game, hydrateGame } from "../state";
import { getVariantIcon } from "../variants";
import { renderTable, requireEl } from "../ui";
import { getSavedGame, clearSavedGame } from "../storage/savedGameRepo";
import { clearDraft } from "../storage/draftRepo";
import { recordGameResult } from "../storage/playerStatsRepo";
import { buildGrid } from "../scoring";
import {
  previewHallOfFame,
  saveBestAndWorstScores,
  type HallOfFamePreview,
} from "../hallOfFame";
import type { Variant } from "../types";

const MEDALS = ["🥇", "🥈", "🥉"];
const BEST_BADGE = "🏆";
const WORST_BADGE = "💩";

bootstrap();

const saved = getSavedGame();
if (!saved) {
  goTo("home");
  throw new Error("Aucune partie terminée à afficher : retour à l'accueil.");
}
hydrateGame(saved);

const grid = buildGrid(game.rules);

// L'impact sur le Hall of Fame se calcule AVANT d'y écrire quoi que ce soit.
const preview = previewHallOfFame(game.players, game.variants);

// La partie sauvegardée n'est effacée qu'au clic sur « Quitter » : ainsi un
// rafraîchissement de cette page réaffiche le podium au lieu de tout perdre.

const podium = requireEl("podium");
const rankingTable = requireEl<HTMLTableElement>("ranking-table");

interface Result {
  name: string;
  details: Record<Variant, number>;
  total: number;
}

const results = computeResults();

requireEl("quit-btn").addEventListener("click", () => {
  saveBestAndWorstScores(game.players, game.variants, grid);
  recordGameResult(results.map((r) => ({ name: r.name, total: r.total })));
  clearSavedGame();
  clearDraft();
  goTo("home");
});

renderPodium(results);
renderRecordBanner();
renderRanking(results);
renderLegend();

function computeResults(): Result[] {
  return game.players
    .map((player) => {
      const details = {} as Record<Variant, number>;
      let total = 0;
      for (const variant of game.variants) {
        const score = player.scores[variant]["Score Final"] || 0;
        details[variant] = score;
        total += score;
      }
      return { name: player.name, details, total };
    })
    .sort((a, b) => b.total - a.total);
}

function renderRanking(results: Result[]): void {
  const headers = ["", "Joueur", ...game.variants.map(getVariantIcon), "Total"];
  const rows = results.map((r, i) => [
    MEDALS[i] ?? `${i + 1}`,
    r.name,
    ...game.variants.map((v) => cellWithBadge(r.details[v], preview.impactFor(r.name, v))),
    { strong: r.total },
  ]);
  renderTable(rankingTable, headers, rows);
}

function cellWithBadge(
  value: number,
  impact: ReturnType<HallOfFamePreview["impactFor"]>,
): string {
  const badge = impact.inBest ? BEST_BADGE : impact.inWorst ? WORST_BADGE : "";
  return badge ? `${value} ${badge}` : `${value}`;
}

function renderRecordBanner(): void {
  const banner = requireEl("record-banner");
  if (!preview.newRecord) return;
  const { name, score, variant } = preview.newRecord;
  banner.textContent = `👑 Nouveau record du téléphone : ${name} — ${score} (${variant})`;
  banner.hidden = false;
}

function renderLegend(): void {
  const legend = requireEl("hof-legend");
  const parts: string[] = [];
  if (preview.entersBest > 0) parts.push(`${BEST_BADGE} entre au Hall of Fame`);
  if (preview.entersWorst > 0) parts.push(`${WORST_BADGE} entre dans les pires scores`);
  if (parts.length === 0) return;
  legend.textContent = parts.join("  ·  ");
  legend.hidden = false;
}

function renderPodium(results: Result[]): void {
  podium.innerHTML = "";
  // Ordre visuel : 2e à gauche, 1er au centre (marche la plus haute), 3e à droite.
  for (const rank of [2, 1, 3]) {
    const result = results[rank - 1];
    if (result) podium.appendChild(buildStep(result, rank));
  }
}

function buildStep(result: Result, rank: number): HTMLElement {
  const step = document.createElement("div");
  step.className = `podium-step rank-${rank}`;

  const medal = document.createElement("span");
  medal.className = "podium-medal";
  medal.textContent = MEDALS[rank - 1];

  const name = document.createElement("span");
  name.className = "podium-name";
  name.textContent = result.name;

  const score = document.createElement("span");
  score.className = "podium-score";
  score.textContent = String(result.total);

  const num = document.createElement("span");
  num.className = "podium-num";
  num.textContent = String(rank);

  step.append(medal, name, score, num);
  return step;
}
