// Effacement à la main des records du 5000, dans le panneau « Joueurs et
// scores » — le pendant de la suppression d'un score du Hall of Fame du Yams.
//
// Comme partout dans l'application, rien ne s'efface sans une pop-up qui
// montre ce qui va disparaître.
//
// Ce module est évalué à l'import, donc AVANT le corps de settings.ts, donc
// avant bootstrap() : il ne lit rien du stockage à son niveau module, tout est
// dans setupG5000RecordsAdmin().

import { makeDismissible, plural, requireEl, summaryRow } from "../../core/ui";
import { formatDate } from "../../core/dates";
import { formatScore } from "../../core/format";
import { getRecords, saveRecords } from "../../games/g5000/repo";
import {
  clearRecord,
  clearWins,
  recordsAt,
  recordTargets,
  winsRanking,
  type EntryKey,
} from "../../games/g5000/records";
import {
  BEST_RECORDS,
  RECORD_LABELS,
  WORST_RECORDS,
} from "../../games/g5000/recordLabels";
import { SCORES_CHANGED, emptyItem } from "./adminList";

// Ce que la pop-up s'apprête à effacer.
type Pending =
  | { kind: "record"; target: number; key: EntryKey }
  | { kind: "wins"; name: string };

let pending: Pending | null = null;

// Le nombre de victoires n'est pas un record stocké : il a sa propre liste.
const ENTRY_KEYS = [...BEST_RECORDS, ...WORST_RECORDS].filter(
  (key): key is EntryKey => key !== "mostWins",
);

function row(
  label: string,
  detail: string,
  onDelete: () => void,
  deleteLabel: string,
): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "score-admin-row";

  const name = document.createElement("span");
  name.className = "score-admin-name";
  name.textContent = label;

  const value = document.createElement("span");
  value.className = "score-admin-score";
  value.textContent = detail;

  const del = document.createElement("button");
  del.type = "button";
  del.className = "score-admin-del";
  del.setAttribute("aria-label", deleteLabel);
  del.textContent = "🗑️";
  del.addEventListener("click", onDelete);

  li.append(name, value, del);
  return li;
}

function render(): void {
  const records = getRecords();

  const list = requireEl("g5000-records-admin");
  list.replaceChildren();
  // Chaque objectif a ses records : la ligne dit lequel.
  for (const target of recordTargets(records)) {
    const table = recordsAt(records, target);
    for (const key of ENTRY_KEYS) {
      const entry = table[key];
      if (!entry) continue;
      const label = RECORD_LABELS[key];
      list.appendChild(
        row(
          `${label.icon} ${entry.name}`,
          `${label.format(entry.value)} · à ${formatScore(target)}`,
          () => ask({ kind: "record", target, key }),
          `Effacer le record « ${label.title} » à ${formatScore(target)} de ${entry.name}`,
        ),
      );
    }
  }
  if (list.children.length === 0) list.appendChild(emptyItem("Aucun record établi."));

  const wins = requireEl("g5000-wins-admin");
  wins.replaceChildren();
  const rows = winsRanking(records);
  for (const [name, count] of rows) {
    wins.appendChild(
      row(
        name,
        plural(count, "victoire"),
        () => ask({ kind: "wins", name }),
        `Remettre à zéro les victoires de ${name}`,
      ),
    );
  }
  if (rows.length === 0) wins.appendChild(emptyItem("Aucune victoire."));
}

function ask(target: Pending): void {
  const records = getRecords();
  const summary = requireEl("record-delete-summary");
  summary.replaceChildren();

  if (target.kind === "record") {
    const entry = recordsAt(records, target.target)[target.key];
    if (!entry) return;
    const label = RECORD_LABELS[target.key];
    requireEl("record-delete-title").textContent = "Effacer ce record ?";
    summaryRow(summary, "Record", `${label.icon} ${label.title}`);
    summaryRow(summary, "Objectif", `${formatScore(target.target)} points`);
    summaryRow(summary, "Détenteur", entry.name);
    summaryRow(summary, "Valeur", label.format(entry.value));
    if (entry.by) summaryRow(summary, "Provoquée par", entry.by);
    if (entry.date) summaryRow(summary, "Date", formatDate(entry.date));
    requireEl("record-delete-warn").textContent =
      "Ce record sera définitivement effacé. La prochaine partie terminée à cet objectif pourra l'établir à nouveau.";
  } else {
    requireEl("record-delete-title").textContent = "Remettre ces victoires à zéro ?";
    summaryRow(summary, "Joueur", target.name);
    summaryRow(
      summary,
      "Victoires",
      String(records.wins[target.name] ?? 0),
    );
    requireEl("record-delete-warn").textContent =
      "Ses victoires au 5000 seront définitivement effacées. Ses autres records restent.";
  }

  pending = target;
  requireEl<HTMLDialogElement>("record-delete-dialog").showModal();
}

function confirm(): void {
  if (!pending) return;
  const records = getRecords();
  saveRecords(
    pending.kind === "record"
      ? clearRecord(records, pending.target, pending.key)
      : clearWins(records, pending.name),
  );
  pending = null;
  requireEl<HTMLDialogElement>("record-delete-dialog").close();
  render();
}

export function setupG5000RecordsAdmin(): void {
  render();
  makeDismissible(
    requireEl<HTMLDialogElement>("record-delete-dialog"),
    "record-delete-cancel",
  );
  requireEl("record-delete-confirm").addEventListener("click", confirm);
  // Un joueur renommé ou supprimé dans la liste au-dessus emporte ses records.
  document.addEventListener(SCORES_CHANGED, render);
}
