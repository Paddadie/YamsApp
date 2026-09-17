// Panneau « Sauvegarde » : export de toutes les données locales dans un
// fichier, et import qui les remplace — d'où la confirmation détaillée.

import { makeDismissible, requireEl, summaryRow } from "../../ui";
import { goTo } from "../../nav";
import {
  downloadBackup,
  importAllData,
  readBackupFile,
  type BackupData,
} from "../../storage/backup";
import { formatDate } from "../../dates";
import { showMessage } from "./dialogs";

const importDialog = requireEl<HTMLDialogElement>("import-dialog");

/* ---------- Export / import de sauvegarde ---------- */

export function setupBackupPanel(): void {
  makeDismissible(importDialog, "import-cancel");
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
    // d'un coup les écouteurs de cette ouverture. Toutes les façons de renoncer
    // (Annuler, clic sur le fond, Échap) ferment le dialogue et se rejoignent
    // donc sur l'événement `close`.
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
    importDialog.addEventListener("close", () => settle(false), { signal });

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
