// Logique de partie du 5000 : fin de tour, progression des scores, et les deux
// règles qui les font redescendre (busts d'affilée, variante Sniper). Aucun
// accès au DOM — c'est ce qui rend ce module testable, comme scoring.ts l'est
// côté Yams.
//
// Toutes les fonctions renvoient la liste des mouvements qu'elles ont provoqués
// (`Move[]`). L'écran s'en sert pour dérouler la cascade devant le joueur au
// lieu de lui faire découvrir des scores changés sans explication.

import type {
  DiceCounts,
  G5000Game,
  G5000Player,
  G5000Rules,
  G5000Turn,
  Move,
  SheetEntry,
  Strike,
  TurnRoll,
} from "./types";
import { emptyStats, noteTurn } from "./records";
import type { Combo } from "./rules";
import { hasVariant } from "./variants";

// Le dernier score en vigueur (non barré) de la feuille, s'il y en a un.
export function liveEntry(p: G5000Player): SheetEntry | undefined {
  for (let i = p.sheet.length - 1; i >= 0; i--) {
    if (!p.sheet[i].struck) return p.sheet[i];
  }
  return undefined;
}

export const currentScore = (p: G5000Player): number => liveEntry(p)?.score ?? 0;

// Les scores en vigueur, sans les barrés : la progression telle que les règles
// la voient.
export const liveScores = (p: G5000Player): number[] =>
  p.sheet.filter((e) => !e.struck).map((e) => e.score);

// Une feuille sans rature, à partir de cumuls.
export const sheetFrom = (scores: number[]): SheetEntry[] =>
  scores.map((score) => ({ score }));

// Un joueur est entré en jeu dès qu'il a marqué une fois. Retomber à zéro l'en
// fait ressortir : il doit revalider le seuil d'ouverture.
export const hasOpened = (p: G5000Player): boolean => liveEntry(p) !== undefined;

// Barre le dernier score en vigueur : le joueur redescend au précédent. Il
// reste sur la feuille, comme sur papier. Sans effet si rien n'est en vigueur
// (les appelants s'en assurent).
function strike(p: G5000Player, mark: Strike): void {
  const entry = liveEntry(p);
  if (entry) entry.struck = mark;
}

export const emptyTurn = (): G5000Turn => ({
  pot: 0,
  diceLeft: 5,
  openDigits: [],
  rolls: 0,
});

/* ---------- Pendant le tour ---------- */

// Un tour qui commence : cinq dés en main, rien au pot, premier lancer.
export function startTurn(game: G5000Game): void {
  game.turn = { ...emptyTurn(), rolls: 1, hotStreak: 0 };
}

// Le joueur met de côté les combinaisons retenues dans le lancer : leurs points
// rejoignent le pot, les brelans ouvrent leur chiffre pour le reste du tour.
// S'il ne lui reste plus aucun dé, c'est une main pleine : il récupère les
// cinq, et la série de mains pleines du tour (un record) s'allonge — qu'il
// relance ensuite ou qu'il banque. Renvoie vrai sur une main pleine.
// Avec le lancer (`roll`, la calculette), le tour le garde dans son historique
// pour l'afficher et pouvoir y revenir (undoRoll).
export function keepDice(game: G5000Game, picked: Combo[], roll?: DiceCounts): boolean {
  const turn = game.turn;
  if (roll) {
    const { history = [], ...before } = turn;
    turn.history = [
      ...history,
      {
        roll: { ...roll },
        picked: picked.map((c) => c.id),
        kept: picked.flatMap((c) => c.dice),
        points: picked.reduce((total, c) => total + c.points, 0),
        before: structuredClone(before),
      },
    ];
  }
  for (const combo of picked) {
    turn.pot += combo.points;
    turn.diceLeft -= combo.dice.length;
    if (combo.opens !== null && !turn.openDigits.includes(combo.opens)) {
      turn.openDigits.push(combo.opens);
    }
  }
  const hot = turn.diceLeft <= 0;
  if (hot) {
    turn.diceLeft = 5;
    turn.hotStreak = (turn.hotStreak ?? 0) + 1;
  }
  return hot;
}

// Le joueur relance les dés qui lui restent.
export function reroll(game: G5000Game): void {
  game.turn.rolls++;
}

// Revenir au lancer précédent (calculette) : une erreur au lancer 2 ne
// demande plus de recommencer tout le tour. Le tour redevient exactement ce
// qu'il était avant que ce lancer soit gardé ; l'écran rouvre le lancer avec
// ses faces et ses choix (renvoyés). Null s'il n'y a rien à reprendre.
export function undoRoll(game: G5000Game): TurnRoll | null {
  const history = game.turn.history ?? [];
  const last = history.at(-1);
  if (!last) return null;
  const rest = history.slice(0, -1);
  game.turn = { ...structuredClone(last.before), ...(rest.length > 0 ? { history: rest } : {}) };
  return last;
}

export const canUndoRoll = (game: G5000Game): boolean => (game.turn.history?.length ?? 0) > 0;

// La saisie manuelle annonce le tour d'un bloc : son total final, sans le
// détail des mains pleines (seule la calculette les compte pour le record de
// la série, décision de Paul du 08/10). Il remplace ce qu'une calculette
// ouverte puis fermée aurait laissé en cours.
export function enterTurn(game: G5000Game, pot: number): void {
  startTurn(game);
  game.turn.pot = pot;
}

/* ---------- Variante Sniper ---------- */

// Fait redescendre d'un cran tout joueur dont le score actuel NON NUL égale
// `score`, puis recommence avec le score où il atterrit : une redescente peut
// en provoquer une autre.
//
// Zéro n'est pas un score : un joueur pas encore entré en jeu ne déclenche rien
// et ne subit rien. Sans cette exception, le premier joueur à banquer ferait
// tomber toute la table.
//
// Un joueur qui a atteint la cible est à l'abri (règle de base) : pendant la
// riposte, un adversaire qui tombe pile sur son score se classe derrière lui,
// sans le faire tomber. Il déclenche en revanche la cascade comme les autres.
//
// La cascade se termine toujours : chaque redescente diminue strictement un
// score, et les scores en vigueur étant croissants, un joueur ne peut pas être
// touché deux fois dans la même cascade.
function cascade(
  players: G5000Player[],
  score: number,
  author: number,
  target: number,
  moves: Move[],
): void {
  // Une file, et non une simple boucle : plusieurs joueurs peuvent partager le
  // score atteint, et ils redescendent TOUS — chacun ouvrant à son tour une
  // branche de cascade là où il atterrit.
  const pending: { score: number; by: number }[] = [{ score, by: author }];

  while (pending.length > 0) {
    const { score: reached, by } = pending.shift()!;
    if (reached <= 0) continue;

    for (let i = 0; i < players.length; i++) {
      if (i === by) continue;
      const player = players[i];
      const from = currentScore(player);
      if (from <= 0 || from !== reached || from >= target) continue;

      strike(player, { kind: "tie", by });
      const to = currentScore(player);
      // Retombé à zéro : il ressort du jeu et devra revalider l'ouverture.
      if (to === 0) player.blankTurns = 0;

      moves.push({ kind: "tie", player: i, from, to, by });
      pending.push({ score: to, by: i });
    }
  }
}

/* ---------- Fin de tour ---------- */

export interface TurnOutcome {
  moves: Move[];
  // Le joueur a-t-il marqué ? Un tour à zéro incrémente son compteur de tours
  // blancs (et peut déclencher la pénalité).
  scored: boolean;
}

// Le joueur banque `points`. `points === 0` vaut pour un bust comme pour un
// tour qui dépasse l'objectif avec « Dans le mille » : c'est un bust comme un
// autre (choix de Paul, 07/10/2026), il compte dans les tours sans marquer.
export function endTurn(game: G5000Game, points: number): TurnOutcome {
  const { players, rules } = game;
  const index = game.currentPlayerIndex;
  const player = players[index];
  const moves: Move[] = [];

  // Tant que le joueur n'est pas entré en jeu, un tour sous le seuil ne lui
  // rapporte rien — il n'a pas marqué.
  const opened = hasOpened(player);
  const enough = opened || points >= rules.openAt;
  const scored = points > 0 && enough;

  if (scored) {
    const from = currentScore(player);
    const to = from + points;
    player.sheet.push({ score: to });
    player.blankTurns = 0;
    moves.push({ kind: "bank", player: index, from, to });

    if (hasVariant(rules, "sniper")) cascade(players, to, index, rules.target, moves);

    if (to >= rules.target) {
      moves.push({ kind: "win", player: index, from: to, to });
      game.arrivals = [...(game.arrivals ?? []), index];
      markFinished(game, index);
    }
  } else if (opened) {
    // Le compteur ne tourne qu'une fois le joueur entré en jeu : la pénalité
    // n'aurait rien à annuler avant.
    player.blankTurns++;
    if (
      rules.blankTurnsPenalty > 0 &&
      player.blankTurns >= rules.blankTurnsPenalty
    ) {
      applyPenalty(game, index, moves);
    }
  }

  return { moves, scored };
}

function applyPenalty(game: G5000Game, index: number, moves: Move[]): void {
  const player = game.players[index];
  const from = currentScore(player);
  strike(player, { kind: "penalty" });
  const to = currentScore(player);
  player.blankTurns = 0;
  moves.push({ kind: "penalty", player: index, from, to });

  // Une redescente peut poser le joueur sur le score d'un adversaire : la même
  // cascade s'applique, comme pour la variante Sniper.
  if (hasVariant(game.rules, "sniper")) {
    cascade(game.players, to, index, game.rules.target, moves);
  }
}

/* ---------- Fin de partie ---------- */

// Quand la cible est atteinte, la partie ne s'arrête pas net. Deux façons de la
// clore (réglage `lastRound`), et elles ne coïncident que si le vainqueur est
// le dernier de l'ordre :
//
//   riposte (défaut) — CHAQUE adversaire rejoue une fois, même ceux qui ont
//     déjà joué ce tour-ci ;
//   tour de table    — seuls ceux qui ont joué un tour de moins que le
//     vainqueur terminent le tour, pour que tout le monde ait joué autant de
//     tours. Si c'est le dernier du tour qui atteint la cible, la partie
//     s'arrête aussitôt.
//
// On retient la LISTE de ceux qui doivent encore jouer (`toPlay`), et non
// « l'index du dernier joueur » : on peut choisir qui joue (choosePlayer), donc
// rien ne garantit que la table se joue dans l'ordre des places. C'est aussi
// pourquoi le tour de table se mesure en tours JOUÉS (`stats.turns`) et non par
// la place à table : si la main a été donnée à Paul en début de tour, Marie,
// assise avant lui, n'a peut-être pas encore joué.
function markFinished(game: G5000Game, winner: number): void {
  if (game.finishedBy !== undefined) return;
  game.finishedBy = winner;
  const n = game.players.length;
  const others = Array.from({ length: n - 1 }, (_, k) => (winner + 1 + k) % n);
  if (game.rules.lastRound) {
    game.toPlay = others;
    return;
  }
  const played = game.stats?.turns;
  // Le tour en cours n'est pas encore compté (noteTurn passe après endTurn) :
  // le vainqueur en est à `played[winner] + 1` tours.
  game.toPlay = played
    ? others.filter((i) => played[i] <= played[winner])
    : // Partie commencée avant les statistiques : l'ordre des places, faute de
      // mieux.
      others.filter((i) => i > winner);
}

// Ce joueur peut-il prendre la main ? Tout le monde, sauf une fois la cible
// atteinte : alors seulement ceux qui doivent encore jouer — le vainqueur et
// ceux qui ont déjà riposté ne rejouent pas.
export function canPlay(game: G5000Game, index: number): boolean {
  if (game.ended || index < 0 || index >= game.players.length) return false;
  return game.finishedBy === undefined || (game.toPlay ?? []).includes(index);
}

// Passe la main au prochain joueur qui peut jouer, dans l'ordre de la table.
export function nextPlayer(game: G5000Game): void {
  const n = game.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (game.currentPlayerIndex + k) % n;
    if (canPlay(game, i)) {
      game.currentPlayerIndex = i;
      break;
    }
  }
  game.turn = emptyTurn();
}

// Le joueur dont ce serait le tour en suivant la table : le premier, dans
// l'ordre de départ, à avoir joué le moins de tours — parmi ceux qui peuvent
// encore jouer (riposte comprise). Même règle que `playerToPlay` au Yams.
// Donner la main à quelqu'un d'autre (choosePlayer) reste permis : l'écran
// s'en sert seulement pour le rappeler. `null` pour une partie d'avant les
// statistiques, qui ne compte pas les tours, ou finie.
export function expectedPlayer(game: G5000Game): number | null {
  const turns = game.stats?.turns;
  if (!turns || game.ended) return null;
  let expected: number | null = null;
  for (let i = 0; i < game.players.length; i++) {
    if (!canPlay(game, i)) continue;
    if (expected === null || turns[i] < turns[expected]) expected = i;
  }
  return expected;
}

// Un tour a-t-il été entamé ? Dès qu'un lancer a été validé, il y a quelque
// chose à perdre (pot, dés mis de côté) : l'abandonner mérite confirmation.
export const turnStarted = (game: G5000Game): boolean =>
  game.turn.pot > 0 || game.turn.rolls > 1;

// Donne la main à un autre joueur — « c'est à Marie, pas à Jean » : la suite de
// l'ordre repart de lui. Le tour entamé est abandonné ; c'est à l'écran de le
// faire confirmer (turnStarted). Renvoie faux si ce joueur ne peut pas jouer.
export function choosePlayer(game: G5000Game, index: number): boolean {
  if (!canPlay(game, index)) return false;
  game.currentPlayerIndex = index;
  game.turn = emptyTurn();
  return true;
}

/* ---------- Fin du tour : le point d'entrée de l'écran ---------- */

// Comment le tour se termine : le pot est banqué, ou perdu sur un bust —
// dépasser l'objectif avec « Dans le mille » en est un.
export type TurnFinish = "bank" | "bust";

export interface FinishedTurn {
  moves: Move[]; // à dérouler devant les joueurs (cascade)
  ended: boolean; // la partie est finie
}

// Termine le tour du joueur courant sur le pot de `game.turn` : score, règles
// qui font redescendre, consignation pour les records, puis main passée ou fin de partie.
// C'est la seule fonction que l'écran appelle — l'ordre de ces étapes compte
// (ce qu'on mesure avant endTurn, qui fait entrer le joueur en jeu), il n'a
// pas à le connaître.
export function finishTurn(game: G5000Game, how: TurnFinish): FinishedTurn {
  // La partie d'avant ce tour, pour pouvoir le reprendre (undoLastTurn).
  const before = snapshot(game);
  const index = game.currentPlayerIndex;
  const { pot, hotStreak = 0 } = game.turn;
  // Mesuré AVANT endTurn, qui fait entrer le joueur en jeu s'il a marqué.
  const wasOpen = hasOpened(game.players[index]);

  const points = how === "bank" ? pot : 0;
  const { moves, scored } = endTurn(game, points);

  // Une partie commencée avant les records n'a pas de quoi les consigner.
  game.stats ??= emptyStats(game.players.length);
  noteTurn(game.stats, {
    player: index,
    wasOpen,
    scored,
    banked: scored ? points : 0,
    // Un dépassement (« Dans le mille ») compte aussi pour le record du pot
    // perdu : un pot perdu reste un pot perdu, quelle qu'en soit la raison
    // (choix de Paul, 19/09/2026).
    lost: how === "bank" ? 0 : pot,
    hotStreak,
    moves,
  });

  game.previous = before;
  game.lastTurn = { player: index, how, pot, moves };
  return { moves, ended: closeTurn(game) };
}

/* ---------- Corriger le dernier tour ---------- */
// Une saisie fausse (650 au lieu de 600, « Bust » au lieu de « Banquer ») ne
// se rattrapait pas une fois la main passée. Plutôt que de défaire un à un les
// effets du tour (score, busts d'affilée, cascade Sniper, records), on garde la
// partie telle qu'elle était juste avant lui, et on y revient.

// La partie sans son propre retour en arrière : un seul tour se reprend, et
// l'instantané ne s'emboîte pas dans le suivant.
function snapshot(game: G5000Game): G5000Game {
  const { previous: _previous, lastTurn: _lastTurn, ...rest } = game;
  return structuredClone(rest);
}

// Le dernier tour peut-il être repris ? Pas une fois la partie finie : le
// podium a déjà écrit les records.
export const canUndoLastTurn = (game: G5000Game): boolean =>
  game.previous !== undefined && !game.ended;

// Revient à la partie d'avant le dernier tour : la main retourne à celui qui
// l'a joué, avec un tour vierge, comme s'il n'avait pas encore joué. Renvoie
// faux s'il n'y a rien à reprendre. Modifie `game` sur place : l'écran le
// garde en main.
export function undoLastTurn(game: G5000Game): boolean {
  const previous = game.previous;
  if (!previous || !canUndoLastTurn(game)) return false;
  for (const key of Object.keys(game) as (keyof G5000Game)[]) delete game[key];
  Object.assign(game, previous);
  game.turn = emptyTurn();
  return true;
}

// Clôt le tour qui vient d'être joué : soit la partie s'achève (et le reste,
// cf. G5000Game.ended), soit la main passe. Renvoie vrai si la partie est finie.
export function closeTurn(game: G5000Game): boolean {
  if (game.finishedBy !== undefined) {
    game.toPlay = (game.toPlay ?? []).filter((i) => i !== game.currentPlayerIndex);
    if (game.toPlay.length === 0) {
      game.ended = true;
      return true;
    }
  }
  nextPlayer(game);
  return false;
}

/* ---------- Classement ---------- */

export interface Standing {
  index: number;
  name: string;
  score: number;
  rank: number; // 1 = vainqueur ; deux ex æquo partagent le même rang
}

// À score égal, ceux qui ont atteint l'objectif se départagent par ordre
// d'arrivée : le premier arrivé passe devant (règle de base, 07/10/2026). Les
// autres ex æquo partagent leur rang — c'est aussi ce que donne une partie
// d'avant `arrivals`, où l'égalité sur l'objectif était une victoire partagée.
export function standings(game: G5000Game): Standing[] {
  const arrivals = game.arrivals ?? [];
  const arrival = (index: number): number => {
    const at = arrivals.indexOf(index);
    return at < 0 ? Infinity : at;
  };
  const rows = game.players
    .map((p, index) => ({ index, name: p.name, score: currentScore(p) }))
    .sort((a, b) => b.score - a.score || arrival(a.index) - arrival(b.index));

  const ranks: number[] = [];
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    const tied =
      prev !== undefined &&
      prev.score === row.score &&
      arrival(prev.index) === Infinity &&
      arrival(row.index) === Infinity;
    ranks.push(tied ? ranks[i - 1] : i + 1);
  });
  return rows.map((row, i) => ({ ...row, rank: ranks[i] }));
}

/* ---------- Ce qu'il faut viser ---------- */

export interface TieTarget {
  index: number;
  name: string;
  score: number;
  // Points encore nécessaires, depuis le score actuel du joueur qui joue,
  // pour tomber pile sur ce score. Négatif : le pot l'a déjà dépassé.
  needed: number;
  // Où il retomberait si on s'arrêtait pile sur son score : son score
  // précédent, ou zéro. Sa propre chute peut ensuite en entraîner d'autres
  // (cascade) — seule la première est annoncée.
  fallsTo: number;
}

// Scores d'adversaires que le joueur courant peut faire tomber en banquant
// maintenant. C'est la fonctionnalité que l'application apporte vraiment :
// viser une égalité exacte de tête est hors de portée. Un joueur arrivé à la
// cible n'en fait pas partie : il est à l'abri (cf. cascade).
export function tieTargets(game: G5000Game, pot: number): TieTarget[] {
  if (!hasVariant(game.rules, "sniper")) return [];
  const me = game.players[game.currentPlayerIndex];
  const base = currentScore(me);

  return game.players
    .map((p, index) => ({ p, index }))
    .filter(
      ({ p, index }) =>
        index !== game.currentPlayerIndex &&
        currentScore(p) > base &&
        currentScore(p) < game.rules.target,
    )
    .map(({ p, index }) => {
      const live = liveScores(p);
      return {
        index,
        name: p.name,
        score: currentScore(p),
        needed: currentScore(p) - base - pot,
        fallsTo: live.length > 1 ? live[live.length - 2] : 0,
      };
    })
    // Les plus proches d'abord ; ceux que le pot a déjà dépassés à la fin, le
    // moins dépassé en tête.
    .sort((a, b) =>
      a.needed >= 0 !== b.needed >= 0
        ? (a.needed >= 0 ? -1 : 1)
        : a.needed >= 0
          ? a.needed - b.needed
          : b.needed - a.needed,
    );
}

// « Sans demi-mesure » : un pot qui finit par 50 ne peut pas être marqué, il
// faut relancer jusqu'à un compte rond. Les cumuls partent de zéro et ne
// grossissent que de pots ronds : ils restent ronds eux aussi.
export function isUnround(game: G5000Game, pot: number): boolean {
  return hasVariant(game.rules, "noFifty") && pot % 100 !== 0;
}

// Le joueur peut-il banquer ce pot ? Pas sous le seuil d'entrée en jeu, pas
// sur une main pleine (sauf « Pas de zèle »), pas sur un compte qui finit par
// 50 (« Sans demi-mesure »), pas au-delà de l'objectif (« Dans le mille »).
export function canBank(game: G5000Game, pot: number, hotDice: boolean): boolean {
  if (pot <= 0) return false;
  const player = game.players[game.currentPlayerIndex];
  if (!hasOpened(player) && pot < game.rules.openAt) return false;
  if (hotDice && !hasVariant(game.rules, "freeHotDice")) return false;
  if (isUnround(game, pot)) return false;
  return !isOvershoot(game, pot);
}

// « Dans le mille » : le pot dépasse l'objectif, le tour est un bust. Le
// joueur a pu y être forcé, puisqu'il doit garder au moins un dé.
export function isOvershoot(game: G5000Game, pot: number): boolean {
  if (!hasVariant(game.rules, "exact")) return false;
  const player = game.players[game.currentPlayerIndex];
  return currentScore(player) + pot > game.rules.target;
}

// Ce que banquer ce pot ferait de la partie, pour l'annoncer sur le bouton
// (demande de Paul) : `win`, la cible est atteinte et personne n'a autant ;
// `reached`, atteinte, mais un joueur arrivé avant a autant ou plus — à
// égalité, le premier arrivé passe devant. `null` : la cible n'est pas
// atteinte, ou ce pot ne peut pas être banqué. Pendant la riposte qui suit,
// les autres peuvent encore dépasser le vainqueur : `win` dit l'état de la
// partie au moment de banquer.
export type BankOutcome = "win" | "reached";

export function bankOutcome(game: G5000Game, pot: number): BankOutcome | null {
  const index = game.currentPlayerIndex;
  const player = game.players[index];
  const after = currentScore(player) + pot;
  if (pot <= 0 || after < game.rules.target || isOvershoot(game, pot)) return null;
  if (!hasOpened(player) && pot < game.rules.openAt) return null;
  if (isUnround(game, pot)) return null;
  const best = Math.max(
    0,
    ...game.players.filter((_, i) => i !== index).map(currentScore),
  );
  return after > best ? "win" : "reached";
}

// Relancer a-t-il encore un sens ? Pas une fois l'objectif dépassé avec « Dans
// le mille » : les points ne font que s'ajouter, le tour est déjà perdu.
// Obliger à relancer jusqu'au bust ne ferait que gonfler le pot perdu — et
// fausser le record du plus gros pot perdu.
export function canReroll(game: G5000Game, pot: number): boolean {
  return !isOvershoot(game, pot);
}

export function createPlayers(
  names: string[],
  colors: string[],
): G5000Player[] {
  return names.map((name, i) => ({
    name,
    color: colors[i],
    sheet: [],
    blankTurns: 0,
  }));
}

export function createGame(
  names: string[],
  colors: string[],
  rules: G5000Rules,
): G5000Game {
  return {
    players: createPlayers(names, colors),
    currentPlayerIndex: 0,
    rules,
    turn: emptyTurn(),
    stats: emptyStats(names.length),
  };
}
