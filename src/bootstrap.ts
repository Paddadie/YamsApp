// Amorçage commun à toutes les pages : migration des données, styles globaux,
// enregistrement du service worker (avec le bandeau "Mettre à jour").

import "./style.css";
import { migrateStorage } from "./storage/migrate";
import { initUpdatePrompt } from "./pwa/updatePrompt";

export function bootstrap(): void {
  migrateStorage(); // avant toute lecture de storage par la page
  initUpdatePrompt();
}
