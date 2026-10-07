// Stockage du navigateur plein ou indisponible : on le dit.
//
// Toutes les données vivent dans localStorage. Une écriture qui échoue (quota
// atteint, stockage refusé par le navigateur) lève une exception qui, sans ça,
// cassait l'écran en silence : la saisie semblait prise, et ne l'était pas. Un
// bandeau prévient que rien n'est plus enregistré — le joueur peut alors noter
// ses scores ailleurs avant de les perdre.

import "./storageAlert.css";

// Noms de l'exception selon les navigateurs (Firefox a longtemps eu le sien).
const STORAGE_ERRORS = new Set([
  "QuotaExceededError",
  "NS_ERROR_DOM_QUOTA_REACHED",
  "SecurityError",
]);

export function isStorageError(error: unknown): boolean {
  return error instanceof DOMException && STORAGE_ERRORS.has(error.name);
}

const PROBE_KEY = "cornet-storage-probe";

// Une écriture d'essai : un stockage refusé se voit dès le chargement, avant
// la première saisie perdue.
function storageWorks(): boolean {
  try {
    localStorage.setItem(PROBE_KEY, "1");
    localStorage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function watchStorageErrors(): void {
  window.addEventListener("error", (e) => {
    if (isStorageError(e.error)) showStorageAlert();
  });
  window.addEventListener("unhandledrejection", (e) => {
    if (isStorageError(e.reason)) showStorageAlert();
  });
  if (!storageWorks()) showStorageAlert();
}

export function showStorageAlert(): void {
  if (document.querySelector(".storage-alert")) return;

  const banner = document.createElement("div");
  banner.className = "storage-alert";
  // Contrairement au bandeau de mise à jour, c'est une urgence : `alert`.
  banner.setAttribute("role", "alert");

  const title = document.createElement("strong");
  title.textContent = "Impossible d'enregistrer";
  const text = document.createElement("span");
  text.textContent =
    "Le stockage du navigateur est plein ou indisponible (navigation privée ?). " +
    "Les prochaines saisies ne seront pas gardées : notez vos scores.";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "storage-alert-close";
  close.textContent = "OK";
  close.addEventListener("click", () => banner.remove());

  const body = document.createElement("div");
  body.className = "storage-alert-text";
  body.append(title, text);

  banner.append(body, close);
  document.body.appendChild(banner);
}
