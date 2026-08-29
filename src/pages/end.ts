// Page de fin de partie : podium et classement, indication de l'impact sur le
// Hall of Fame, puis enregistrement quand l'utilisateur quitte.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { game, hydrateGame } from "../state";
import { getVariantIcon } from "../variants";
import { MEDALS, renderTable, requireEl, type Cell } from "../ui";
import {
  getSavedGame,
  saveSavedGame,
  clearSavedGame,
} from "../storage/savedGameRepo";
import { clearDraft } from "../storage/draftRepo";
import { recordGameResult } from "../storage/playerStatsRepo";
import { buildGrid, writeDerived, FINAL_SCORE_LINE } from "../scoring";
import {
  impactFor,
  isHallOfFameImpact,
  previewHallOfFame,
  saveBestAndWorstScores,
} from "../hallOfFame";
import type { HallOfFameImpact, Variant } from "../types";

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

// Recalcule bonus/totaux/score final pour chaque feuille : garantit des valeurs
// justes même pour une partie sauvegardée par une ancienne version.
for (const player of game.players) {
  for (const variant of game.variants) {
    writeDerived(player.scores[variant], grid);
  }
}

// L'impact sur le Hall of Fame ne se mesure qu'AVANT d'y écrire : une fois les
// scores versés, les recalculer les comparerait à eux-mêmes (la bannière
// « nouveau record » disparaîtrait notamment). On mémorise donc le résultat
// dans la partie au premier affichage, et on le relit ensuite tel quel.
// Une partie enregistrée par une version antérieure n'a pas ce champ : on
// recalcule alors, faute de mieux.
const impact: HallOfFameImpact = isHallOfFameImpact(saved.hofImpact)
  ? saved.hofImpact
  : previewHallOfFame(game.players, game.variants);

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
const hasClassique = game.variants.includes("Classique");

// Enregistrement dès l'arrivée sur l'écran de fin, pas au clic sur « Quitter » :
// si l'utilisateur ferme l'appli sans quitter, la partie n'est pas perdue.
// `recorded` (posé sur la partie sauvegardée) empêche un double comptage si on
// rafraîchit cette page ou qu'on y revient via « Reprendre ».
if (!saved.recorded) {
  saveBestAndWorstScores(game.players, game.variants, grid);
  // Les statistiques ne comptent que les parties classiques : `classiqueScore`
  // vaut null quand la partie n'incluait pas cette variante (la partie est
  // alors comptée dans `games` mais pas dans la moyenne).
  recordGameResult(
    results.map((r) => ({
      name: r.name,
      classiqueScore: hasClassique ? r.details["Classique"] : null,
    })),
  );
  saveSavedGame({ ...saved, recorded: true, hofImpact: impact });
}

requireEl("quit-btn").addEventListener("click", () => {
  clearSavedGame();
  clearDraft();
  goTo("home");
});

/* ---------- Mise en scène du résultat ---------- */
// Les marches sortent du sol de la dernière vers la première : on garde le
// vainqueur pour la fin. Le classement complet suit, du dernier au premier.
// Séquence jouée une seule fois par partie — c'est le moment fort, il peut se
// permettre de durer, contrairement aux animations du jeu lui-même.

const STEP_DELAYS: Record<number, number> = { 3: 0.08, 2: 0.26, 1: 0.44 };
const STEP_MS = 450;
const RANKING_DELAY = 0.72; // le classement démarre une fois le podium posé
const ROW_STAGGER = 0.07;

renderPodium(results);
renderRanking(results);
revealRanking();
renderRecordBanner();
renderLegend();

function computeResults(): Result[] {
  return game.players
    .map((player) => {
      const details = {} as Record<Variant, number>;
      let total = 0;
      for (const variant of game.variants) {
        const score = player.scores[variant][FINAL_SCORE_LINE] || 0;
        details[variant] = score;
        total += score;
      }
      return { name: player.name, details, total };
    })
    .sort((a, b) => b.total - a.total);
}

function renderRanking(results: Result[]): void {
  // Colonne « Total » seulement à plusieurs variantes : à variante unique elle
  // répète la seule colonne de score. Le classement se fait toujours sur le
  // total (cf. computeResults).
  const multi = game.variants.length > 1;
  const headers = [
    "",
    "Joueur",
    ...game.variants.map(getVariantIcon),
    ...(multi ? ["Total"] : []),
  ];
  const rows = results.map((r, i): Cell[] => [
    MEDALS[i] ?? `${i + 1}`,
    r.name,
    ...game.variants.map((v) =>
      cellWithBadge(r.details[v], impactFor(impact, r.name, v)),
    ),
    ...(multi ? [{ strong: r.total }] : []),
  ]);
  renderTable(rankingTable, headers, rows);
}

function cellWithBadge(
  value: number,
  where: { inBest: boolean; inWorst: boolean },
): Cell {
  if (where.inBest) return { text: value, badge: BEST_BADGE };
  if (where.inWorst) return { text: value, badge: WORST_BADGE };
  return String(value);
}

function renderRecordBanner(): void {
  const banner = requireEl("record-banner");
  if (!impact.newRecord) return;
  const { name, score, variant } = impact.newRecord;
  banner.textContent = `👑 Nouveau record du téléphone : ${name} — ${score} (${variant})`;
  banner.hidden = false;
  reveal(banner, RANKING_DELAY);
}

function renderLegend(): void {
  const legend = requireEl("hof-legend");
  const parts: string[] = [];
  if (impact.best.length > 0) parts.push(`${BEST_BADGE} entre au Hall of Fame`);
  if (impact.worst.length > 0) {
    parts.push(`${WORST_BADGE} entre dans les pires scores`);
  }
  if (parts.length === 0) return;
  legend.textContent = parts.join("  ·  ");
  legend.hidden = false;
  reveal(legend, RANKING_DELAY + 0.3);
}

function renderPodium(results: Result[]): void {
  podium.replaceChildren();
  // Ordre visuel : 2e à gauche, 1er au centre (marche la plus haute), 3e à droite.
  for (const rank of [2, 1, 3]) {
    const result = results[rank - 1];
    if (result) podium.appendChild(buildStep(result, rank));
  }
}

/* ---------- Mise en scène du résultat (suite) ---------- */

function reveal(el: HTMLElement, delaySeconds: number): void {
  el.style.setProperty("--d", `${delaySeconds}s`);
  el.classList.add("reveal");
}

// Le score du vainqueur défile de 0 jusqu'à son total, au moment où sa marche
// se pose.
function countUp(el: HTMLElement, to: number, delayMs: number): void {
  const DURATION = 900;
  el.textContent = "0";
  window.setTimeout(() => {
    const start = performance.now();
    const tick = (now: number): void => {
      const p = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - p, 3); // ralentit en approchant du total
      el.textContent = String(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, delayMs);
}

function revealRanking(): void {
  const rows = rankingTable.querySelectorAll<HTMLTableRowElement>("tbody tr");
  rows.forEach((row, i) => {
    reveal(row, RANKING_DELAY + (rows.length - 1 - i) * ROW_STAGGER);
  });
}

function buildStep(result: Result, rank: number): HTMLElement {
  const step = document.createElement("div");
  step.className = `podium-step rank-${rank}`;
  const delay = STEP_DELAYS[rank] ?? 0;
  step.style.setProperty("--d", `${delay}s`);

  const medal = document.createElement("span");
  medal.className = "podium-medal";
  medal.textContent = MEDALS[rank - 1];

  const name = document.createElement("span");
  name.className = "podium-name";
  name.textContent = result.name;

  const score = document.createElement("span");
  score.className = "podium-score";
  score.textContent = String(result.total);
  if (rank === 1) countUp(score, result.total, delay * 1000 + STEP_MS);

  const num = document.createElement("span");
  num.className = "podium-num";
  num.textContent = String(rank);

  step.append(medal, name, score, num);
  return step;
}
