// La feuille de progression du 5000, le sujet de l'écran de partie (game.ts).
//
// Tenue comme sur papier : une colonne par joueur, où chacun écrit son nouveau
// total sous le précédent, à son rythme. Les colonnes n'ont pas à être de même
// longueur : une ligne n'est pas un tour (un bust n'écrit rien). Un score
// qu'une règle fait tomber reste écrit, barré, avec la marque de ce qui
// l'a fait tomber. Le score en vigueur est surligné de la couleur du joueur :
// avec les ratures, ce n'est pas forcément le dernier de sa colonne.
//
// Sortie de game.ts (audit du 09/10), sur le modèle de la calculette : l'écran
// garde la main, la feuille dessine. Elle sait seulement qu'une saisie est
// ouverte (la case de celui qui joue est réservée) et quel pot y écrire au
// crayon.

import { plural, requireEl } from "../../core/ui";
import {
  canBank,
  canPlay,
  currentScore,
  hasOpened,
  isOvershoot,
  liveEntry,
  tieTargets,
} from "../../games/g5000/engine";
import type { G5000Game, G5000Player, SheetEntry, Strike } from "../../games/g5000/types";

// Ce que le dernier tour a changé sur la feuille, à animer : un score qui
// s'écrit, un trait qui barre. Seulement le temps d'un rendu.
interface SheetChanges {
  written?: Set<SheetEntry>;
  struck?: Set<SheetEntry>;
}

export interface SheetHooks {
  // Toucher l'onglet d'un joueur : lui donner la main (l'écran confirme si un
  // tour est entamé).
  onChoose(index: number): void;
  format(value: number): string;
}

export function createSheet(game: G5000Game, isReview: boolean, hooks: SheetHooks) {
  const sheet = requireEl<HTMLTableElement>("score-sheet");
  const sheetScroll = requireEl("sheet-scroll");
  const fmt = hooks.format;

  // Une saisie est ouverte (le pupitre), et le pot qu'elle montre : la case
  // de celui qui joue est réservée et ce pot s'y écrit au crayon.
  let entering = false;
  let pendingPot = 0;

  const pendingFor = (): number => (entering && !isReview ? game.currentPlayerIndex : -1);

  function renderSheet(changes: SheetChanges = {}): void {
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    // Les noms en tête de colonne servent d'onglets : toucher un joueur lui
    // donne la main. En fin de partie, ceux qui ne rejouent plus sont grisés.
    game.players.forEach((p, i) => {
      const th = document.createElement("th");
      th.style.setProperty("--col", p.color);
      // Le nom sur un intercalaire de sa couleur, le langage du bandeau : il
      // doit se lire avant les scores, pas après (demande de Paul). Ses busts
      // d'affilée dessous, dans l'onglet. Un onglet à qui l'on peut donner la
      // main est un vrai bouton, DANS l'en-tête : un rôle de bouton posé sur le
      // <th> effaçait l'en-tête de colonne pour un lecteur d'écran.
      const choosable = !isReview && i !== game.currentPlayerIndex && canPlay(game, i);
      const tab = document.createElement(choosable ? "button" : "span");
      tab.className = "name-tab";
      const name = document.createElement("span");
      name.className = "name-tab-text";
      name.textContent = p.name;
      tab.appendChild(name);
      // En consultation, la partie est finie : ni busts en cours, ni main à
      // donner — des onglets neutres.
      const pips = isReview ? null : blankTurnPips(p);
      if (pips) tab.appendChild(pips);
      th.appendChild(tab);
      if (!isReview) markTab(th, tab, p, i);
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement("tbody");
    const pending = pendingFor();
    const started = game.players.some((p) => p.sheet.length > 0) || pending >= 0;
    // Un joueur sans score en vigueur a un tiret sous sa colonne : il n'est pas
    // (ou plus) entré en jeu. Il prend une ligne — sauf avant le premier score,
    // où un message remplace la feuille. Pendant une saisie, la case de celui
    // qui joue est réservée (elle remplace son tiret).
    const used = started
      ? Math.max(
          ...game.players.map(
            (p, i) => p.sheet.length + (i === pending || !hasOpened(p) ? 1 : 0),
          ),
        )
      : 0;
    // Les adversaires sur qui le pot de la saisie tomberait pile (Sniper).
    const hits = new Set(
      pending >= 0 && pendingPot > 0
        ? tieTargets(game, pendingPot)
            .filter((t) => t.needed === 0)
            .map((t) => t.index)
        : [],
    );

    if (!started) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = game.players.length;
      td.className = "sheet-empty";
      td.textContent =
        game.rules.openAt > 0
          ? `Personne n'est encore entré en jeu. Il faut ${fmt(game.rules.openAt)} points en un tour.`
          : "La partie commence.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    // Autant de lignes que la plus longue colonne, pas une de plus : la feuille
    // s'allonge au fil de la partie (choix de Paul, 07/10).
    for (let r = 0; r < used; r++) tbody.appendChild(sheetRow(r, changes, hits));

    sheet.style.setProperty("--players", String(game.players.length));
    // Colonnes réglées sur le plus long nombre de la partie : « 5 050 » entouré
    // à 5 000 (quatre joueurs tiennent sur un téléphone de 360 px), « 10 000 »
    // au-delà.
    sheet.style.setProperty("--num-min", game.rules.target >= 10000 ? "5.5rem" : "4.85rem");
    sheet.replaceChildren(thead, tbody);

    // Les colonnes s'élargissent pour le plus long prénom : « Mar… » pour Martin
    // à dix joueurs, c'était non (Paul, 07/10). Jusqu'à la largeur d'un prénom
    // de huit lettres larges ; au-delà, le nom est abrégé (…). Mesuré plutôt que
    // compté en lettres : un « M » est trois fois plus large qu'un « i », et la
    // police dépend de l'appareil. Rien à mesurer hors navigateur (tests). On
    // mesure le nom lui-même : l'intercalaire remplit sa colonne, sa largeur
    // serait celle de la colonne (la CSS ajoute ses marges, cf. --col-min).
    const names = [...sheet.querySelectorAll<HTMLElement>(".name-tab-text")];
    const widest = Math.min(
      Math.max(0, ...names.map((name) => name.scrollWidth)),
      longNameWidth(),
    );
    if (widest > 0) sheet.style.setProperty("--tab-width", `${widest}px`);
  }

  // L'onglet d'un joueur pendant la partie : celui qui a la main, ceux à qui on
  // peut la donner, et en fin de partie ceux qui ne rejouent plus (grisés).
  function markTab(th: HTMLTableCellElement, tab: HTMLElement, p: G5000Player, i: number): void {
    if (i === game.currentPlayerIndex) {
      th.className = "is-current";
      th.setAttribute("aria-current", "true");
    } else if (tab instanceof HTMLButtonElement) {
      th.classList.add("is-choosable");
      tab.type = "button";
      tab.setAttribute("aria-label", `Donner la main à ${p.name}`);
      tab.addEventListener("click", () => hooks.onChoose(i));
    } else {
      th.classList.add("is-out");
    }
  }

  // Largeur d'un onglet portant un prénom de huit lettres larges : la limite
  // d'élargissement des colonnes. Mesurée une fois, dans le style des onglets.
  let longNameWidthCache = 0;
  function longNameWidth(): number {
    if (longNameWidthCache > 0) return longNameWidthCache;
    const probe = document.createElement("span");
    probe.className = "name-tab";
    const probeText = document.createElement("span");
    probeText.className = "name-tab-text";
    probeText.textContent = "Mohammed";
    probe.appendChild(probeText);
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    sheetScroll.appendChild(probe);
    longNameWidthCache = probeText.scrollWidth;
    probe.remove();
    return longNameWidthCache;
  }

  function sheetRow(r: number, changes: SheetChanges, hits: Set<number>): HTMLTableRowElement {
    const tr = document.createElement("tr");
    for (const [i, p] of game.players.entries()) {
      const td = document.createElement("td");
      td.style.setProperty("--col", p.color);
      if (i === game.currentPlayerIndex && !isReview) td.className = "is-current";
      if (r < p.sheet.length) {
        fillEntry(td, p, p.sheet[r], changes);
        if (hits.has(i) && p.sheet[r] === liveEntry(p)) td.classList.add("is-hit");
      } else if (r === p.sheet.length && i === pendingFor()) {
        fillPending(td, p);
      } else if (r === p.sheet.length && !hasOpened(p)) {
        td.classList.add("sheet-out");
        td.textContent = "—";
        td.title = p.sheet.length > 0 ? "Retombé à zéro" : "Pas encore entré en jeu";
      }
      tr.appendChild(td);
    }
    return tr;
  }

  function fillEntry(
    td: HTMLTableCellElement,
    p: G5000Player,
    entry: SheetEntry,
    changes: SheetChanges,
  ): void {
    const value = document.createElement(entry.struck ? "s" : "span");
    value.className = "entry";
    value.textContent = fmt(entry.score);
    if (changes.written?.has(entry)) {
      value.classList.add("is-written");
      td.classList.add("has-written"); // le cercle de l'objectif se trace avec lui
    }
    if (changes.struck?.has(entry)) value.classList.add("is-striking");
    td.appendChild(value);

    // La marque d'une rature se range contre le bord droit de la case, à l'écart
    // du score centré (demande de Paul).
    if (entry.struck) {
      td.appendChild(strikeMark(entry.struck));
    } else if (entry === liveEntry(p)) {
      td.classList.add("is-live");
      if (entry.score >= game.rules.target) {
        td.classList.add("is-goal");
        value.appendChild(goalCircle());
      }
    }
  }

  // Au crayon, pendant la saisie : où arriverait le joueur, et ce que le tour
  // rapporte en petit. Barré si ce pot ne se banquerait pas. Sans pot, la case
  // reste vide (pas de crayon qui attend : refusé par Paul).
  function fillPending(td: HTMLTableCellElement, p: G5000Player): void {
    td.classList.add("pending-cell");
    if (pendingPot <= 0) return;
    td.classList.add("is-pending");
    if (isOvershoot(game, pendingPot) || !canBank(game, pendingPot, false)) {
      td.classList.add("is-blocked");
    }
    const gain = document.createElement("span");
    gain.className = "pending-gain";
    gain.textContent = `+${fmt(pendingPot)}`;
    const value = document.createElement("span");
    value.className = "entry";
    value.textContent = fmt(currentScore(p) + pendingPot);
    td.append(gain, value);
  }

  const SVG_NS = "http://www.w3.org/2000/svg";

  // L'objectif atteint, entouré au feutre comme sur papier (et comme l'objectif
  // sur l'accueil) : le cercle se trace quand le score s'écrit.
  function goalCircle(): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "goal-circle");
    svg.setAttribute("viewBox", "0 0 100 50");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("pathLength", "1");
    path.setAttribute(
      "d",
      "M60 5 C 86 4, 97 15, 95 27 C 93 42, 70 47, 46 46 C 20 45, 4 38, 5 24 C 6 12, 25 5, 52 5 C 60 5, 67 7, 72 10",
    );
    svg.appendChild(path);
    return svg;
  }

  // Sous le nom, les tours sans marquer du joueur : une pastille par tour
  // toléré, comme dans le bandeau, pour voir d'un coup d'œil sur la feuille qui
  // est en danger (demande de Paul). Toutes rouges dès l'avant-dernier : le
  // prochain tour blanc le fera redescendre. Rien si la règle est désactivée.
  function blankTurnPips(p: G5000Player): HTMLElement | null {
    const max = game.rules.blankTurnsPenalty;
    if (max <= 0) return null;
    const count = p.blankTurns;
    const danger = count >= max - 1;

    const row = document.createElement("span");
    row.className = "sheet-pips";
    row.setAttribute("role", "img");
    row.setAttribute("aria-label", `${plural(count, "bust")} d'affilée sur ${max}`);
    for (let k = 0; k < max; k++) {
      const pip = document.createElement("span");
      pip.className = "pip";
      if (k < count) pip.classList.add(danger ? "pip--danger" : "pip--on");
      row.appendChild(pip);
    }
    return row;
  }

  // Ce qui a fait tomber un score : un point à la couleur de celui qui a égalisé,
  // ou le nombre de tours passés sans marquer.
  function strikeMark(strike: Strike): HTMLElement {
    const mark = document.createElement("span");
    mark.className = `strike-mark strike-mark--${strike.kind}`;
    mark.setAttribute("role", "img");
    let label: string;
    if (strike.kind === "tie") {
      const author = game.players[strike.by ?? 0];
      mark.style.background = author.color;
      label = `rattrapé par ${author.name}`;
    } else {
      const count = game.rules.blankTurnsPenalty;
      mark.textContent = `${count}×`;
      label = `${plural(count, "bust")} d'affilée`;
    }
    mark.setAttribute("aria-label", label);
    mark.title = label;
    return mark;
  }

  // La feuille se lit par le bas : c'est là que s'écrit le prochain score.
  function scrollSheetToEnd(): void {
    sheetScroll.scrollTop = sheetScroll.scrollHeight;
  }

  // Quand la feuille déborde à l'horizontale (beaucoup de joueurs), la colonne de
  // celui qui joue est ramenée au milieu, ses voisins de part et d'autre : la
  // main qui passe ne doit pas obliger à chercher sa colonne (demande de Paul).
  // Le navigateur borne le défilement aux extrémités.
  function centerCurrentColumn(behavior: ScrollBehavior): void {
    const th = sheet.tHead?.rows[0]?.cells[game.currentPlayerIndex];
    if (!th || sheetScroll.scrollWidth <= sheetScroll.clientWidth) return;
    const col = th.getBoundingClientRect();
    const view = sheetScroll.getBoundingClientRect();
    const delta = col.left + col.width / 2 - (view.left + view.width / 2);
    sheetScroll.scrollBy({ left: delta, behavior });
  }

  // Ce qu'un tour a changé sur les feuilles, par comparaison avec l'état d'avant.
  function snapshotSheets(): { seen: Set<SheetEntry>; struck: Set<SheetEntry> } {
    const entries = game.players.flatMap((p) => p.sheet);
    return { seen: new Set(entries), struck: new Set(entries.filter((e) => e.struck)) };
  }

  function sheetChanges(before: ReturnType<typeof snapshotSheets>): SheetChanges {
    const entries = game.players.flatMap((p) => p.sheet);
    return {
      written: new Set(entries.filter((e) => !before.seen.has(e))),
      struck: new Set(entries.filter((e) => e.struck && !before.struck.has(e))),
    };
  }

  // La saisie s'ouvre ou se ferme : la case de celui qui joue se réserve (ou
  // se libère).
  function setEntering(on: boolean): void {
    if (on === entering) return;
    entering = on;
    renderSheet();
  }

  // Le pot de la saisie, au crayon. Redessinée seulement quand il change.
  function preview(pot: number): void {
    if (pot === pendingPot) return;
    pendingPot = pot;
    if (entering) {
      renderSheet();
      scrollSheetToEnd();
    }
  }

  // La police de l'appli vient d'arriver : la mesure des onglets (et son
  // plafond) faite dans la police de secours est à refaire.
  function remeasure(): void {
    longNameWidthCache = 0;
    renderSheet();
  }

  return {
    render: renderSheet,
    scrollToEnd: scrollSheetToEnd,
    centerCurrent: centerCurrentColumn,
    snapshot: snapshotSheets,
    changesSince: sheetChanges,
    setEntering,
    preview,
    remeasure,
    scroller: sheetScroll,
  };
}
