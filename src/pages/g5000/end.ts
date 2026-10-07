// Fin de partie du 5000 : podium et classement.
//
// Le podium reprend celui du Yams, mais le classement vient de `standings` : à
// score égal sur l'objectif, le premier arrivé passe devant. Seule une partie
// d'avant cette règle (sans `arrivals`) peut encore finir sur une victoire
// partagée, d'où `renderSharedWin`.
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).

import { bootstrap } from "../../core/bootstrap";
import { goTo } from "../../core/nav";
import { MEDALS, plural, renderTable, requireEl, type Cell } from "../../core/ui";
import { formatScore } from "../../core/format";
import { podiumOrder } from "../../core/ranking";
import { recordGamesPlayed } from "../../core/storage/playerGamesRepo";
import { clearDraft } from "../../core/storage/draftRepo";
import {
  getRecords,
  getSavedGame,
  saveRecords,
  saveSavedGame,
  clearSavedGame,
} from "../../games/g5000/repo";
import {
  mergeRecords,
  mostWins,
  recordsAt,
  type G5000Records,
  type RecordKey,
} from "../../games/g5000/records";
import { RECORD_LABELS } from "../../games/g5000/recordLabels";
import { standings, type Standing } from "../../games/g5000/engine";

bootstrap();

const saved = getSavedGame();
if (!saved) {
  goTo("g5000Home");
  throw new Error("Aucune partie terminée à afficher : retour à l'accueil du 5000.");
}
const game = saved;

// Une partie non terminée ne passe pas par ici : ses records seraient
// enregistrés avant la fin. `recorded` couvre les parties finies avant
// l'arrivée de `ended`.
if (!game.ended && !game.recorded) {
  goTo("g5000Game");
  throw new Error("Partie en cours : retour à l'écran de jeu.");
}

const fmt = formatScore;

const results = standings(game);

// Les trois premières places, chacune avec sa médaille de RANG : deux
// vainqueurs ex æquo montent tous les deux sur une marche d'or.
function renderPodium(rows: Standing[]): void {
  requireEl("podium").replaceChildren(
    ...podiumOrder(rows).map((row) => buildStep(row, row.rank)),
  );
}

function buildStep(row: Standing, rank: number): HTMLElement {
  const step = document.createElement("div");
  step.className = `podium-step rank-${rank}`;

  const medal = document.createElement("span");
  medal.className = "podium-medal";
  medal.textContent = MEDALS[rank - 1];

  const name = document.createElement("span");
  name.className = "podium-name";
  name.textContent = row.name;

  const score = document.createElement("span");
  score.className = "podium-score";
  score.textContent = fmt(row.score);

  const num = document.createElement("span");
  num.className = "podium-num";
  num.textContent = String(rank);

  step.append(medal, name, score, num);
  return step;
}

function renderRanking(rows: Standing[]): void {
  const table = requireEl<HTMLTableElement>("ranking-table");
  renderTable(
    table,
    ["", "Joueur", "Score", "Tours"],
    rows.map((row): Cell[] => [
      MEDALS[row.rank - 1] ?? `${row.rank}`,
      row.name,
      { strong: fmt(row.score) },
      // Tours réellement joués, busts compris (la feuille ne garde que les
      // progressions du score). Absent des parties d'avant les records.
      game.stats ? String(game.stats.turns[row.index]) : "—",
    ]),
  );
}

// Partie d'avant l'ordre d'arrivée : deux joueurs sur l'objectif exact s'y
// partageaient la victoire, et il faut le dire plutôt que de laisser deux 🥇
// sans explication.
function renderSharedWin(rows: Standing[]): void {
  const winners = rows.filter((r) => r.rank === 1);
  if (winners.length < 2) return;
  const note = requireEl("end-note");
  note.textContent = `Victoire partagée entre ${winners
    .map((w) => w.name)
    .join(" et ")} — ${plural(winners.length, "joueur")} sur ${fmt(game.rules.target)}.`;
  note.hidden = false;
}

/* ---------- Mise en route ---------- */

// Enregistré dès l'arrivée, pas au clic sur « Quitter » : une partie terminée
// ne doit pas être perdue si l'application est fermée ici. `recorded` empêche
// le double comptage en cas de rafraîchissement.
// Les records battus sont mesurés AVANT d'écrire les nouveaux records, puis
// mémorisés dans la partie : recalculés après écriture, ils se compareraient à
// eux-mêmes et la liste resterait vide — le piège de `hofImpact` au Yams.
let broken: RecordKey[] = (game.recordsBroken ?? []) as RecordKey[];
let records: G5000Records = getRecords();

if (!game.recorded) {
  const winners = results.filter((r) => r.rank === 1).map((r) => r.index);
  const merged = mergeRecords(records, game, winners, new Date().toLocaleDateString("fr-FR"));
  records = merged.records;
  broken = merged.broken;
  saveRecords(records);
  recordGamesPlayed(game.players.map((p) => p.name));
  saveSavedGame({ ...game, recorded: true, recordsBroken: broken });
}

// Les records tombés pendant cette partie, en tête de l'écran : c'est la
// seule chose que le 5000 a à célébrer au-delà du vainqueur.
function renderBrokenRecords(): void {
  const list = requireEl("records-broken");
  list.replaceChildren();
  for (const key of broken) {
    const label = RECORD_LABELS[key];
    const holder =
      key === "mostWins" ? mostWins(records) : recordsAt(records, game.rules.target)[key];
    if (!label || !holder) continue;
    const li = document.createElement("li");
    li.className = label.worst ? "record-new record-new--worst" : "record-new";
    li.textContent = `${label.icon} ${label.title} — ${holder.name}, ${label.format(holder.value)}`;
    list.appendChild(li);
  }
  list.hidden = list.children.length === 0;
}

renderPodium(results);
renderBrokenRecords();
renderRanking(results);
renderSharedWin(results);

// La partie n'est effacée qu'ici : un rafraîchissement de cette page réaffiche
// le podium au lieu de tout perdre.
requireEl("quit-btn").addEventListener("click", () => {
  clearSavedGame();
  clearDraft();
  goTo("g5000Home");
});
