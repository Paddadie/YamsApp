// Page "Joueurs de la partie", COMMUNE À TOUS LES JEUX : une liste unique où
// chaque joueur connu se coche pour rejoindre la partie. Les joueurs
// sélectionnés portent un numéro d'ordre de tour et se réordonnent par
// glisser-déposer (poignée). Le champ du haut sert à créer un nom OU à filtrer
// la liste.
//
// Rien ici ne connaît un jeu en particulier : le brouillon dit lequel est visé,
// et c'est ce jeu qui convertit le brouillon en partie au clic sur « Commencer »
// (cf. GameDef.startGame). Ajouter un jeu ne demande donc pas de toucher à cet
// écran.
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).

import { bootstrap } from "../core/bootstrap";
import { goTo } from "../core/nav";
import { PLAYER_COLORS } from "../core/playerColors";
import {
  makeActivatable,
  makeDismissible,
  plural,
  requireEl,
  summaryRow,
} from "../core/ui";
import { compareNames, foldName } from "../core/playerName";
import {
  addKnownName,
  getKnownNames,
  resolveName,
} from "../core/storage/knownPlayersRepo";
import {
  getPlayerGames,
  gamesPlayed,
} from "../core/storage/playerGamesRepo";
import {
  getDraft,
  saveDraft,
  clearDraft,
  getLastRoster,
} from "../core/storage/draftRepo";
import { gameById } from "../games/registry";
import type { ResumeInfo } from "../games/types";

bootstrap();

const draft = getDraft();
const game = gameById(draft?.gameId);
if (!draft || !game) {
  goTo("home");
  throw new Error("Aucun brouillon de partie exploitable : retour à l'accueil.");
}
const roster = draft; // alias non-null pour les closures
const target = game; // idem

const playerForm = requireEl<HTMLFormElement>("player-form");
const nameInput = requireEl<HTMLInputElement>("player-name");
const countLine = requireEl("roster-count");
const reuseBtn = requireEl<HTMLButtonElement>("reuse-btn");
const shuffleBtn = requireEl<HTMLButtonElement>("shuffle-btn");
const list = requireEl<HTMLUListElement>("roster");
const startBtn = requireEl<HTMLButtonElement>("start-game-btn");
const backBtn = requireEl<HTMLAnchorElement>("back-btn");
const newGameDialog = requireEl<HTMLDialogElement>("new-game-dialog");

const selected = new Set(roster.playerNames);

// La couleur appartient au joueur, pas à sa place : sans ça, mélanger l'ordre
// (ou déplacer une ligne) ferait changer de teinte toutes les pastilles d'un
// coup. Attribuée à la sélection, rendue à la désélection.
const colorOf = new Map<string, string>();

// Battage de cartes au clic sur « Ordre aléatoire ».
const SHUFFLE_MS = 420; // 0.38s d'animation + marge : pas de coupure sur la fin
const BADGE_POP_MS = 240;
let shuffling = false;

// Glisser-déposer depuis n'importe où sur la ligne d'un joueur sélectionné : il
// part dès que le doigt glisse au-delà de ce seuil. En deçà, c'est un simple
// toucher (sélection / désélection). Pas d'appui long à attendre : Paul le
// trouvait trop lent (06/10).
const DRAG_START_PX = 6;
// Un déplacement vient de se terminer : le « toucher » qu'il produit en
// relâchant ne doit pas désélectionner le joueur qu'on vient de poser.
let dragJustEnded = false;

// Le brouillon est effacé AVANT de passer la main au jeu : celui-ci navigue
// vers son écran de partie, et un brouillon resté en place ferait revenir sur
// cette page à la prochaine visite.
function startGame(): void {
  const names = roster.playerNames.slice();
  const colors = new Map(colorOf);
  clearDraft();
  target.startGame({ ...roster, playerNames: names }, colors);
}

function showReplaceWarning(current: ResumeInfo): void {
  const summary = requireEl("new-game-summary");
  summary.replaceChildren();
  for (const { term, value } of current.rows) summaryRow(summary, term, value);
  newGameDialog.showModal();
}

function select(name: string): void {
  selected.add(name);
  roster.playerNames.push(name);
  assignColor(name);
}

function deselect(name: string): void {
  selected.delete(name);
  colorOf.delete(name);
  const i = roster.playerNames.indexOf(name);
  if (i >= 0) roster.playerNames.splice(i, 1);
}

// Premier coloris encore libre ; au-delà de la palette, on recycle.
function assignColor(name: string): void {
  if (colorOf.has(name)) return;
  const used = new Set(colorOf.values());
  colorOf.set(
    name,
    PLAYER_COLORS.find((c) => !used.has(c)) ??
      PLAYER_COLORS[colorOf.size % PLAYER_COLORS.length],
  );
}

function toggle(name: string): void {
  if (selected.has(name)) deselect(name);
  else select(name);
  commit();
}

function commit(): void {
  saveDraft(roster);
  render();
}

function render(): void {
  // Parties jouées tous jeux confondus : quelqu'un qui n'a fait que du 5000
  // doit remonter dans la liste quand on lance un Yams.
  const games = getPlayerGames();
  const gamesOf = (name: string): number => gamesPlayed(games, name);
  const query = foldName(nameInput.value);

  const everyone = [...new Set([...getKnownNames(), ...roster.playerNames])];
  const inGame = roster.playerNames.slice(); // ordre de jeu conservé
  const available = everyone
    .filter((name) => !selected.has(name))
    .filter((name) => !query || foldName(name).includes(query))
    .sort((a, b) => gamesOf(b) - gamesOf(a) || compareNames(a, b));

  // Court : peut cohabiter avec un bouton sur la même ligne même sur petit écran.
  const enough = inGame.length >= 2;
  const base = inGame.length === 0 ? "Aucun joueur" : plural(inGame.length, "joueur");
  countLine.textContent = enough ? `${base} sélectionnés` : `${base} · min. 2`;
  countLine.classList.toggle("need", !enough);

  reuseBtn.hidden = inGame.length > 0 || getLastRoster().length === 0;
  shuffleBtn.hidden = inGame.length < 2;

  list.replaceChildren();

  if (everyone.length === 0) {
    list.appendChild(line("roster-empty", "Ajoutez un premier joueur ci-dessus."));
    startBtn.disabled = true;
    return;
  }

  inGame.forEach((name, i) => list.appendChild(buildRow(name, gamesOf(name), i)));

  if (inGame.length > 0 && (available.length > 0 || query)) {
    list.appendChild(line("roster-divider", "Autres joueurs enregistrés"));
  }
  for (const name of available) {
    list.appendChild(buildRow(name, gamesOf(name), -1));
  }
  if (available.length === 0 && query) {
    list.appendChild(
      line(
        "roster-empty",
        `Aucun joueur connu ne correspond. Entrée pour créer « ${nameInput.value.trim()} ».`,
      ),
    );
  }

  startBtn.disabled = !enough;
}

function line(cls: string, text: string): HTMLLIElement {
  const li = document.createElement("li");
  li.className = cls;
  li.textContent = text;
  return li;
}

// `order` : index de tour (0-based) si sélectionné, -1 sinon.
function buildRow(
  name: string,
  gamesCount: number,
  order: number,
): HTMLLIElement {
  const isSelected = order >= 0;
  const gamesText =
    gamesCount === 0 ? "jamais joué" : plural(gamesCount, "partie");

  const row = document.createElement("li");
  row.className = isSelected ? "roster-row selected" : "roster-row";
  row.dataset.name = name;
  makeActivatable(row, `${name}, ${gamesText}`, () => {
    if (dragJustEnded) return;
    toggle(name);
  });
  row.setAttribute("aria-pressed", String(isSelected));

  const check = document.createElement("span");
  check.className = "check";
  check.setAttribute("aria-hidden", "true");
  if (isSelected) check.textContent = String(order + 1);

  const nameEl = document.createElement("span");
  nameEl.className = "name";
  nameEl.textContent = name;

  const gamesEl = document.createElement("span");
  gamesEl.className = "games";
  gamesEl.textContent = gamesText;

  row.append(check, nameEl, gamesEl);

  if (isSelected) {
    row.style.setProperty(
      "--player-color",
      colorOf.get(name) ?? PLAYER_COLORS[order % PLAYER_COLORS.length],
    );
    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.setAttribute("aria-hidden", "true");
    handle.appendChild(gripIcon());
    handle.addEventListener("click", (e) => e.stopPropagation());
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startDrag(row, name, e.pointerId, e.clientY, handle);
    });
    row.appendChild(handle);
    armDrag(row, name);
  }

  return row;
}

// Poignée dessinée (six points) et non le caractère « ⠿ » : un caractère
// braille, que la police de certains appareils ne dessine pas — le même piège
// que ⌫ et ⏸.
function gripIcon(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 10 16");
  for (const cx of [2.5, 7.5]) {
    for (const cy of [3, 8, 13]) {
      const dot = document.createElementNS(ns, "circle");
      dot.setAttribute("cx", String(cx));
      dot.setAttribute("cy", String(cy));
      dot.setAttribute("r", "1.6");
      dot.setAttribute("fill", "currentColor");
      svg.appendChild(dot);
    }
  }
  return svg;
}

/* ---------- Réordonner par glisser-déposer (joueurs sélectionnés) ---------- */
// La ligne traînée "flotte" (translateY suit le doigt) et ne change pas de
// place dans le DOM tant qu'on n'a pas lâché ; les autres lignes se décalent
// pour montrer où elle va. Le déplacement est direct (doigt = cible), pas de
// « rattrapage » qui bloquait à un cran d'écart.

// Glisser sur la ligne d'un joueur sélectionné le déplace aussitôt. La ligne
// porte `touch-action: none` (CSS) : sans ça le navigateur prendrait le geste
// pour un défilement de la liste et l'interromprait. En contrepartie, on fait
// défiler la liste en glissant sur les joueurs NON sélectionnés.
function armDrag(row: HTMLLIElement, name: string): void {
  row.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary || shuffling) return;
    if ((e.target as Element | null)?.closest(".drag-handle")) return;
    const id = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;

    const disarm = (): void => {
      row.removeEventListener("pointermove", onMove);
      row.removeEventListener("pointerup", disarm);
      row.removeEventListener("pointercancel", disarm);
    };
    const onMove = (ev: PointerEvent): void => {
      if (ev.pointerId !== id) return;
      const moved = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (moved <= DRAG_START_PX) return;
      disarm();
      navigator.vibrate?.(10); // le doigt sent que la ligne est « prise »
      startDrag(row, name, id, startY, row);
    };

    row.addEventListener("pointermove", onMove);
    row.addEventListener("pointerup", disarm);
    row.addEventListener("pointercancel", disarm);
  });

  // Un appui prolongé ouvrirait sinon le menu contextuel (ou la loupe).
  row.addEventListener("contextmenu", (e) => e.preventDefault());
}

// `captureEl` reçoit le pointeur pour toute la durée du geste : la poignée, ou
// la ligne entière après un appui long.
function startDrag(
  row: HTMLLIElement,
  name: string,
  pointerId: number,
  startY: number,
  captureEl: HTMLElement,
): void {
  const selRows = selectedRows();
  const from = selRows.indexOf(row);
  if (from < 0) return;

  try {
    captureEl.setPointerCapture(pointerId);
  } catch {
    // Pointeur déjà relâché : il n'y a rien à suivre.
  }

  const rowH = row.getBoundingClientRect().height;
  let to = from;

  row.classList.add("dragging");

  // Une fois la ligne prise, le doigt la déplace : il ne doit plus faire
  // défiler la liste. `passive: false`, sinon preventDefault est ignoré.
  const blockScroll = (ev: TouchEvent): void => ev.preventDefault();
  document.addEventListener("touchmove", blockScroll, { passive: false });

  const onMove = (ev: PointerEvent): void => {
    if (ev.pointerId !== pointerId) return;
    const dy = ev.clientY - startY;
    row.style.transform = `translateY(${dy}px)`;

    const next = rowH
      ? Math.max(0, Math.min(selRows.length - 1, from + Math.round(dy / rowH)))
      : from;
    if (next === to) return;
    to = next;

    selRows.forEach((r, i) => {
      if (r === row) return;
      let off = 0;
      if (from < to && i > from && i <= to) off = -rowH;
      else if (from > to && i >= to && i < from) off = rowH;
      r.style.transform = off ? `translateY(${off}px)` : "";
    });
  };

  const onEnd = (ev: PointerEvent): void => {
    if (ev.pointerId !== pointerId) return;
    try {
      captureEl.releasePointerCapture(pointerId);
    } catch {
      // Déjà relâché.
    }
    captureEl.removeEventListener("pointermove", onMove);
    captureEl.removeEventListener("pointerup", onEnd);
    captureEl.removeEventListener("pointercancel", onEnd);
    document.removeEventListener("touchmove", blockScroll);
    selRows.forEach((r) => (r.style.transform = ""));
    row.classList.remove("dragging");
    if (to !== from) {
      roster.playerNames.splice(from, 1);
      roster.playerNames.splice(to, 0, name);
    }
    dragJustEnded = true;
    commit();
  };

  captureEl.addEventListener("pointermove", onMove);
  captureEl.addEventListener("pointerup", onEnd);
  captureEl.addEventListener("pointercancel", onEnd);
}

/* ---------- Mélange animé : « battage de cartes » ---------- */
// Technique FLIP : on note où se trouve chaque tuile AVANT le mélange, on
// laisse `render()` reconstruire la liste dans le nouvel ordre, puis on repose
// chaque tuile à son ancienne place et on la relâche — elle glisse jusqu'à sa
// nouvelle. Les tuiles qui remontent passent par-dessus (soulevées, décalées à
// gauche), celles qui descendent passent par-dessous.

function shuffleOrder(): void {
  const n = roster.playerNames;
  const start = n.slice();
  do {
    for (let i = n.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [n[i], n[j]] = [n[j], n[i]];
    }
  } while (n.every((name, i) => name === start[i])); // sinon rien ne bouge
}

function selectedRows(): HTMLLIElement[] {
  return [...list.querySelectorAll<HTMLLIElement>(".roster-row.selected")];
}

function capturePositions(): Map<string, number> {
  const tops = new Map<string, number>();
  for (const row of selectedRows()) {
    tops.set(row.dataset.name ?? "", row.getBoundingClientRect().top);
  }
  return tops;
}

function playRiffle(before: Map<string, number>): void {
  const rows = selectedRows();
  let moved = false;

  for (const row of rows) {
    row.classList.add("shuffling"); // masque le numéro, qui change en vol
    const from = before.get(row.dataset.name ?? "");
    if (from === undefined) continue;
    const dy = Math.round(from - row.getBoundingClientRect().top);
    if (dy === 0) continue;
    moved = true;
    row.style.setProperty("--dy", `${dy}px`);
    row.classList.add(dy > 0 ? "riffle-over" : "riffle-under");
  }

  if (!moved) {
    for (const row of rows) row.classList.remove("shuffling");
    return;
  }

  shuffling = true;
  list.classList.add("shuffle-lock"); // pas de clic sur une tuile en vol

  window.setTimeout(() => {
    for (const row of rows) {
      row.classList.remove("shuffling", "riffle-over", "riffle-under");
      row.style.removeProperty("--dy");
      row.classList.add("badge-pop"); // le numéro se repose à l'arrivée
    }
    window.setTimeout(() => {
      for (const row of rows) row.classList.remove("badge-pop");
      list.classList.remove("shuffle-lock");
      shuffling = false;
    }, BADGE_POP_MS);
  }, SHUFFLE_MS);
}

/* ---------- Mise en route ---------- */

// Le « toucher » parasite d'un déplacement arrive juste après lui ; tout
// nouvel appui sur la liste rend aux lignes leur comportement normal.
list.addEventListener("pointerdown", () => (dragJustEnded = false), true);

// Page commune : son titre prend le nom du jeu qu'on prépare.
document.title = `${target.title} — Joueurs`;

// « Retour » ramène à l'accueil du jeu qu'on était en train de préparer, pas au
// menu des jeux : on vient d'en sortir, on y revient.
backBtn.href = target.pages.home;

for (const name of roster.playerNames) assignColor(name);

playerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = resolveName(nameInput.value);
  nameInput.value = "";
  nameInput.focus();
  if (!name) return render();
  addKnownName(name);
  if (!selected.has(name)) select(name);
  commit();
});

// Le champ sert aussi de filtre : re-rendu à chaque frappe.
nameInput.addEventListener("input", render);

reuseBtn.addEventListener("click", () => {
  for (const raw of getLastRoster()) {
    const name = resolveName(raw);
    if (!name || selected.has(name)) continue;
    addKnownName(name);
    select(name);
  }
  nameInput.value = "";
  commit();
});

shuffleBtn.addEventListener("click", () => {
  if (shuffling || roster.playerNames.length < 2) return;
  const before = capturePositions();
  const scroll = list.scrollTop;
  shuffleOrder();
  commit(); // la liste est reconstruite directement dans le nouvel ordre
  list.scrollTop = scroll;
  playRiffle(before);
});

// Lancer une partie écrase celle qui est en cours : on montre laquelle avant,
// comme pour toute autre suppression définitive de l'appli.
startBtn.addEventListener("click", () => {
  if (roster.playerNames.length < 2) return;
  const inProgress = target.resume();
  if (!inProgress) return startGame();
  showReplaceWarning(inProgress);
});

makeDismissible(newGameDialog, "new-game-cancel");
requireEl("new-game-confirm").addEventListener("click", () => {
  newGameDialog.close();
  startGame();
});

render();
