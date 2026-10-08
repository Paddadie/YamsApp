// Page « ⓘ Règles », commune à tous les jeux : elle rend ce que le jeu demandé
// par `?game=` décrit dans son `rulesDoc()`. Elle ne connaît aucun jeu en
// particulier — un jeu ajouté écrit son rulesDoc et apparaît ici sans qu'on
// touche à ce fichier.
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).

import { bootstrap } from "../core/bootstrap";
import { goTo } from "../core/nav";
import { requireEl } from "../core/ui";
import { gameById } from "../games/registry";
import type { RulesExample, RulesItem, RulesSection, RulesTable } from "../games/types";
import { dieFace } from "../core/dice";
import { icon } from "../core/icons";
import { applyGameTheme } from "./gameTheme";

bootstrap();

// Sans jeu identifiable, la page n'a rien à montrer : on repart au menu plutôt
// que d'afficher un écran vide.
const game = gameById(new URLSearchParams(location.search).get("game"));
if (!game) {
  goTo("home");
  throw new Error("Aucun jeu à documenter : retour à l'accueil.");
}
const target = game; // alias non-null

const content = requireEl("rules-content");

function buildTable(table: RulesTable): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "rules-table-wrap";

  const el = document.createElement("table");
  el.className = "rules-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of table.head) {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  for (const [term, value] of table.rows) {
    const tr = document.createElement("tr");
    const name = document.createElement("td");
    name.textContent = term;
    const points = document.createElement("td");
    points.textContent = value;
    tr.append(name, points);
    tbody.appendChild(tr);
  }

  el.append(thead, tbody);
  wrapper.appendChild(el);

  if (table.note) {
    const note = document.createElement("p");
    note.className = "rules-note";
    note.textContent = table.note;
    wrapper.appendChild(note);
  }
  return wrapper;
}

// Liste illustrée (les variantes) : le pictogramme à sa couleur, le nom, ce
// qu'elle change.
function buildItems(items: RulesItem[]): HTMLElement {
  const list = document.createElement("ul");
  list.className = "rules-items";
  for (const item of items) {
    const li = document.createElement("li");
    li.className = "rules-item";
    li.style.setProperty("--item-color", item.color);
    const text = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = item.title;
    text.append(title, item.text);
    li.append(icon(item.icon), text);
    list.appendChild(li);
  }
  return list;
}

// Des lancers en vrais dés : la main dessinée, les dés qui ne comptent pas
// pâlis, puis ce qu'elle rapporte. Pour comprendre d'un coup d'œil, à table.
function buildExamples(examples: RulesExample[]): HTMLElement {
  const list = document.createElement("ul");
  list.className = "rules-examples";
  for (const example of examples) {
    const li = document.createElement("li");
    li.className = "rules-example";
    const dice = document.createElement("span");
    dice.className = "rules-example-dice";
    example.dice.forEach((face, i) => {
      const die = dieFace(face);
      if (example.counted && !example.counted.includes(i)) die.classList.add("is-idle");
      dice.appendChild(die);
    });
    // Les faces sont lues comme une main : « 4, 4, 4, 2, 6 ».
    dice.setAttribute("role", "img");
    dice.setAttribute("aria-label", example.dice.join(", "));
    for (const die of dice.querySelectorAll("svg")) die.setAttribute("aria-hidden", "true");
    const result = document.createElement("span");
    result.className = "rules-example-result";
    result.textContent = example.result;
    li.append(dice, result);
    list.appendChild(li);
  }
  return list;
}

function buildSection(section: RulesSection): HTMLElement {
  const el = document.createElement("section");
  el.className =
    section.kind === "variants" ? "rules-section rules-section--variants" : "rules-section";

  const title = document.createElement("h2");
  title.className = "section-label";
  title.textContent = section.title;
  el.appendChild(title);

  for (const paragraph of section.body ?? []) {
    const p = document.createElement("p");
    p.textContent = paragraph;
    el.appendChild(p);
  }
  if (section.examples) el.appendChild(buildExamples(section.examples));
  if (section.table) el.appendChild(buildTable(section.table));
  if (section.items) el.appendChild(buildItems(section.items));
  return el;
}

/* ---------- Mise en route ---------- */

document.title = `${target.title} — Règles`;
requireEl("rules-title").textContent = target.title;
const rulesScreen = requireEl("rules-screen");
applyGameTheme(rulesScreen, target);
rulesScreen.style.setProperty("--title-color", target.accent);
// Seule la destination change : le libellé « Retour » est celui de tous les
// autres écrans, il n'y a pas de raison que celui-ci parle autrement. Ouvertes
// en pleine partie (`?from=play`), les règles ramènent à la partie : passer
// par l'accueil du jeu obligeait à « Reprendre », et laissait croire la partie
// perdue.
const fromPlay = new URLSearchParams(location.search).get("from") === "play";
requireEl<HTMLAnchorElement>("back-btn").href = fromPlay
  ? target.pages.play
  : target.pages.home;

content.replaceChildren(...target.rulesDoc({ inGame: fromPlay }).map(buildSection));
