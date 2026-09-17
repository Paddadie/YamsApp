// Page Paramètres, en trois sections exclusives (tuiles en haut d'écran) :
// règles du jeu, administration des joueurs et des scores, sauvegarde.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { plural, requireEl, variantBadge } from "../ui";
import { getRules, saveRules } from "../storage/rulesRepo";
import { getPrefs, savePrefs } from "../storage/prefsRepo";
import {
  DEFAULT_RULES,
  BONUS_MIN,
  BONUS_MAX,
  FINAL_SCORE_LINE,
  LINE_POINTS_MIN,
  LINE_POINTS_MAX,
} from "../scoring";
import {
  downloadBackup,
  importAllData,
  readBackupFile,
  type BackupData,
} from "../storage/backup";
import {
  getBestScores,
  getWorstScores,
  saveBestScores,
  saveWorstScores,
} from "../storage/hallOfFameRepo";
import {
  getKnownNames,
  removeKnownName,
  renameKnownName,
} from "../storage/knownPlayersRepo";
import {
  getPlayerStats,
  removePlayerStats,
  renamePlayerStats,
} from "../storage/playerStatsRepo";
import { getDraft, saveDraft } from "../storage/draftRepo";
import { getSavedGame, clearSavedGame } from "../storage/savedGameRepo";
import { compareNames, foldName, sameName } from "../playerName";
import { formatDate } from "../dates";
import type { ScoreEntry } from "../types";

type ModeKey =
  | "brelan"
  | "full"
  | "carre"
  | "petiteSuite"
  | "grandeSuite"
  | "yams";

const MODE_KEYS: ModeKey[] = [
  "brelan",
  "full",
  "carre",
  "petiteSuite",
  "grandeSuite",
  "yams",
];

bootstrap();

requireEl("app-version").textContent = `v${__APP_VERSION__}`;

let rules = getRules();
const syncers: (() => void)[] = [];

// Déclarés avant les appels de setup ci-dessous : setupScoreAdmin() y accède.
interface ScoreList {
  get: () => ScoreEntry[];
  save: (list: ScoreEntry[]) => void;
}
const deleteDialog = requireEl<HTMLDialogElement>("delete-dialog");
const deleteSummary = requireEl("delete-summary");
const deleteSheet = requireEl<HTMLTableElement>("delete-sheet");
let pendingDelete: { index: number; store: ScoreList } | null = null;

const BEST_STORE: ScoreList = { get: getBestScores, save: saveBestScores };
const WORST_STORE: ScoreList = { get: getWorstScores, save: saveWorstScores };
const SCORE_STORES: ScoreList[] = [BEST_STORE, WORST_STORE];

const playerEditDialog = requireEl<HTMLDialogElement>("player-edit-dialog");
const playerEditInput = requireEl<HTMLInputElement>("player-edit-input");
const playerEditError = requireEl("player-edit-error");
const playerDeleteDialog = requireEl<HTMLDialogElement>("player-delete-dialog");
const playerDeleteSummary = requireEl("player-delete-summary");
let editingPlayer: string | null = null;
let deletingPlayer: string | null = null;

const importDialog = requireEl<HTMLDialogElement>("import-dialog");
const messageDialog = requireEl<HTMLDialogElement>("message-dialog");
const messageTitle = requireEl("message-title");
const messageText = requireEl("message-text");

const resetBtn = requireEl<HTMLButtonElement>("reset-rules");

// Déclarés avant la séquence d'initialisation : une fonction remonte en haut du
// module, un `const` non. Laissés près de setupPanels() / limitList(), ils
// étaient encore dans leur zone morte au moment de l'appel.
const PANELS = ["rules", "data", "backup"] as const;
const LIST_PREVIEW = 5;
const expandedLists = new Set<string>();

setupPanels();
for (const key of MODE_KEYS) setupModeRow(key);
setupBonus();
setupChance();
setupDisplay();
setupReset();
setupBackup();
setupScoreAdmin();
setupPlayerAdmin();
updateResetVisibility();

/* ---------- Sections de la page ---------- */
// Motif ARIA "onglets" : les trois tuiles sont un `tablist`, chaque section un
// `tabpanel`. Rien n'est mémorisé d'une visite à l'autre — on revient toujours
// sur les règles, la section la plus consultée.

function setupPanels(): void {
  const tabs = PANELS.map((name) => requireEl<HTMLButtonElement>(`tab-${name}`));
  const body = document.querySelector<HTMLElement>(".screen-body");

  const show = (index: number): void => {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute("aria-selected", String(active));
      // Seul l'onglet actif reste dans l'ordre de tabulation : d'un onglet à
      // l'autre on se déplace aux flèches, comme l'attend le motif ARIA.
      tab.tabIndex = active ? 0 : -1;
      requireEl(`panel-${PANELS[i]}`).hidden = !active;
    });
    // Sans ça, changer de section depuis le bas d'une longue liste laisse la
    // nouvelle section affichée dans le vide, hors de l'écran.
    body?.scrollTo({ top: 0 });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => show(index));
    tab.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (step === 0) return;
      e.preventDefault();
      const next = (index + step + tabs.length) % tabs.length;
      show(next);
      tabs[next].focus();
    });
  });

  show(0);
}

/* ---------- Listes bornées ---------- */
// Au-delà de cinq entrées on n'en montre que cinq : la page se déroulait sinon
// sur plusieurs écrans dès qu'on avait quelques joueurs et un Hall of Fame
// rempli. L'état déplié est retenu par liste — une suppression redessine la
// liste, et sans ça elle se replierait sous les doigts.

function limitList(list: HTMLElement, listId: string): void {
  const rows = [...list.children] as HTMLElement[];
  if (rows.length <= LIST_PREVIEW || expandedLists.has(listId)) return;

  for (const row of rows.slice(LIST_PREVIEW)) row.hidden = true;

  // Le bouton est dans un <li> : un <button> enfant direct d'un <ul> n'est pas
  // du HTML valide, et replaceChildren() le retire au redessin suivant.
  const li = document.createElement("li");
  li.className = "list-more-row";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "list-more";
  button.textContent = `Tout afficher (${rows.length})`;
  button.addEventListener("click", () => {
    expandedLists.add(listId);
    for (const row of rows) row.hidden = false;
    li.remove();
  });
  li.appendChild(button);
  list.appendChild(li);
}

function persist(): void {
  saveRules(rules);
  updateResetVisibility();
}

// Le bouton "Valeurs par défaut" ne sert que si les règles ont été modifiées.
function updateResetVisibility(): void {
  resetBtn.hidden = rulesAreDefault();
}

function rulesAreDefault(): boolean {
  if (rules.bonus !== DEFAULT_RULES.bonus) return false;
  if (rules.chance !== DEFAULT_RULES.chance) return false;
  return MODE_KEYS.every((key) => {
    const a = rules[key];
    const b = DEFAULT_RULES[key];
    if (a.type === "sum" && b.type === "sum") return true;
    if (a.type === "fixed" && b.type === "fixed") return a.points === b.points;
    return false;
  });
}

function clamp(raw: string, fallback: number, min: number, max: number): number {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

const clampLine = (raw: string, fallback: number): number =>
  clamp(raw, fallback, LINE_POINTS_MIN, LINE_POINTS_MAX);

/* ---------- Lignes "somme des dés / points fixes" ---------- */

function setupModeRow(key: ModeKey): void {
  const row = document.querySelector<HTMLElement>(
    `.setting-row[data-key="${key}"]`,
  );
  if (!row) throw new Error(`Ligne de réglage manquante : ${key}`);

  const control = document.createElement("div");
  control.className = "setting-control";

  const seg = document.createElement("div");
  seg.className = "seg";
  const btnSum = segButton("sum", "Somme");
  const btnFixed = segButton("fixed", "Fixe");
  seg.append(btnSum, btnFixed);

  const input = document.createElement("input");
  input.type = "number";
  input.className = "num";
  input.min = String(LINE_POINTS_MIN);
  input.max = String(LINE_POINTS_MAX);

  control.append(seg, input);
  row.appendChild(control);

  const fixedPoints = (): number => {
    const mode = rules[key];
    return mode.type === "fixed" ? mode.points : 30;
  };

  input.value = String(fixedPoints());

  const sync = (): void => {
    const isSum = rules[key].type === "sum";
    btnSum.classList.toggle("on", isSum);
    btnFixed.classList.toggle("on", !isSum);
    input.hidden = isSum;
    if (!isSum) input.value = String(fixedPoints());
  };
  syncers.push(sync);

  btnSum.addEventListener("click", () => {
    rules[key] = { type: "sum" };
    persist();
    sync();
  });
  btnFixed.addEventListener("click", () => {
    rules[key] = { type: "fixed", points: clampLine(input.value, 30) };
    persist();
    sync();
  });
  input.addEventListener("change", () => {
    rules[key] = { type: "fixed", points: clampLine(input.value, 30) };
    persist();
    sync();
  });

  sync();
}

function segButton(mode: string, label: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.mode = mode;
  b.textContent = label;
  return b;
}

function setupBonus(): void {
  const input = requireEl<HTMLInputElement>("bonus-points");
  const sync = (): void => {
    input.value = String(rules.bonus);
  };
  syncers.push(sync);
  input.addEventListener("change", () => {
    rules.bonus = clamp(input.value, rules.bonus, BONUS_MIN, BONUS_MAX);
    persist();
    sync();
  });
  sync();
}

function setupChance(): void {
  const toggle = requireEl<HTMLInputElement>("chance-toggle");
  const sync = (): void => {
    toggle.checked = rules.chance;
  };
  syncers.push(sync);
  toggle.addEventListener("change", () => {
    rules.chance = toggle.checked;
    persist();
  });
  sync();
}

function setupDisplay(): void {
  // Pas dans `syncers` ni dans persist() : ce n'est pas une règle de jeu, et
  // "Valeurs par défaut" ne doit donc pas y toucher.
  const prefs = getPrefs();
  const toggle = requireEl<HTMLInputElement>("bonus-hint-toggle");
  toggle.checked = prefs.bonusHint;
  toggle.addEventListener("change", () => {
    prefs.bonusHint = toggle.checked;
    savePrefs(prefs);
  });

  requireEl("bonus-hint-info").addEventListener("click", () =>
    showMessage(
      "Indice de bonus",
      "Affiche la combinaison de dés la plus probable pour débloquer le bonus " +
        "de la section chiffres.",
    ),
  );
}

function setupReset(): void {
  resetBtn.addEventListener("click", () => {
    rules = structuredClone(DEFAULT_RULES);
    persist();
    for (const sync of syncers) sync();
  });
}

/* ---------- Export / import de sauvegarde ---------- */

function setupBackup(): void {
  requireEl("export-btn").addEventListener("click", downloadBackup);

  const importInput = requireEl<HTMLInputElement>("import-input");
  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    // Réinitialisé tout de suite : sinon ré-importer le même fichier après une
    // annulation ne déclencherait aucun événement `change`.
    importInput.value = "";
    if (file) void restore(file);
  });
}

// L'import remplace TOUTES les données locales : on lit et valide le fichier
// d'abord, on montre ce qu'il contient, et on n'écrit qu'après confirmation.
async function restore(file: File): Promise<void> {
  const read = await readBackupFile(file);
  if (!read.ok) {
    showMessage(
      "Import impossible",
      read.reason === "invalid"
        ? "Ce fichier n'est pas une sauvegarde Yams."
        : "Ce fichier n'a pas pu être lu.",
    );
    return;
  }

  if (!(await confirmImport(file, read.data))) return;

  importAllData(read.data);
  showMessage("Sauvegarde restaurée", "Les données du fichier ont été rétablies.", () =>
    goTo("home"),
  );
}

function confirmImport(file: File, data: BackupData): Promise<boolean> {
  renderImportSummary(file, data);

  return new Promise((resolve) => {
    // Le dialogue est réutilisé à chaque import : un AbortController retire
    // d'un coup tous les écouteurs, y compris quand la fermeture vient d'Échap
    // ou d'un clic sur le fond (qui passent par l'événement `close`).
    const open = new AbortController();
    const { signal } = open;
    const settle = (accepted: boolean): void => {
      open.abort();
      importDialog.close();
      resolve(accepted);
    };

    requireEl("import-confirm").addEventListener("click", () => settle(true), {
      signal,
    });
    requireEl("import-cancel").addEventListener("click", () => settle(false), {
      signal,
    });
    importDialog.addEventListener("close", () => settle(false), { signal });
    importDialog.addEventListener(
      "click",
      (e) => {
        if (e.target === importDialog) importDialog.close();
      },
      { signal },
    );

    importDialog.showModal();
  });
}

function renderImportSummary(file: File, data: BackupData): void {
  const summary = requireEl("import-summary");
  summary.replaceChildren();
  summaryRow(summary, "Fichier", file.name);
  if (data.exportedAt) {
    summaryRow(summary, "Exportée le", formatDate(data.exportedAt));
  }
  summaryRow(summary, "Joueurs", String(data.knownNames.length));
  summaryRow(
    summary,
    "Entrées Hall of Fame",
    String(data.bestScores.length + data.worstScores.length),
  );
  summaryRow(summary, "Partie en cours", data.savedGame ? "oui" : "non");
}

// Remplace les anciens alert() : même habillage que les autres pop-ups.
// `onClose` part sur l'événement `close` et non sur le clic « OK », pour être
// honoré aussi quand l'utilisateur ferme avec Échap.
function showMessage(title: string, text: string, onClose?: () => void): void {
  messageTitle.textContent = title;
  messageText.textContent = text;

  const open = new AbortController();
  const { signal } = open;
  requireEl("message-ok").addEventListener("click", () => messageDialog.close(), {
    signal,
  });
  messageDialog.addEventListener(
    "close",
    () => {
      open.abort();
      onClose?.();
    },
    { signal },
  );

  messageDialog.showModal();
}

/* ---------- Nettoyage des classements du Hall of Fame ---------- */

function setupScoreAdmin(): void {
  refreshScoreAdmin();

  requireEl("delete-cancel").addEventListener("click", () => deleteDialog.close());
  deleteDialog.addEventListener("click", (e) => {
    if (e.target === deleteDialog) deleteDialog.close();
  });
  requireEl("delete-confirm").addEventListener("click", () => {
    if (!pendingDelete) return;
    const { index, store } = pendingDelete;
    store.save(store.get().filter((_, i) => i !== index));
    pendingDelete = null;
    deleteDialog.close();
    refreshScoreAdmin();
  });
}

function refreshScoreAdmin(): void {
  renderScoreAdmin("best-admin", BEST_STORE);
  renderScoreAdmin("worst-admin", WORST_STORE);
}

function renderScoreAdmin(listId: string, store: ScoreList): void {
  const list = requireEl(listId);
  const entries = store.get();
  list.replaceChildren();

  if (entries.length === 0) {
    const li = document.createElement("li");
    li.className = "score-admin-empty";
    li.textContent = "Aucune entrée.";
    list.appendChild(li);
    return;
  }

  entries.forEach((entry, index) => {
    list.appendChild(scoreAdminRow(entry, index, store));
  });
  limitList(list, listId);
}

function scoreAdminRow(
  entry: ScoreEntry,
  index: number,
  store: ScoreList,
): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "score-admin-row";

  const name = document.createElement("span");
  name.className = "score-admin-name";
  name.textContent = entry.name;

  const score = document.createElement("span");
  score.className = "score-admin-score";
  score.textContent = `${entry.score} pts`;

  const date = document.createElement("span");
  date.className = "score-admin-date";
  date.textContent = entry.date;

  const del = document.createElement("button");
  del.type = "button";
  del.className = "score-admin-del";
  del.setAttribute(
    "aria-label",
    `Supprimer ${entry.name}, ${entry.score} points`,
  );
  del.textContent = "🗑️";
  del.addEventListener("click", () => openDeleteDialog(entry, index, store));

  li.append(name, score, date, del);
  return li;
}

// Pop-up récapitulant la partie visée avant de confirmer la suppression.
function openDeleteDialog(
  entry: ScoreEntry,
  index: number,
  store: ScoreList,
): void {
  pendingDelete = { index, store };
  renderDeleteSummary(entry);
  renderDeleteSheet(entry);
  deleteDialog.showModal();
}

function renderDeleteSummary(entry: ScoreEntry): void {
  deleteSummary.replaceChildren();
  summaryRow(deleteSummary, "Joueur", entry.name);
  summaryRow(deleteSummary, "Score", `${entry.score} pts`);
  if (entry.date) summaryRow(deleteSummary, "Date", entry.date);
  if (entry.variant) {
    const wrap = document.createElement("span");
    wrap.className = "delete-variant";
    wrap.append(variantBadge(entry.variant), entry.variant);
    summaryRow(deleteSummary, "Variante", wrap);
  }
}

function summaryRow(
  target: HTMLElement,
  term: string,
  value: string | Node,
): void {
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  if (typeof value === "string") dd.textContent = value;
  else dd.appendChild(value);
  target.append(dt, dd);
}

// Feuille de score détaillée si l'entrée la porte (parties d'avant : aucune).
function renderDeleteSheet(entry: ScoreEntry): void {
  deleteSheet.replaceChildren();
  if (!entry.sheet || !entry.lineOrder) {
    deleteSheet.hidden = true;
    return;
  }
  deleteSheet.hidden = false;

  const tbody = document.createElement("tbody");
  for (const line of entry.lineOrder) {
    const value = entry.sheet[line];
    const tr = document.createElement("tr");
    if (line === FINAL_SCORE_LINE) tr.className = "sheet-final";
    const tdLine = document.createElement("td");
    tdLine.textContent = line;
    const tdValue = document.createElement("td");
    tdValue.textContent = value === undefined ? "–" : String(value);
    tr.append(tdLine, tdValue);
    tbody.appendChild(tr);
  }
  deleteSheet.appendChild(tbody);
}

/* ---------- Renommage / suppression des joueurs enregistrés ---------- */

function setupPlayerAdmin(): void {
  renderPlayerAdmin();

  requireEl("player-edit-cancel").addEventListener("click", () =>
    playerEditDialog.close(),
  );
  playerEditDialog.addEventListener("click", (e) => {
    if (e.target === playerEditDialog) playerEditDialog.close();
  });
  playerEditInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      savePlayerEdit();
    }
  });
  requireEl("player-edit-save").addEventListener("click", savePlayerEdit);

  requireEl("player-delete-cancel").addEventListener("click", () =>
    playerDeleteDialog.close(),
  );
  playerDeleteDialog.addEventListener("click", (e) => {
    if (e.target === playerDeleteDialog) playerDeleteDialog.close();
  });
  requireEl("player-delete-confirm").addEventListener("click", () => {
    if (deletingPlayer === null) return;
    purgePlayer(deletingPlayer);
    deletingPlayer = null;
    playerDeleteDialog.close();
    renderPlayerAdmin();
    refreshScoreAdmin();
  });
}

// Tous les noms qui laissent une trace quelque part : joueurs connus,
// statistiques, Hall of Fame, brouillon de partie, partie en cours. Sert à
// pouvoir supprimer un reliquat même s'il ne figure plus dans la liste des
// joueurs connus.
function allPlayerNames(): string[] {
  const seen = new Map<string, string>(); // fold -> forme d'affichage
  const add = (raw: string): void => {
    const name = raw.trim();
    if (name && !seen.has(foldName(name))) seen.set(foldName(name), name);
  };
  getKnownNames().forEach(add);
  Object.keys(getPlayerStats()).forEach(add);
  for (const store of SCORE_STORES) store.get().forEach((e) => add(e.name));
  getDraft()?.playerNames.forEach(add);
  getSavedGame()?.players.forEach((p) => add(p.name));
  return [...seen.values()].sort(compareNames);
}

function statFor(name: string, stats = getPlayerStats()) {
  return Object.entries(stats).find(([k]) => sameName(k, name))?.[1];
}

// Efface toute trace du joueur : nom connu, stats, Hall of Fame, brouillon,
// et la partie en cours si elle l'inclut (elle est alors abandonnée).
function purgePlayer(name: string): void {
  removeKnownName(name);
  removePlayerStats(name);
  removeFromScores(name);
  removeFromDraft(name);
  clearGameIfContains(name);
}

function removeFromDraft(name: string): void {
  const draft = getDraft();
  if (!draft) return;
  const kept = draft.playerNames.filter((n) => !sameName(n, name));
  if (kept.length !== draft.playerNames.length) {
    saveDraft({ ...draft, playerNames: kept });
  }
}

function clearGameIfContains(name: string): void {
  const game = getSavedGame();
  if (game?.players.some((p) => sameName(p.name, name))) clearSavedGame();
}

function renderPlayerAdmin(): void {
  const list = requireEl("players-admin");
  const names = allPlayerNames();
  list.replaceChildren();

  if (names.length === 0) {
    const li = document.createElement("li");
    li.className = "score-admin-empty";
    li.textContent = "Aucun joueur.";
    list.appendChild(li);
    return;
  }

  // Stats lues une seule fois : statFor() ferait sinon un parse JSON par ligne.
  const stats = getPlayerStats();
  for (const name of names) {
    list.appendChild(playerAdminRow(name, statFor(name, stats)?.games ?? 0));
  }
  limitList(list, "players-admin");
}

function playerAdminRow(name: string, games: number): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "score-admin-row";

  const nameEl = document.createElement("span");
  nameEl.className = "score-admin-name";
  nameEl.textContent = name;

  const gamesEl = document.createElement("span");
  gamesEl.className = "score-admin-games";
  gamesEl.textContent = games === 0 ? "jamais joué" : plural(games, "partie");

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "score-admin-edit";
  edit.setAttribute("aria-label", `Modifier le nom de ${name}`);
  edit.textContent = "✏️";
  edit.addEventListener("click", () => openPlayerEdit(name));

  const del = document.createElement("button");
  del.type = "button";
  del.className = "score-admin-del";
  del.setAttribute("aria-label", `Supprimer ${name}`);
  del.textContent = "🗑️";
  del.addEventListener("click", () => openPlayerDelete(name));

  li.append(nameEl, gamesEl, edit, del);
  return li;
}

function openPlayerEdit(name: string): void {
  editingPlayer = name;
  playerEditInput.value = name;
  playerEditError.hidden = true;
  playerEditDialog.showModal();
  playerEditInput.focus();
  playerEditInput.select();
}

// Renomme dans les trois endroits qui portent le nom : liste des joueurs
// connus, statistiques, et entrées du Hall of Fame.
function savePlayerEdit(): void {
  if (editingPlayer === null) return;
  const next = playerEditInput.value.trim();
  if (!next || next === editingPlayer) {
    playerEditDialog.close();
    return;
  }
  if (!renameKnownName(editingPlayer, next)) {
    playerEditError.hidden = false;
    return;
  }
  renamePlayerStats(editingPlayer, next);
  renameInScores(editingPlayer, next);
  editingPlayer = null;
  playerEditDialog.close();
  renderPlayerAdmin();
  refreshScoreAdmin();
}

// Renomme les entrées du Hall of Fame portant ce nom (casse / espaces ignorés).
function renameInScores(from: string, to: string): void {
  for (const store of SCORE_STORES) {
    let changed = false;
    const updated = store.get().map((entry) => {
      if (!sameName(entry.name, from)) return entry;
      changed = true;
      return { ...entry, name: to };
    });
    if (changed) store.save(updated);
  }
}

// Retire toutes les entrées du Hall of Fame portant ce nom.
function removeFromScores(name: string): void {
  for (const store of SCORE_STORES) {
    const list = store.get();
    const kept = list.filter((entry) => !sameName(entry.name, name));
    if (kept.length !== list.length) store.save(kept);
  }
}

function openPlayerDelete(name: string): void {
  deletingPlayer = name;
  const stat = statFor(name);
  const hofCount = SCORE_STORES.reduce(
    (n, store) => n + store.get().filter((e) => sameName(e.name, name)).length,
    0,
  );
  const inGame = !!getSavedGame()?.players.some((p) => sameName(p.name, name));

  playerDeleteSummary.replaceChildren();
  summaryRow(playerDeleteSummary, "Joueur", name);
  summaryRow(playerDeleteSummary, "Parties jouées", String(stat?.games ?? 0));
  const avg =
    stat && stat.classiqueGames > 0
      ? String(Math.round(stat.classiquePoints / stat.classiqueGames))
      : "—";
  summaryRow(playerDeleteSummary, "Moyenne classique", avg);
  summaryRow(playerDeleteSummary, "Entrées Hall of Fame", String(hofCount));
  if (inGame) {
    summaryRow(playerDeleteSummary, "Partie en cours", "sera abandonnée");
  }
  playerDeleteDialog.showModal();
}
