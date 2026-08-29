// Page "Joueurs de la partie" : une liste unique où chaque joueur connu se
// coche pour rejoindre la partie. Les joueurs sélectionnés portent un numéro
// d'ordre de tour et se réordonnent par glisser-déposer (poignée). Le champ du
// haut sert à créer un nom OU à filtrer la liste.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { createPlayers, PLAYER_COLORS } from "../state";
import { makeActivatable, plural, requireEl } from "../ui";
import {
  addKnownName,
  getKnownNames,
  resolveName,
} from "../storage/knownPlayersRepo";
import { getPlayerStats } from "../storage/playerStatsRepo";
import {
  getDraft,
  saveDraft,
  clearDraft,
  getLastRoster,
  saveLastRoster,
} from "../storage/draftRepo";
import { saveSavedGame } from "../storage/savedGameRepo";
import { getRules } from "../storage/rulesRepo";

bootstrap();

const draft = getDraft();
if (!draft) {
  goTo("home");
  throw new Error("Aucun brouillon de partie : retour à l'accueil.");
}
const roster = draft; // alias non-null pour les closures

const playerForm = requireEl<HTMLFormElement>("player-form");
const nameInput = requireEl<HTMLInputElement>("player-name");
const countLine = requireEl("roster-count");
const reuseBtn = requireEl<HTMLButtonElement>("reuse-btn");
const shuffleBtn = requireEl<HTMLButtonElement>("shuffle-btn");
const list = requireEl<HTMLUListElement>("roster");
const startBtn = requireEl<HTMLButtonElement>("start-game-btn");

const selected = new Set(roster.playerNames);

// La couleur appartient au joueur, pas à sa place : sans ça, mélanger l'ordre
// (ou déplacer une ligne) ferait changer de teinte toutes les pastilles d'un
// coup. Attribuée à la sélection, rendue à la désélection.
const colorOf = new Map<string, string>();

// Battage de cartes au clic sur « Ordre aléatoire ».
const SHUFFLE_MS = 420; // 0.38s d'animation + marge : pas de coupure sur la fin
const BADGE_POP_MS = 240;
let shuffling = false;

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

startBtn.addEventListener("click", () => {
  if (roster.playerNames.length < 2) return;
  saveLastRoster(roster.playerNames.slice());
  saveSavedGame({
    players: createPlayers(
      roster.playerNames,
      roster.variants,
      roster.playerNames.map((name) => colorOf.get(name) ?? PLAYER_COLORS[0]),
    ),
    selectedVariants: roster.variants,
    currentPlayerIndex: 0,
    rules: getRules(), // règles figées pour toute la partie
  });
  clearDraft();
  goTo("game");
});

render();

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
  const stats = getPlayerStats();
  const gamesOf = (name: string): number => stats[name]?.games ?? 0;
  const query = nameInput.value.trim().toLowerCase();

  const everyone = [...new Set([...getKnownNames(), ...roster.playerNames])];
  const inGame = roster.playerNames.slice(); // ordre de jeu conservé
  const available = everyone
    .filter((name) => !selected.has(name))
    .filter((name) => !query || name.toLowerCase().includes(query))
    .sort((a, b) => gamesOf(b) - gamesOf(a) || a.localeCompare(b));

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
  gamesPlayed: number,
  order: number,
): HTMLLIElement {
  const isSelected = order >= 0;
  const gamesText =
    gamesPlayed === 0 ? "jamais joué" : plural(gamesPlayed, "partie");

  const row = document.createElement("li");
  row.className = isSelected ? "roster-row selected" : "roster-row";
  row.dataset.name = name;
  makeActivatable(row, `${name}, ${gamesText}`, () => toggle(name));
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
    handle.textContent = "⠿";
    handle.addEventListener("click", (e) => e.stopPropagation());
    handle.addEventListener("pointerdown", (e) => startDrag(e, row, name));
    row.appendChild(handle);
  }

  return row;
}

/* ---------- Réordonner par glisser-déposer (joueurs sélectionnés) ---------- */
// La ligne traînée "flotte" (translateY suit le doigt) et ne change pas de
// place dans le DOM tant qu'on n'a pas lâché ; les autres lignes se décalent
// pour montrer où elle va. Le déplacement est direct (doigt = cible), pas de
// « rattrapage » qui bloquait à un cran d'écart.

function startDrag(e: PointerEvent, row: HTMLLIElement, name: string): void {
  e.preventDefault();
  e.stopPropagation();
  const handle = e.currentTarget as HTMLElement;
  handle.setPointerCapture(e.pointerId);

  const selRows = [
    ...list.querySelectorAll<HTMLLIElement>(".roster-row.selected"),
  ];
  const from = selRows.indexOf(row);
  if (from < 0) return;

  const rowH = row.getBoundingClientRect().height;
  const startY = e.clientY;
  let to = from;

  row.classList.add("dragging");

  const onMove = (ev: PointerEvent): void => {
    const dy = ev.clientY - startY;
    row.style.transform = `translateY(${dy}px)`;

    const next = Math.max(
      0,
      Math.min(selRows.length - 1, from + Math.round(dy / rowH)),
    );
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

  const onEnd = (): void => {
    handle.releasePointerCapture(e.pointerId);
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onEnd);
    handle.removeEventListener("pointercancel", onEnd);
    selRows.forEach((r) => (r.style.transform = ""));
    row.classList.remove("dragging");
    if (to !== from) {
      roster.playerNames.splice(from, 1);
      roster.playerNames.splice(to, 0, name);
    }
    commit();
  };

  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onEnd);
  handle.addEventListener("pointercancel", onEnd);
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
