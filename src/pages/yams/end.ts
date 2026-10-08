// Page de fin de partie : podium et classement, indication de l'impact sur le
// Hall of Fame. La partie est enregistrée dès l'arrivée (voir la mise en
// route), et n'est effacée qu'au clic sur « Quitter ».
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).

import { bootstrap } from "../../core/bootstrap";
import { YAMS } from "../../games/yams/gameDef";
import { applyGameTheme } from "../gameTheme";
import { goTo } from "../../core/nav";
import { variantBadge } from "../../games/yams/variantBadge";
import { renderTable, requireEl, type Cell } from "../../core/ui";
import { icon, type IconName } from "../../core/icons";
import {
  AFTER_PODIUM,
  celebrate,
  recordLine,
  renderPodium,
  reveal,
  revealRanking,
} from "../endScreen";
import { sharedRanks } from "../../core/ranking";
import {
  getSavedGame,
  saveSavedGame,
  clearSavedGame,
} from "../../games/yams/storage/savedGameRepo";
import { clearDraft } from "../../core/storage/draftRepo";
import { recordGameResult } from "../../games/yams/storage/playerStatsRepo";
import { recordGamesPlayed } from "../../core/storage/playerGamesRepo";
import { saveLastWin } from "../../core/storage/lastWinRepo";
import { dateStamp } from "../../core/dates";
import { buildGrid, writeDerived, FINAL_SCORE_LINE } from "../../games/yams/scoring";
import { sheetOf } from "../../games/yams/players";
import {
  impactFor,
  isHallOfFameImpact,
  previewHallOfFame,
  saveBestAndWorstScores,
} from "../../games/yams/hallOfFame";
import type { HallOfFameImpact, Variant } from "../../games/yams/types";

// Marques du classement : ce score entre au palmarès (trophée, à l'or), ou
// dans les pires scores (la courbe qui tombe, au rouge).
const BEST_BADGE: IconName = "trophy";
const WORST_BADGE: IconName = "fall";

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
    ...game.selectedVariants.map(variantBadge),
    ...(multi ? ["Total"] : []),
  ];
  const rows = results.map((r): Cell[] => [
    { rank: r.rank },
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
  if (where.inBest) return { text: value, badge: BEST_BADGE, badgeLabel: "entre au palmarès" };
  if (where.inWorst) {
    return { text: value, badge: WORST_BADGE, badgeLabel: "entre dans les pires scores" };
  }
  return String(value);
}

function renderRecordBanner(): void {
  const banner = requireEl("record-banner");
  if (!impact.newRecord) return;
  const { name, score, variant } = impact.newRecord;
  banner.replaceChildren(
    icon("crown"),
    recordLine("Nouveau record du téléphone", `${name}, ${score} · ${variant}`),
  );
  banner.hidden = false;
  reveal(banner, AFTER_PODIUM);
}

function renderLegend(): void {
  const legend = requireEl("hof-legend");
  const item = (mark: IconName, text: string): HTMLElement => {
    const el = document.createElement("span");
    el.className = `legend-item cell-badge--${mark}`;
    el.append(icon(mark), text);
    return el;
  };
  const parts: HTMLElement[] = [];
  if (impact.best.length > 0) parts.push(item(BEST_BADGE, "entre au palmarès"));
  if (impact.worst.length > 0) parts.push(item(WORST_BADGE, "entre dans les pires scores"));
  if (parts.length === 0) return;
  legend.replaceChildren(...parts);
  legend.hidden = false;
  reveal(legend, AFTER_PODIUM + 0.3);
}

/* ---------- Mise en route ---------- */

applyGameTheme(requireEl("end-screen"), YAMS);

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
  // Le post-it « Dernière victoire » du menu.
  const firsts = results.filter((r) => r.rank === 1);
  saveLastWin({
    gameId: YAMS.id,
    winners: firsts.map((r) => r.name),
    score: firsts[0]?.total ?? 0,
    date: dateStamp(),
  });
  saveSavedGame({ ...saved, recorded: true, hofImpact: impact });
}

celebrate(
  results
    .filter((r) => r.rank === 1)
    .map((r) => ({
      name: r.name,
      color: game.players.find((p) => p.name === r.name)?.color ?? "",
    })),
);
renderPodium(
  podium,
  results.map((r) => ({ name: r.name, score: r.total, rank: r.rank })),
  String,
);
renderRanking(results);
revealRanking(rankingTable);
renderRecordBanner();
renderLegend();

// La partie sauvegardée n'est effacée qu'ici : ainsi un rafraîchissement de
// cette page réaffiche le podium au lieu de tout perdre.
requireEl("quit-btn").addEventListener("click", () => {
  clearSavedGame();
  clearDraft();
  goTo("yamsHome");
});
