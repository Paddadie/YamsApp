// Fin de partie du 5000 : podium et classement.
//
// Le podium et sa mise en scène sont ceux du Yams (endScreen.ts), mais le
// classement vient de `standings` : à score égal sur l'objectif, le premier
// arrivé passe devant. Seule une partie d'avant cette règle (sans `arrivals`)
// peut encore finir sur une victoire partagée, d'où `renderSharedWin`.
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).

import { bootstrap } from "../../core/bootstrap";
import { G5000 } from "../../games/g5000/gameDef";
import { applyGameTheme } from "../gameTheme";
import { goTo } from "../../core/nav";
import { plural, renderTable, requireEl, type Cell } from "../../core/ui";
import { icon } from "../../core/icons";
import {
  AFTER_PODIUM,
  celebrate,
  recordLine,
  renderPodium,
  reveal,
  revealRanking,
} from "../endScreen";
import { formatScore } from "../../core/format";
import { dateStamp } from "../../core/dates";
import { recordGamesPlayed } from "../../core/storage/playerGamesRepo";
import { saveLastWin } from "../../core/storage/lastWinRepo";
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

function renderRanking(rows: Standing[]): void {
  const table = requireEl<HTMLTableElement>("ranking-table");
  renderTable(
    table,
    ["", "Joueur", "Score", "Tours"],
    rows.map((row): Cell[] => [
      { rank: row.rank },
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

applyGameTheme(requireEl("g5000-end-screen"), G5000);

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
  const merged = mergeRecords(records, game, winners, dateStamp());
  records = merged.records;
  broken = merged.broken;
  saveRecords(records);
  recordGamesPlayed(game.players.map((p) => p.name));
  // Le post-it « Dernière victoire » du menu.
  const firsts = results.filter((r) => r.rank === 1);
  saveLastWin({
    gameId: G5000.id,
    winners: firsts.map((r) => r.name),
    score: firsts[0]?.score ?? 0,
    date: dateStamp(),
  });
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
    li.append(
      icon(label.icon),
      recordLine(label.title, `${holder.name}, ${label.format(holder.value)}`),
    );
    list.appendChild(li);
  }
  list.hidden = list.children.length === 0;
  // Le post-it se pose avec le classement, une fois le podium monté.
  if (!list.hidden) reveal(list, AFTER_PODIUM);
}

requireEl("end-eyebrow").textContent = `5000 · objectif ${fmt(game.rules.target)}`;
celebrate(
  results
    .filter((r) => r.rank === 1)
    .map((r) => ({ name: r.name, color: game.players[r.index].color })),
);
renderPodium(requireEl("podium"), results, fmt);
renderBrokenRecords();
renderRanking(results);
revealRanking(requireEl<HTMLTableElement>("ranking-table"));
renderSharedWin(results);

// La partie n'est effacée qu'ici : un rafraîchissement de cette page réaffiche
// le podium au lieu de tout perdre.
requireEl("quit-btn").addEventListener("click", () => {
  clearSavedGame();
  clearDraft();
  goTo("g5000Home");
});
