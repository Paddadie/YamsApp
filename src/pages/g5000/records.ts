// Page des records du 5000 : quatre dont on est fier, quatre dont on rit, et le
// classement des victoires.
//
// Ce n'est pas un Hall of Fame à la Yams : tout le monde finit à l'objectif, un
// « meilleur score » ne voudrait rien dire. Chaque carte porte un seul
// détenteur — le premier à avoir établi le record le garde tant qu'on ne l'a
// pas BATTU.
//
// Chaque objectif a ses records (cf. games/g5000/records) : des puces en tête
// de page passent de l'un à l'autre. Les victoires sont communes.
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).

import { bootstrap } from "../../core/bootstrap";
import { plural, requireEl } from "../../core/ui";
import { formatDate } from "../../core/dates";
import { formatScore } from "../../core/format";
import { G5000 } from "../../games/g5000/gameDef";
import { getRecords, getRules, getSavedGame } from "../../games/g5000/repo";
import {
  mostWins,
  recordsAt,
  recordTargets,
  winsRanking,
  type RecordEntry,
  type RecordKey,
} from "../../games/g5000/records";
import {
  BEST_RECORDS,
  RECORD_LABELS,
  WORST_RECORDS,
} from "../../games/g5000/recordLabels";

bootstrap();

const records = getRecords();

// Objectif montré à l'arrivée : celui de la partie qu'on vient de finir (ou en
// cours), sinon celui des réglages — c'est celui de la prochaine partie.
let target = getSavedGame()?.rules.target ?? getRules().target;

// Le détenteur d'un record, sous une forme commune. Le nombre de victoires
// n'est pas stocké comme une entrée : on le dérive du compteur par joueur.
function holderOf(key: RecordKey): RecordEntry | null {
  if (key !== "mostWins") return recordsAt(records, target)[key] ?? null;
  const leader = mostWins(records);
  return leader ? { name: leader.name, value: leader.value, date: "" } : null;
}

function span(className: string, text: string): HTMLElement {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  return el;
}

function buildCard(key: RecordKey): HTMLLIElement {
  const label = RECORD_LABELS[key];
  const holder = holderOf(key);

  const card = document.createElement("li");
  card.className = holder ? "record-card" : "record-card is-vacant";

  const icon = span("record-icon", label.icon);
  icon.setAttribute("aria-hidden", "true");

  const head = document.createElement("div");
  head.className = "record-head";
  head.append(span("record-title", label.title), span("record-hint", label.hint));

  const body = document.createElement("div");
  body.className = "record-body";
  body.appendChild(head);

  if (!holder) {
    // Une carte vide reste affichée : elle dit ce qu'il y a à conquérir.
    body.appendChild(span("record-vacant", "à établir"));
  } else {
    const main = document.createElement("div");
    main.className = "record-main";
    main.append(span("record-holder", holder.name), span("record-value", label.format(holder.value)));
    body.appendChild(main);

    const meta: string[] = [];
    if (holder.by) meta.push(`provoquée par ${holder.by}`);
    if (holder.date) meta.push(formatDate(holder.date));
    if (meta.length) body.appendChild(span("record-meta", meta.join(" · ")));
  }

  card.append(icon, body);
  return card;
}

// Une puce par objectif qui a des records, plus celui montré à l'arrivée.
// Rien à choisir quand il n'y en a qu'un.
function renderTargetChips(): void {
  const targets = [...new Set([...recordTargets(records), target])].sort((a, b) => a - b);
  requireEl("target-block").hidden = targets.length < 2;

  const options = requireEl("target-options");
  options.replaceChildren();
  for (const value of targets) {
    const chip = document.createElement("label");
    chip.className = "variant-chip";
    chip.style.setProperty("--chip-color", G5000.accent);

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "target";
    radio.value = String(value);
    radio.checked = value === target;
    radio.addEventListener("change", () => {
      target = value;
      renderRecords();
    });

    const label = document.createElement("span");
    label.className = "chip-label";
    label.textContent = formatScore(value);

    chip.append(radio, label);
    options.appendChild(chip);
  }
}

function renderRecords(): void {
  const empty = requireEl("records-empty");
  const anyRecord = [...BEST_RECORDS, ...WORST_RECORDS]
    .filter((key) => key !== "mostWins")
    .some((key) => holderOf(key) !== null);
  empty.hidden = anyRecord;
  empty.textContent =
    `Aucune partie terminée à ${formatScore(target)} points pour l'instant : ` +
    "les records s'établiront à la fin de la première.";

  requireEl("records-best").replaceChildren(...BEST_RECORDS.map(buildCard));
  requireEl("records-worst").replaceChildren(...WORST_RECORDS.map(buildCard));
}

function renderWins(): void {
  const rows = winsRanking(records);
  requireEl("wins-block").hidden = rows.length === 0;

  const list = requireEl("wins-list");
  list.replaceChildren();
  for (const [name, count] of rows) {
    const li = document.createElement("li");
    li.className = "wins-row";
    li.append(
      span("wins-name", name),
      span("wins-count", plural(count, "victoire")),
    );
    list.appendChild(li);
  }
}

/* ---------- Mise en route ---------- */

// Ouverte depuis l'écran de fin (`?from=end`), la page y ramène : le podium
// est encore là tant qu'on n'a pas quitté la partie.
if (new URLSearchParams(location.search).get("from") === "end") {
  requireEl<HTMLAnchorElement>("back-btn").href = "5000-end.html";
}

renderTargetChips();
renderRecords();
renderWins();
