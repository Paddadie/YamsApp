// Page de fin de partie : podium et classement, indication de l'impact sur le
// Hall of Fame. La partie est enregistrée dès l'arrivée (voir la mise en
// route), et n'est effacée qu'au clic sur « Quitter ».
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).

import { bootstrap } from "../../core/bootstrap";
import { goTo } from "../../core/nav";
import { getVariantIcon } from "../../games/yams/variants";
import { MEDALS, renderTable, requireEl, type Cell } from "../../core/ui";
import { podiumOrder, sharedRanks } from "../../core/ranking";
import {
  getSavedGame,
  saveSavedGame,
  clearSavedGame,
} from "../../games/yams/storage/savedGameRepo";
import { clearDraft } from "../../core/storage/draftRepo";
import { recordGameResult } from "../../games/yams/storage/playerStatsRepo";
import { recordGamesPlayed } from "../../core/storage/playerGamesRepo";
import { buildGrid, writeDerived, FINAL_SCORE_LINE } from "../../games/yams/scoring";
import { sheetOf } from "../../games/yams/players";
import {
  impactFor,
  isHallOfFameImpact,
  previewHallOfFame,
  saveBestAndWorstScores,
} from "../../games/yams/hallOfFame";
import type { HallOfFameImpact, Variant } from "../../games/yams/types";

const BEST_BADGE = "🏆";
const WORST_BADGE = "💩";

bootstrap();

const saved = getSavedGame();
if (!saved) {
  goTo("yamsHome");
  throw new Error("Aucune partie terminée à afficher : retour à l'accueil.");
}
const game = saved; // alias non-null

const grid = buildGrid(game.rules);

// Recalcule bonus/totaux/score final pour chaque feuille : garantit des valeurs
// justes même pour une partie sauvegardée par une ancienne version.
for (const player of game.players) {
  for (const variant of game.selectedVariants) {
    writeDerived(sheetOf(player, variant), grid);
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
  : previewHallOfFame(game.players, game.selectedVariants);

const podium = requireEl("podium");
const rankingTable = requireEl<HTMLTableElement>("ranking-table");

interface Result {
  name: string;
  details: Partial<Record<Variant, number>>; // une entrée par variante jouée
  total: number;
  // 1 = vainqueur ; deux totaux égaux partagent le même rang (cf. sharedRanks).
  rank: number;
}

const results = computeResults();
const hasClassique = game.selectedVariants.includes("Classique");

/* ---------- Mise en scène du résultat ---------- */
// Les marches sortent du sol de la dernière vers la première : on garde le
// vainqueur pour la fin. Le classement complet suit, du dernier au premier.
// Séquence jouée une seule fois par partie — c'est le moment fort, il peut se
// permettre de durer, contrairement aux animations du jeu lui-même.

const STEP_DELAYS: Record<number, number> = { 3: 0.08, 2: 0.26, 1: 0.44 };
const STEP_MS = 450;
const RANKING_DELAY = 0.72; // le classement démarre une fois le podium posé
const ROW_STAGGER = 0.07;

function computeResults(): Result[] {
  const rows = game.players
    .map((player) => {
      const details: Result["details"] = {};
      let total = 0;
      for (const variant of game.selectedVariants) {
        const score = sheetOf(player, variant)[FINAL_SCORE_LINE] || 0;
        details[variant] = score;
        total += score;
      }
      return { name: player.name, details, total };
    })
    .sort((a, b) => b.total - a.total);
  const ranks = sharedRanks(rows.map((row) => row.total));
  return rows.map((row, i) => ({ ...row, rank: ranks[i] }));
}

function renderRanking(results: Result[]): void {
  // Colonne « Total » seulement à plusieurs variantes : à variante unique elle
  // répète la seule colonne de score. Le classement se fait toujours sur le
  // total (cf. computeResults).
  const multi = game.selectedVariants.length > 1;
  const headers = [
    "",
    "Joueur",
    ...game.selectedVariants.map(getVariantIcon),
    ...(multi ? ["Total"] : []),
  ];
  const rows = results.map((r): Cell[] => [
    MEDALS[r.rank - 1] ?? `${r.rank}`,
    r.name,
    ...game.selectedVariants.map((v) =>
      cellWithBadge(r.details[v] ?? 0, impactFor(impact, r.name, v)),
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
  if (impact.best.length > 0) parts.push(`${BEST_BADGE} entre au palmarès`);
  if (impact.worst.length > 0) {
    parts.push(`${WORST_BADGE} entre dans les pires scores`);
  }
  if (parts.length === 0) return;
  legend.textContent = parts.join("  ·  ");
  legend.hidden = false;
  reveal(legend, RANKING_DELAY + 0.3);
}

// Les trois premières places, chacune avec sa médaille de RANG : à égalité de
// total, deux joueurs montent sur la même marche au lieu d'être départagés par
// leur ordre de passage.
function renderPodium(results: Result[]): void {
  podium.replaceChildren(
    ...podiumOrder(results).map((result) => buildStep(result, result.rank)),
  );
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

/* ---------- Mise en route ---------- */

// Enregistrement dès l'arrivée sur l'écran de fin, pas au clic sur « Quitter » :
// si l'utilisateur ferme l'appli sans quitter, la partie n'est pas perdue.
// `recorded` (posé sur la partie sauvegardée) empêche un double comptage si on
// rafraîchit cette page ou qu'on y revient via « Reprendre ».
// L'impact sur le Hall of Fame, lui, a déjà été mesuré plus haut : il DOIT
// l'être avant cette écriture.
if (!saved.recorded) {
  saveBestAndWorstScores(game.players, game.selectedVariants, grid);
  // Les statistiques ne comptent que les parties classiques : `classiqueScore`
  // vaut null quand la partie n'incluait pas cette variante (la partie est
  // alors comptée dans `games` mais pas dans la moyenne).
  recordGameResult(
    results.map((r) => ({
      name: r.name,
      classiqueScore: hasClassique ? (r.details.Classique ?? 0) : null,
    })),
  );
  // Compteur commun à tous les jeux : sert au tri des joueurs à la création
  // d'une partie, quel que soit le jeu.
  recordGamesPlayed(results.map((r) => r.name));
  saveSavedGame({ ...saved, recorded: true, hofImpact: impact });
}

renderPodium(results);
renderRanking(results);
revealRanking();
renderRecordBanner();
renderLegend();

// La partie sauvegardée n'est effacée qu'ici : ainsi un rafraîchissement de
// cette page réaffiche le podium au lieu de tout perdre.
requireEl("quit-btn").addEventListener("click", () => {
  clearSavedGame();
  clearDraft();
  goTo("yamsHome");
});
