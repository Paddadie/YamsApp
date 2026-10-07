// Amorçage commun à toutes les pages : migration des données, styles globaux,
// enregistrement du service worker (avec le bandeau "Mettre à jour").

import "../style.css";
import { migrateStorage } from "./storage/migrate";
import { requestPersistentStorage } from "./storage/persist";
import { watchStorageErrors } from "./storageAlert";
import { initUpdatePrompt } from "./pwa/updatePrompt";

export function bootstrap(): void {
  // En premier : une migration qui échouerait faute de place doit déjà
  // pouvoir être signalée.
  watchStorageErrors();
  migrateStorage(); // avant toute lecture de storage par la page
  requestPersistentStorage();
  initUpdatePrompt();
}
