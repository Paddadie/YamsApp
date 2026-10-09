// Les cibles de la variante Sniper, en tête de la calculette (renderTargets,
// ci-dessous). Sorties de game.ts (audit du 09/10) : la calculette les reçoit
// par ses crochets, comme avant.

import { icon } from "../../core/icons";
import { tieTargets } from "../../games/g5000/engine";
import type { G5000Game } from "../../games/g5000/types";

export function createTargets(game: G5000Game, fmt: (value: number) => string) {
  // Les adversaires sur qui le pot tombait déjà pile au rendu précédent : les
  // cibles sont redessinées à chaque touche, mais une cible ne s'allume (rebond)
  // qu'au moment où elle DEVIENT pile.
  let hitBefore = new Set<number>();
  // Le tableau détaillé (retombe à, perd) est replié par défaut : la feuille,
  // visible au-dessus du pupitre, montre déjà les scores (décision du 08/10).
  // Déplié une fois, il le reste pour la partie.
  let targetsOpen = false;

  // Viser le score exact d'un adversaire est hors de portée de tête : c'est ce
  // que l'application apporte vraiment. Une pastille par adversaire devant, avec
  // l'écart exact ; « Détail » déplie le tableau. Sans Sniper, une égalité ne
  // fait rien : pas de cibles (la feuille dit qui est devant).
  function renderTargets(container: HTMLElement, currentPot: number): void {
    const rows = tieTargets(game, currentPot);
    container.replaceChildren();
    if (rows.length === 0) {
      hitBefore = new Set();
      return;
    }
    const hits = new Set(rows.filter((t) => t.needed === 0).map((t) => t.index));

    const lead = document.createElement("span");
    lead.className = "aim-lead";
    lead.textContent = "Viser";
    // Les pastilles défilent à l'horizontale : « Détail » reste au bout, en vue,
    // quel que soit le nombre d'adversaires devant.
    const chips = document.createElement("div");
    chips.className = "aim-chips";
    container.append(lead, chips);
    for (const target of rows) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "aim-chip";
      chip.style.setProperty("--col", game.players[target.index].color);
      if (target.needed === 0) {
        chip.classList.add("is-hit");
        if (!hitBefore.has(target.index)) chip.classList.add("is-hit-new");
      } else if (target.needed < 0) chip.classList.add("is-passed");
      const dot = document.createElement("i");
      const gap = document.createElement("b");
      gap.textContent =
        target.needed === 0 ? "pile !" : target.needed > 0 ? `+${fmt(target.needed)}` : "dépassé";
      chip.append(dot, target.name, " ", gap);
      // Toucher un adversaire déplie le détail, comme « Détail ».
      chip.addEventListener("click", () => toggleTargets(container, currentPot));
      chips.appendChild(chip);
    }
    const more = document.createElement("button");
    more.type = "button";
    more.className = "aim-more";
    more.textContent = targetsOpen ? "Masquer" : "Détail";
    more.setAttribute("aria-expanded", String(targetsOpen));
    more.addEventListener("click", () => toggleTargets(container, currentPot));
    container.appendChild(more);
    if (targetsOpen) container.appendChild(targetsTable(rows));
    hitBefore = hits;
  }

  function toggleTargets(container: HTMLElement, currentPot: number): void {
    targetsOpen = !targetsOpen;
    // Même pot : rien ne doit rebondir à nouveau.
    renderTargets(container, currentPot);
  }

  // Le tableau d'avant : tous ceux qui sont devant, du plus proche au plus loin,
  // ce qu'il manque pour tomber pile sur leur score, où ils retomberaient, et ce
  // qu'ils y perdraient (demande de Paul, 07/10). Au-delà de quatre, il défile.
  function targetsTable(rows: ReturnType<typeof tieTargets>): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "targets";
    const table = document.createElement("table");
    table.className = "targets-table";
    const head = document.createElement("tr");
    for (const label of ["Devant vous", "Écart", "Retombe à", "Perd"]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = label;
      head.appendChild(th);
    }
    const thead = document.createElement("thead");
    thead.appendChild(head);

    const tbody = document.createElement("tbody");
    for (const target of rows) {
      const tr = document.createElement("tr");
      tr.className = "target-row";
      if (target.needed === 0) tr.classList.add("is-hit");
      else if (target.needed < 0) tr.classList.add("is-passed");
      else if (target.needed <= 600) tr.classList.add("is-near");

      const who = document.createElement("td");
      const name = document.createElement("span");
      name.className = "target-name";
      name.textContent = target.name;
      const score = document.createElement("span");
      score.className = "target-score";
      score.textContent = fmt(target.score);
      who.append(name, score);

      const gap = document.createElement("td");
      gap.className = "target-gap";
      if (target.needed === 0) {
        const hit = document.createElement("span");
        hit.className = "target-hit";
        hit.append(icon("crosshair"), "pile !");
        gap.appendChild(hit);
      } else gap.textContent = target.needed > 0 ? `+${fmt(target.needed)}` : "dépassé";

      const fallsTo = document.createElement("td");
      fallsTo.className = "target-falls";
      fallsTo.textContent = fmt(target.fallsTo);

      const drop = document.createElement("td");
      drop.className = "target-drop";
      drop.textContent = `−${fmt(target.score - target.fallsTo)}`;

      tr.append(who, gap, fallsTo, drop);
      tbody.appendChild(tr);
    }

    table.append(thead, tbody);
    wrap.appendChild(table);
    return wrap;
  }

  return renderTargets;
}
